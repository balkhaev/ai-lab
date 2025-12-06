"""
LLM service - inference utilities
"""
import base64
import json
import logging
import uuid
from io import BytesIO
from typing import AsyncGenerator

from PIL import Image

from models.llm import ChatMessage, ImageContent, TextContent

logger = logging.getLogger(__name__)


def extract_images_from_messages(messages: list[ChatMessage]) -> list[Image.Image]:
    """Extract PIL images from messages with multimodal content"""
    images = []

    for msg in messages:
        if isinstance(msg.content, list):
            for part in msg.content:
                if isinstance(part, ImageContent):
                    url = part.image_url.url
                    # Handle base64 data URLs
                    if url.startswith("data:image"):
                        # Extract base64 data after comma
                        base64_data = url.split(",", 1)[1]
                        image_bytes = base64.b64decode(base64_data)
                        image = Image.open(BytesIO(image_bytes)).convert("RGB")
                        images.append(image)
                    else:
                        # TODO: Handle external URLs if needed
                        logger.warning(f"External image URLs not supported yet: {url[:50]}...")

    return images


def format_chat_prompt(messages: list[ChatMessage], model_id: str) -> str:
    """Format messages into ChatML format with vision support for Qwen-VL models"""
    formatted = ""
    is_vision_model = "VL" in model_id.upper() or "VISION" in model_id.upper()

    for msg in messages:
        formatted += f"<|im_start|>{msg.role}\n"

        if isinstance(msg.content, str):
            formatted += msg.content
        elif isinstance(msg.content, list):
            for part in msg.content:
                if isinstance(part, TextContent):
                    formatted += part.text
                elif isinstance(part, ImageContent) and is_vision_model:
                    # Add vision tokens for Qwen-VL
                    formatted += "<|vision_start|><|image_pad|><|vision_end|>"
                elif isinstance(part, dict):
                    # Handle dict format (from JSON)
                    if part.get("type") == "text":
                        formatted += part.get("text", "")
                    elif part.get("type") == "image_url" and is_vision_model:
                        formatted += "<|vision_start|><|image_pad|><|vision_end|>"

        formatted += "<|im_end|>\n"

    formatted += "<|im_start|>assistant\n"
    return formatted


def extract_images_from_message_dicts(messages: list[dict]) -> list[Image.Image]:
    """Extract PIL images from message dictionaries"""
    images = []

    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "image_url":
                    image_url = part.get("image_url", {})
                    url = image_url.get("url", "") if isinstance(image_url, dict) else ""
                    if url.startswith("data:image"):
                        base64_data = url.split(",", 1)[1]
                        image_bytes = base64.b64decode(base64_data)
                        image = Image.open(BytesIO(image_bytes)).convert("RGB")
                        images.append(image)

    return images


async def generate_llm_stream(
    engine,
    prompt: str,
    sampling_params,
    model_name: str,
    images: list[Image.Image] | None = None,
) -> AsyncGenerator[str, None]:
    """Generate streaming LLM response with optional image support"""
    request_id = str(uuid.uuid4())

    # Prepare inputs for multimodal models
    inputs = {"prompt": prompt}
    if images:
        inputs["multi_modal_data"] = {"image": images}

    results_generator = engine.generate(inputs, sampling_params, request_id)

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
