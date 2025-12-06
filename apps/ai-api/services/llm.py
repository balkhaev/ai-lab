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


def _get_content_text(content, is_vision_model: bool = False) -> str:
    """Extract text from message content (string or list of parts)"""
    if isinstance(content, str):
        return content
    
    text_parts = []
    for part in content:
        if isinstance(part, TextContent):
            text_parts.append(part.text)
        elif isinstance(part, ImageContent) and is_vision_model:
            text_parts.append("<|vision_start|><|image_pad|><|vision_end|>")
        elif isinstance(part, dict):
            if part.get("type") == "text":
                text_parts.append(part.get("text", ""))
            elif part.get("type") == "image_url" and is_vision_model:
                text_parts.append("<|vision_start|><|image_pad|><|vision_end|>")
    
    return "".join(text_parts)


def _detect_prompt_format(model_id: str) -> str:
    """Detect prompt format based on model ID"""
    model_id_lower = model_id.lower()
    
    # Mistral-based models
    if any(name in model_id_lower for name in ["mistral", "nemo", "marinara"]):
        return "mistral"
    
    # LLaMA 2 style
    if "llama-2" in model_id_lower or "llama2" in model_id_lower:
        return "llama2"
    
    # Default to ChatML (Qwen, most modern models)
    return "chatml"


def format_chat_prompt(messages: list[ChatMessage], model_id: str, prompt_format: str | None = None) -> str:
    """
    Format messages into the appropriate prompt format.
    
    Args:
        messages: List of chat messages
        model_id: HuggingFace model ID
        prompt_format: Optional explicit format ("chatml", "mistral", "llama2")
                      If not provided, will be auto-detected from model_id
    
    Returns:
        Formatted prompt string
    """
    if prompt_format is None:
        prompt_format = _detect_prompt_format(model_id)
    
    is_vision_model = "VL" in model_id.upper() or "VISION" in model_id.upper()
    
    if prompt_format == "mistral":
        return _format_mistral(messages, is_vision_model)
    elif prompt_format == "llama2":
        return _format_llama2(messages, is_vision_model)
    else:  # chatml (default)
        return _format_chatml(messages, is_vision_model)


def _format_chatml(messages: list[ChatMessage], is_vision_model: bool) -> str:
    """Format messages in ChatML format (Qwen, etc.)"""
    formatted = ""
    
    for msg in messages:
        formatted += f"<|im_start|>{msg.role}\n"
        formatted += _get_content_text(msg.content, is_vision_model)
        formatted += "<|im_end|>\n"
    
    formatted += "<|im_start|>assistant\n"
    return formatted


def _format_mistral(messages: list[ChatMessage], is_vision_model: bool) -> str:
    """
    Format messages in Mistral Instruct format.
    
    Official format from MistralAI:
    <s>[INST]{system}[/INST]{response}</s>[INST]{user's message}[/INST]
    
    The system prompt goes inside the first [INST] block.
    """
    formatted = "<s>"
    system_prompt = ""
    
    # Extract system prompt if present
    non_system_messages = []
    for msg in messages:
        if msg.role == "system":
            system_prompt = _get_content_text(msg.content, is_vision_model)
        else:
            non_system_messages.append(msg)
    
    # Build conversation
    is_first_user = True
    for msg in non_system_messages:
        content = _get_content_text(msg.content, is_vision_model)
        
        if msg.role == "user":
            if is_first_user and system_prompt:
                # Include system prompt in first user instruction
                formatted += f"[INST]{system_prompt}\n\n{content}[/INST]"
                is_first_user = False
            else:
                formatted += f"[INST]{content}[/INST]"
        elif msg.role == "assistant":
            formatted += f"{content}</s>"
    
    return formatted


def _format_llama2(messages: list[ChatMessage], is_vision_model: bool) -> str:
    """Format messages in LLaMA 2 chat format"""
    formatted = "<s>"
    system_prompt = ""
    
    # Extract system prompt if present
    non_system_messages = []
    for msg in messages:
        if msg.role == "system":
            system_prompt = _get_content_text(msg.content, is_vision_model)
        else:
            non_system_messages.append(msg)
    
    # Add system prompt
    if system_prompt:
        formatted += f"[INST] <<SYS>>\n{system_prompt}\n<</SYS>>\n\n"
    
    # Build conversation
    for i, msg in enumerate(non_system_messages):
        content = _get_content_text(msg.content, is_vision_model)
        
        if msg.role == "user":
            if i == 0 and not system_prompt:
                formatted += f"[INST] {content} [/INST]"
            elif i == 0:
                formatted += f"{content} [/INST]"
            else:
                formatted += f"[INST] {content} [/INST]"
        elif msg.role == "assistant":
            formatted += f" {content} </s>"
    
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
