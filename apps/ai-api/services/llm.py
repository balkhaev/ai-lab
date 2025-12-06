"""
LLM service - inference utilities
"""
import json
import logging
import uuid
from typing import AsyncGenerator

from models.llm import ChatMessage

logger = logging.getLogger(__name__)


def format_chat_prompt(messages: list[ChatMessage], model_id: str) -> str:
    """Format messages into ChatML format for Hermes models"""
    formatted = ""
    for msg in messages:
        formatted += f"<|im_start|>{msg.role}\n{msg.content}<|im_end|>\n"
    formatted += "<|im_start|>assistant\n"
    return formatted


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
