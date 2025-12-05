"""
LLM endpoints - chat and model comparison
"""
import json
import time
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.llm import ChatRequest, CompareRequest
from services.llm import format_chat_prompt, generate_llm_stream
from state import llm_engines, model_info

router = APIRouter(prefix="/api", tags=["LLM"])


@router.get(
    "/tags",
    summary="List models",
    description="Returns a list of available LLM models",
)
async def list_models():
    """List available LLM models"""
    models = []
    for model_id, info in model_info.items():
        models.append({
            "name": info["name"],
            "size": info["size"],
            "modified_at": "",
        })
    return {"models": models}


@router.post(
    "/chat",
    summary="Chat completion",
    description="Generate a chat completion using the specified model",
)
async def chat(request: ChatRequest):
    """Chat with a model"""
    from vllm import SamplingParams

    # Find engine by model name
    engine = None
    model_id = None

    for mid, eng in llm_engines.items():
        if request.model in mid or request.model == model_info.get(mid, {}).get("name"):
            engine = eng
            model_id = mid
            break

    if not engine:
        raise HTTPException(status_code=404, detail=f"Model {request.model} not found")

    prompt = format_chat_prompt(request.messages, model_id)

    sampling_params = SamplingParams(
        temperature=request.temperature,
        top_p=request.top_p,
        top_k=request.top_k,
        max_tokens=request.max_tokens,
    )

    if request.stream:
        return StreamingResponse(
            generate_llm_stream(engine, prompt, sampling_params, request.model),
            media_type="text/event-stream",
        )

    # Non-streaming response
    request_id = str(uuid.uuid4())
    start_time = time.time()

    results = []
    async for output in engine.generate(prompt, sampling_params, request_id):
        results.append(output)

    final_output = results[-1] if results else None

    if not final_output or not final_output.outputs:
        raise HTTPException(status_code=500, detail="Generation failed")

    generated_text = final_output.outputs[0].text
    total_duration = int((time.time() - start_time) * 1e9)

    return {
        "model": request.model,
        "message": {
            "role": "assistant",
            "content": generated_text,
        },
        "done": True,
        "total_duration": total_duration,
        "eval_count": len(generated_text.split()),
    }


@router.post(
    "/compare",
    summary="Compare models",
    description="Compare responses from multiple models for the same prompt",
)
async def compare_models(request: CompareRequest):
    """Compare multiple models (streaming)"""
    from vllm import SamplingParams

    async def generate_comparison():
        start_time = time.time()

        prompt = format_chat_prompt(request.messages, "")

        sampling_params = SamplingParams(
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
            max_tokens=request.max_tokens,
        )

        for model_name in request.models:
            engine = None

            for mid, eng in llm_engines.items():
                if model_name in mid or model_name == model_info.get(mid, {}).get("name"):
                    engine = eng
                    break

            if not engine:
                data = json.dumps({
                    "model": model_name,
                    "error": "Model not found",
                    "done": True
                })
                yield f"event: model_error\ndata: {data}\n\n"
                continue

            model_start_time = time.time()
            request_id = str(uuid.uuid4())
            full_content = ""

            async for request_output in engine.generate(prompt, sampling_params, request_id):
                if request_output.outputs:
                    output = request_output.outputs[0]
                    new_text = output.text[len(full_content):]
                    full_content = output.text

                    if new_text:
                        data = json.dumps({
                            "model": model_name,
                            "content": new_text,
                            "done": False
                        })
                        yield f"event: chunk\ndata: {data}\n\n"

            duration = int((time.time() - model_start_time) * 1000)
            data = json.dumps({
                "model": model_name,
                "fullContent": full_content,
                "duration": duration
            })
            yield f"event: model_done\ndata: {data}\n\n"

        total_duration = int((time.time() - start_time) * 1000)
        data = json.dumps({"totalDuration": total_duration})
        yield f"event: all_done\ndata: {data}\n\n"

    return StreamingResponse(
        generate_comparison(),
        media_type="text/event-stream",
    )
