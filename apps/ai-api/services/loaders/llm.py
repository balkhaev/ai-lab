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
    
    Args:
        engine: vLLM AsyncLLMEngine instance
        
    Returns:
        Estimated freed memory in MB
    """
    memory_before = torch.cuda.memory_allocated(0) / (1024 * 1024) if torch.cuda.is_available() else 0
    
    try:
        # Shutdown the vLLM engine
        if hasattr(engine, "shutdown"):
            await engine.shutdown()
        elif hasattr(engine, "shutdown_background_loop"):
            engine.shutdown_background_loop()
        elif hasattr(engine, "_abort_all"):
            await engine._abort_all()
    except Exception as e:
        logger.warning(f"Error during engine shutdown: {e}")
    
    # Force garbage collection and clear CUDA cache
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    
    memory_after = torch.cuda.memory_allocated(0) / (1024 * 1024) if torch.cuda.is_available() else 0
    freed_memory = max(0, memory_before - memory_after)
    
    logger.info(f"LLM model unloaded, freed ~{freed_memory:.0f}MB")
    return freed_memory
