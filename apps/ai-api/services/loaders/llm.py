"""
LLM model loader using vLLM
"""
import gc
import logging
import re

import torch

from config import (
    TENSOR_PARALLEL_SIZE,
    GPU_MEMORY_UTILIZATION,
    MAX_MODEL_LEN,
)

logger = logging.getLogger(__name__)


# Memory estimates for LLM models (in MB) based on parameter count
LLM_MEMORY_ESTIMATES = {
    "0.5B": 1_500,
    "1B": 3_000,
    "3B": 7_000,
    "7B": 14_000,
    "8B": 16_000,
    "13B": 26_000,
    "14B": 28_000,
    "32B": 64_000,
    "70B": 140_000,
    "72B": 144_000,
}


def estimate_llm_memory(model_id: str) -> float:
    """
    Estimate GPU memory required for an LLM model.
    
    Args:
        model_id: HuggingFace model ID
        
    Returns:
        Estimated memory in MB
    """
    model_id_lower = model_id.lower()
    
    # Try to extract parameter count from model name
    # Patterns: "7b", "7B", "7-b", "7_b", "7 b"
    patterns = [
        r"(\d+\.?\d*)b",  # 7b, 7.5b, 0.5b
        r"(\d+\.?\d*)-b",
        r"(\d+\.?\d*)_b",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, model_id_lower)
        if match:
            param_count = float(match.group(1))
            # Find closest estimate
            closest_key = min(
                LLM_MEMORY_ESTIMATES.keys(),
                key=lambda k: abs(float(k.replace("B", "")) - param_count)
            )
            return LLM_MEMORY_ESTIMATES[closest_key]
    
    # Default estimate for unknown models
    logger.warning(f"Could not estimate memory for {model_id}, using default 14GB")
    return 14_000


async def load_llm(model_id: str) -> tuple[object, float]:
    """
    Load LLM model using vLLM.
    
    Args:
        model_id: HuggingFace model ID
        
    Returns:
        Tuple of (AsyncLLMEngine, estimated_memory_mb)
    """
    from vllm.engine.arg_utils import AsyncEngineArgs
    from vllm.engine.async_llm_engine import AsyncLLMEngine
    
    logger.info(f"Loading LLM model: {model_id}")
    
    engine_args = AsyncEngineArgs(
        model=model_id,
        tensor_parallel_size=TENSOR_PARALLEL_SIZE,
        gpu_memory_utilization=GPU_MEMORY_UTILIZATION,
        max_model_len=MAX_MODEL_LEN,
        trust_remote_code=True,
        dtype="auto",
    )
    
    engine = AsyncLLMEngine.from_engine_args(engine_args)
    memory_estimate = estimate_llm_memory(model_id)
    
    logger.info(f"LLM model {model_id} loaded, estimated memory: {memory_estimate}MB")
    return engine, memory_estimate


async def unload_llm(engine: object) -> float:
    """
    Unload LLM model and free GPU memory.
    
    vLLM uses subprocess workers that hold GPU memory. We need to aggressively
    terminate them to free memory for other models.
    
    Args:
        engine: vLLM AsyncLLMEngine instance
        
    Returns:
        Estimated freed memory in MB
    """
    import os
    import signal
    
    logger.info("Unloading LLM model...")
    
    # Get GPU memory before (using pynvml for accurate reading)
    memory_before = _get_gpu_used_mb()
    
    # Collect vLLM worker PIDs before shutdown
    worker_pids = []
    try:
        if hasattr(engine, "engine") and hasattr(engine.engine, "model_executor"):
            executor = engine.engine.model_executor
            if hasattr(executor, "workers"):
                for worker in executor.workers:
                    if hasattr(worker, "process") and worker.process:
                        worker_pids.append(worker.process.pid)
            if hasattr(executor, "driver_worker"):
                if hasattr(executor.driver_worker, "process"):
                    worker_pids.append(executor.driver_worker.process.pid)
    except Exception as e:
        logger.debug(f"Could not collect worker PIDs: {e}")
    
    # Try graceful shutdown first
    try:
        if hasattr(engine, "shutdown"):
            logger.info("Calling engine.shutdown()...")
            await engine.shutdown()
        elif hasattr(engine, "shutdown_background_loop"):
            logger.info("Calling engine.shutdown_background_loop()...")
            engine.shutdown_background_loop()
    except Exception as e:
        logger.warning(f"Error during engine shutdown: {e}")
    
    # Delete engine reference
    del engine
    
    # Force garbage collection
    gc.collect()
    
    # Wait a bit for processes to terminate
    import asyncio
    await asyncio.sleep(0.5)
    
    # Kill any remaining worker processes
    for pid in worker_pids:
        try:
            os.kill(pid, signal.SIGKILL)
            logger.info(f"Killed vLLM worker process {pid}")
        except (ProcessLookupError, PermissionError):
            pass  # Process already dead
    
    # Clear CUDA cache
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    
    # Final GC
    gc.collect()
    
    # Wait for memory to be released
    await asyncio.sleep(1.0)
    
    memory_after = _get_gpu_used_mb()
    freed_memory = max(0, memory_before - memory_after)
    
    logger.info(f"LLM model unloaded, freed ~{freed_memory:.0f}MB (before: {memory_before:.0f}MB, after: {memory_after:.0f}MB)")
    return freed_memory


def _get_gpu_used_mb() -> float:
    """Get GPU used memory in MB using pynvml or torch fallback"""
    if not torch.cuda.is_available():
        return 0
    
    try:
        import pynvml
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        pynvml.nvmlShutdown()
        return mem_info.used / (1024 * 1024)
    except ImportError:
        # Fallback - but this won't see vLLM subprocess memory
        return torch.cuda.memory_reserved(0) / (1024 * 1024)



