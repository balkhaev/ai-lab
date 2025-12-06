"""
Model Orchestrator - Unified model management with smart GPU memory policy
"""
import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

import torch

from models.management import ModelType, ModelStatus

logger = logging.getLogger(__name__)


class GPUStatus:
    """GPU memory status"""
    def __init__(self, total_mb: float, used_mb: float, free_mb: float):
        self.total_mb = total_mb
        self.used_mb = used_mb
        self.free_mb = free_mb
    
    def __repr__(self) -> str:
        return f"GPUStatus(total={self.total_mb:.0f}MB, used={self.used_mb:.0f}MB, free={self.free_mb:.0f}MB)"


@dataclass
class LoadedModel:
    """Information about a loaded model"""
    model_id: str
    model_type: ModelType
    instance: object  # vLLM engine / diffusers pipeline
    memory_mb: float
    loaded_at: datetime
    last_used: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict = field(default_factory=dict)  # Additional info (e.g., video_family)
    
    def touch(self) -> None:
        """Update last used timestamp"""
        self.last_used = datetime.now(timezone.utc)


class ModelOrchestrator:
    """
    Singleton class managing all models on GPU.
    
    Features:
    - Unified model storage and tracking
    - Smart LRU-based memory management
    - Automatic unloading when memory is needed
    - Async-safe with locks
    """
    
    _instance: "ModelOrchestrator | None" = None
    _initialized: bool = False
    
    def __new__(cls) -> "ModelOrchestrator":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self) -> None:
        # Only initialize once
        if ModelOrchestrator._initialized:
            return
        
        self._models: dict[str, LoadedModel] = {}
        self._lock = asyncio.Lock()
        self._status: dict[str, dict] = {}  # model_id -> status info for UI
        
        ModelOrchestrator._initialized = True
        logger.info("ModelOrchestrator initialized")
    
    @classmethod
    def reset(cls) -> None:
        """Reset singleton (for testing)"""
        cls._instance = None
        cls._initialized = False
    
    # ==================== GPU Status ====================
    
    def get_gpu_status(self) -> GPUStatus:
        """Get current GPU memory status"""
        if not torch.cuda.is_available():
            return GPUStatus(0, 0, 0)
        
        try:
            # Try pynvml for accurate GPU memory (includes vLLM allocations)
            import pynvml
            pynvml.nvmlInit()
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
            pynvml.nvmlShutdown()
            
            total = mem_info.total / (1024 * 1024)
            used = mem_info.used / (1024 * 1024)
            free = mem_info.free / (1024 * 1024)
        except ImportError:
            # Fallback to torch
            total = torch.cuda.get_device_properties(0).total_memory / (1024 * 1024)
            used = torch.cuda.memory_reserved(0) / (1024 * 1024)
            free = total - used
        
        return GPUStatus(total, used, free)
    
    def get_disk_usage(self) -> tuple[float | None, float | None, float | None]:
        """Get disk usage info in GB for HuggingFace cache: (total, used, free)"""
        import os
        import shutil
        
        hf_home = os.environ.get("HF_HOME", os.path.expanduser("~/.cache/huggingface"))
        
        try:
            usage = shutil.disk_usage(hf_home)
            total = usage.total / (1024 ** 3)
            used = usage.used / (1024 ** 3)
            free = usage.free / (1024 ** 3)
            return total, used, free
        except OSError:
            return None, None, None
    
    # ==================== Model Access ====================
    
    def get(self, model_id: str) -> LoadedModel | None:
        """Get a loaded model by ID"""
        model = self._models.get(model_id)
        if model:
            model.touch()
        return model
    
    def get_by_type(self, model_type: ModelType) -> LoadedModel | None:
        """Get the first loaded model of a specific type"""
        for model in self._models.values():
            if model.model_type == model_type:
                model.touch()
                return model
        return None
    
    def list_loaded(self) -> list[LoadedModel]:
        """List all loaded models"""
        return list(self._models.values())
    
    def is_loaded(self, model_id: str) -> bool:
        """Check if a model is loaded"""
        return model_id in self._models
    
    def get_status(self, model_id: str) -> dict | None:
        """Get status info for a model"""
        return self._status.get(model_id)
    
    def get_all_statuses(self) -> dict[str, dict]:
        """Get all model statuses"""
        return self._status.copy()
    
    # ==================== Memory Management ====================
    
    async def ensure_memory_available(self, required_mb: float, exclude_model_id: str | None = None) -> None:
        """
        Ensure enough GPU memory is available by unloading LRU models.
        
        Args:
            required_mb: Required memory in MB
            exclude_model_id: Model ID to exclude from unloading (e.g., the model being loaded)
        """
        gpu = self.get_gpu_status()
        
        if gpu.free_mb >= required_mb:
            logger.info(f"Memory available: {gpu.free_mb:.0f}MB free, {required_mb:.0f}MB required")
            return
        
        logger.info(f"Need to free memory: {gpu.free_mb:.0f}MB free, {required_mb:.0f}MB required")
        
        # Sort by last used time (LRU - least recently used first)
        candidates = sorted(
            [m for m in self._models.values() if m.model_id != exclude_model_id],
            key=lambda m: m.last_used
        )
        
        for model in candidates:
            if gpu.free_mb >= required_mb:
                break
            
            logger.info(f"Unloading LRU model: {model.model_id} (last used: {model.last_used})")
            await self.unload(model.model_id)
            gpu = self.get_gpu_status()
        
        if gpu.free_mb < required_mb:
            logger.warning(
                f"Could not free enough memory. Available: {gpu.free_mb:.0f}MB, required: {required_mb:.0f}MB"
            )
    
    # ==================== Load/Unload ====================
    
    async def load(self, model_id: str, model_type: ModelType, force: bool = False) -> LoadedModel:
        """
        Load a model into GPU memory.
        
        Args:
            model_id: HuggingFace model ID
            model_type: Type of model (LLM, IMAGE, etc.)
            force: If True, reload even if already loaded
            
        Returns:
            LoadedModel instance
        """
        async with self._lock:
            # Check if already loaded
            if model_id in self._models and not force:
                logger.info(f"Model {model_id} is already loaded")
                self._models[model_id].touch()
                return self._models[model_id]
            
            # If force and loaded, unload first
            if model_id in self._models and force:
                await self._unload_internal(model_id)
            
            # Update status
            self._status[model_id] = {
                "type": model_type,
                "status": ModelStatus.LOADING,
                "error": None,
                "loaded_at": None,
            }
            
            try:
                # Estimate memory and ensure it's available
                memory_estimate = self._estimate_memory(model_id, model_type)
                await self.ensure_memory_available(memory_estimate, exclude_model_id=model_id)
                
                # Load based on type
                instance, actual_memory, metadata = await self._load_model(model_id, model_type)
                
                # Create LoadedModel
                loaded_model = LoadedModel(
                    model_id=model_id,
                    model_type=model_type,
                    instance=instance,
                    memory_mb=actual_memory,
                    loaded_at=datetime.now(timezone.utc),
                    metadata=metadata,
                )
                
                self._models[model_id] = loaded_model
                self._status[model_id] = {
                    "type": model_type,
                    "status": ModelStatus.LOADED,
                    "error": None,
                    "loaded_at": loaded_model.loaded_at.isoformat(),
                }
                
                logger.info(f"Model {model_id} loaded successfully")
                return loaded_model
                
            except Exception as e:
                logger.error(f"Failed to load model {model_id}: {e}")
                self._status[model_id] = {
                    "type": model_type,
                    "status": ModelStatus.ERROR,
                    "error": str(e),
                    "loaded_at": None,
                }
                raise
    
    async def unload(self, model_id: str) -> float:
        """
        Unload a model and free GPU memory.
        
        Args:
            model_id: Model ID to unload
            
        Returns:
            Freed memory in MB
        """
        async with self._lock:
            return await self._unload_internal(model_id)
    
    async def _unload_internal(self, model_id: str) -> float:
        """Internal unload without lock (called from load)"""
        if model_id not in self._models:
            logger.warning(f"Model {model_id} is not loaded")
            return 0
        
        model = self._models[model_id]
        model_type = model.model_type
        
        self._status[model_id] = {
            "type": model_type,
            "status": ModelStatus.UNLOADING,
            "error": None,
            "loaded_at": None,
        }
        
        try:
            freed_memory = await self._unload_model(model.instance, model_type)
            
            del self._models[model_id]
            self._status[model_id] = {
                "type": model_type,
                "status": ModelStatus.NOT_LOADED,
                "error": None,
                "loaded_at": None,
            }
            
            logger.info(f"Model {model_id} unloaded, freed ~{freed_memory:.0f}MB")
            return freed_memory
            
        except Exception as e:
            logger.error(f"Failed to unload model {model_id}: {e}")
            self._status[model_id] = {
                "type": model_type,
                "status": ModelStatus.ERROR,
                "error": str(e),
                "loaded_at": None,
            }
            raise
    
    async def ensure_loaded(self, model_id: str, model_type: ModelType) -> LoadedModel:
        """
        Ensure a model is loaded, loading it if necessary.
        
        This is the primary method for routes/workers to use.
        It handles automatic memory management.
        
        Args:
            model_id: HuggingFace model ID
            model_type: Type of model
            
        Returns:
            LoadedModel instance
        """
        if model_id in self._models:
            self._models[model_id].touch()
            return self._models[model_id]
        
        return await self.load(model_id, model_type)
    
    # ==================== Internal Loading Logic ====================
    
    def _estimate_memory(self, model_id: str, model_type: ModelType) -> float:
        """Estimate memory required for a model"""
        from services.loaders import (
            estimate_llm_memory,
            estimate_image_memory,
            estimate_video_memory,
        )
        
        if model_type == ModelType.LLM:
            return estimate_llm_memory(model_id)
        elif model_type in (ModelType.IMAGE, ModelType.IMAGE2IMAGE):
            return estimate_image_memory(model_id)
        elif model_type == ModelType.VIDEO:
            return estimate_video_memory(model_id)
        else:
            return 10_000  # Default 10GB estimate
    
    async def _load_model(self, model_id: str, model_type: ModelType) -> tuple[object, float, dict]:
        """
        Load a model using appropriate loader.
        
        Returns:
            Tuple of (instance, memory_mb, metadata)
        """
        from services.loaders import (
            load_llm,
            load_image_pipeline,
            load_image2image_pipeline,
            load_video_pipeline,
        )
        
        if model_type == ModelType.LLM:
            instance, memory = await load_llm(model_id)
            return instance, memory, {}
        
        elif model_type == ModelType.IMAGE:
            # Run sync function in executor
            loop = asyncio.get_event_loop()
            instance, memory = await loop.run_in_executor(
                None, load_image_pipeline, model_id
            )
            return instance, memory, {}
        
        elif model_type == ModelType.IMAGE2IMAGE:
            loop = asyncio.get_event_loop()
            instance, memory = await loop.run_in_executor(
                None, load_image2image_pipeline, model_id
            )
            return instance, memory, {}
        
        elif model_type == ModelType.VIDEO:
            loop = asyncio.get_event_loop()
            instance, memory, family = await loop.run_in_executor(
                None, load_video_pipeline, model_id
            )
            return instance, memory, {"video_family": family.value}
        
        else:
            raise ValueError(f"Unknown model type: {model_type}")
    
    async def _unload_model(self, instance: object, model_type: ModelType) -> float:
        """
        Unload a model using appropriate unloader.
        
        Returns:
            Freed memory in MB
        """
        from services.loaders import (
            unload_llm,
            unload_image_pipeline,
            unload_video_pipeline,
        )
        
        if model_type == ModelType.LLM:
            return await unload_llm(instance)
        
        elif model_type in (ModelType.IMAGE, ModelType.IMAGE2IMAGE):
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None, unload_image_pipeline, instance
            )
        
        elif model_type == ModelType.VIDEO:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None, unload_video_pipeline, instance
            )
        
        else:
            logger.warning(f"Unknown model type for unload: {model_type}")
            return 0


# Global orchestrator instance
orchestrator = ModelOrchestrator()
