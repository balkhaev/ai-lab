"""
HuggingFace Cache Management Service

Provides functionality to scan, download, and delete models from the HuggingFace cache.
"""
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from huggingface_hub import scan_cache_dir, snapshot_download
from huggingface_hub.utils import HFCacheInfo

from models.management import CachedModel, ModelType

logger = logging.getLogger(__name__)


def get_cache_dir() -> Path:
    """Get the HuggingFace cache directory path"""
    hf_home = os.environ.get("HF_HOME", os.path.expanduser("~/.cache/huggingface"))
    return Path(hf_home) / "hub"


def scan_cache() -> tuple[list[CachedModel], int, str]:
    """
    Scan the HuggingFace cache directory for downloaded models.
    
    Returns:
        Tuple of (list of CachedModel, total size in bytes, cache directory path)
    """
    cache_dir = get_cache_dir()
    logger.info(f"Scanning cache directory: {cache_dir}")
    
    if not cache_dir.exists():
        logger.info(f"Cache directory does not exist: {cache_dir}")
        return [], 0, str(cache_dir)
    
    try:
        cache_info: HFCacheInfo = scan_cache_dir(cache_dir)
    except Exception as e:
        logger.error(f"Failed to scan cache: {e}")
        return [], 0, str(cache_dir)
    
    models: list[CachedModel] = []
    total_size = 0
    
    for repo in cache_info.repos:
        # Get last accessed time from revision blobs
        last_accessed: datetime | None = None
        last_modified: datetime | None = None
        
        for revision in repo.revisions:
            for blob in revision.files:
                blob_path = Path(blob.file_path)
                if blob_path.exists():
                    stat = blob_path.stat()
                    access_time = datetime.fromtimestamp(stat.st_atime, tz=timezone.utc)
                    mod_time = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
                    
                    if last_accessed is None or access_time > last_accessed:
                        last_accessed = access_time
                    if last_modified is None or mod_time > last_modified:
                        last_modified = mod_time
        
        # Count total files
        nb_files = sum(len(list(rev.files)) for rev in repo.revisions)
        
        # Collect revision hashes
        revisions = [rev.commit_hash[:8] for rev in repo.revisions]
        
        cached_model = CachedModel(
            repo_id=repo.repo_id,
            repo_type=repo.repo_type,
            size_on_disk=repo.size_on_disk,
            nb_files=nb_files,
            last_accessed=last_accessed,
            last_modified=last_modified,
            revisions=revisions,
        )
        models.append(cached_model)
        total_size += repo.size_on_disk
    
    # Sort by size (largest first)
    models.sort(key=lambda m: m.size_on_disk, reverse=True)
    
    logger.info(f"Found {len(models)} cached repos, total size: {total_size / (1024**3):.2f} GB")
    return models, total_size, str(cache_dir)


def download_model(repo_id: str, model_type: ModelType, revision: str | None = None) -> tuple[str, int]:
    """
    Download a model to the cache without loading it into memory.
    
    Args:
        repo_id: HuggingFace repository ID
        model_type: Type of model (determines which files to download)
        revision: Specific revision to download
        
    Returns:
        Tuple of (local path, size in bytes)
    """
    logger.info(f"Downloading model {repo_id} (type: {model_type}, revision: {revision or 'main'})")
    
    # Download the model snapshot
    local_path = snapshot_download(
        repo_id=repo_id,
        revision=revision,
        # Allow patterns based on model type to optimize download
        # For now, download everything
    )
    
    # Calculate size
    path = Path(local_path)
    size = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
    
    logger.info(f"Downloaded {repo_id} to {local_path}, size: {size / (1024**3):.2f} GB")
    return local_path, size


def delete_model(repo_id: str) -> tuple[bool, int]:
    """
    Delete a model from the cache.
    
    Args:
        repo_id: HuggingFace repository ID to delete
        
    Returns:
        Tuple of (success, freed bytes)
    """
    cache_dir = get_cache_dir()
    logger.info(f"Deleting model {repo_id} from cache")
    
    try:
        cache_info: HFCacheInfo = scan_cache_dir(cache_dir)
    except Exception as e:
        logger.error(f"Failed to scan cache for deletion: {e}")
        return False, 0
    
    # Find the repo
    target_repo = None
    for repo in cache_info.repos:
        if repo.repo_id == repo_id:
            target_repo = repo
            break
    
    if target_repo is None:
        logger.warning(f"Model {repo_id} not found in cache")
        return False, 0
    
    freed_bytes = target_repo.size_on_disk
    
    # Collect all revision commit hashes for deletion
    revision_hashes = [rev.commit_hash for rev in target_repo.revisions]
    
    if not revision_hashes:
        logger.warning(f"No revisions found for {repo_id}")
        return False, 0
    
    # Delete using the cache info's delete method
    try:
        delete_strategy = cache_info.delete_revisions(*revision_hashes)
        logger.info(f"Delete strategy: will free {delete_strategy.expected_freed_size / (1024**3):.2f} GB")
        delete_strategy.execute()
        logger.info(f"Successfully deleted {repo_id}, freed {freed_bytes / (1024**3):.2f} GB")
        return True, freed_bytes
    except Exception as e:
        logger.error(f"Failed to delete {repo_id}: {e}")
        return False, 0


def get_cache_size() -> tuple[int, int]:
    """
    Get total cache size and number of models.
    
    Returns:
        Tuple of (total size in bytes, number of models)
    """
    cache_dir = get_cache_dir()
    
    if not cache_dir.exists():
        return 0, 0
    
    try:
        cache_info: HFCacheInfo = scan_cache_dir(cache_dir)
        total_size = sum(repo.size_on_disk for repo in cache_info.repos)
        return total_size, len(cache_info.repos)
    except Exception as e:
        logger.error(f"Failed to get cache size: {e}")
        return 0, 0

