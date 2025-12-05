"""
LLM service - model loading and inference
"""
import json
import logging
import uuid
from typing import AsyncGenerator

from config import (
    TENSOR_PARALLEL_SIZE,
    GPU_MEMORY_UTILIZATION,
    MAX_MODEL_LEN,
)
from models.llm import ChatMessage
from state import model_info

logger = logging.getLogger(__name__)


def format_chat_prompt(messages: list[ChatMessage], model_id: str) -> str:
    """Format messages into ChatML format for Hermes models"""
    formatted = ""
    for msg in messages:
        formatted += f"<|im_start|>{msg.role}\n{msg.content}<|im_end|>\n"
    formatted += "<|im_start|>assistant\n"
    return formatted


async def load_llm_model(model_id: str):
    """Load a model using vLLM AsyncEngine"""
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

    model_info[model_id] = {
        "name": model_id.split("/")[-1],
        "size": 0,
        "loaded": True,
    }

    logger.info(f"LLM model {model_id} loaded successfully")
    return engine


async def generate_llm_stream(
    engine,
    prompt: str,
    sampling_params,
    model_name: str,
) -> AsyncGenerator[str, None]:
    """Generate streaming LLM response"""
    request_id = str(uuid.uuid4())

    results_generator = engine.generate(prompt, sampling_params, request_id)

    full_text = ""
    async for request_output in results_generator:
        if request_output.outputs:
            output = request_output.outputs[0]
            new_text = output.text[len(full_text):]
            full_text = output.text

            if new_text:
                data = json.dumps({
                    "message": {"content": new_text},
                    "model": model_name,
                    "done": False
                })
                yield f"data: {data}\n\n"

    data = json.dumps({
        "message": {"content": ""},
        "model": model_name,
        "done": True
    })
    yield f"data: {data}\n\n"
