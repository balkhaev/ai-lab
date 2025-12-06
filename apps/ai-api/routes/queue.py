"""
Task Queue API endpoints
"""
from fastapi import APIRouter, HTTPException, Query

from models.queue import (
    CreateTaskRequest,
    TaskResponse,
    TaskResultResponse,
    TaskListResponse,
    TaskStatus,
)
from services.queue import (
    create_task,
    get_task,
    cancel_task,
    get_user_tasks,
    get_queue_stats,
)

router = APIRouter(prefix="/tasks", tags=["Task Queue"])


@router.post(
    "",
    response_model=TaskResponse,
    summary="Create a new task",
    description="Create a new task and add it to the processing queue",
)
async def create_new_task(request: CreateTaskRequest):
    """Create a new task"""
    task = await create_task(
        task_type=request.type,
        params=request.params,
        user_id=request.user_id,
    )
    
    return TaskResponse(
        id=task.id,
        type=task.type,
        status=task.status,
        progress=task.progress,
        error=task.error,
        created_at=task.created_at,
        updated_at=task.updated_at,
        user_id=task.user_id,
    )


@router.get(
    "",
    response_model=TaskListResponse,
    summary="List tasks",
    description="Get a list of tasks, optionally filtered by user",
)
async def list_tasks(
    user_id: str | None = Query(None, description="Filter by user ID"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of tasks to return"),
):
    """List tasks for a user"""
    if user_id:
        tasks = await get_user_tasks(user_id, limit)
    else:
        # Without user_id, return empty list (require user_id for security)
        tasks = []
    
    task_responses = [
        TaskResponse(
            id=task.id,
            type=task.type,
            status=task.status,
            progress=task.progress,
            error=task.error,
            created_at=task.created_at,
            updated_at=task.updated_at,
            user_id=task.user_id,
        )
        for task in tasks
    ]
    
    return TaskListResponse(tasks=task_responses, total=len(task_responses))


@router.get(
    "/stats",
    summary="Get queue statistics",
    description="Get statistics about the task queue",
)
async def get_stats():
    """Get queue statistics"""
    stats = await get_queue_stats()
    return stats


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Get task status",
    description="Get the current status of a task",
)
async def get_task_status(task_id: str):
    """Get task status"""
    task = await get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return TaskResponse(
        id=task.id,
        type=task.type,
        status=task.status,
        progress=task.progress,
        error=task.error,
        created_at=task.created_at,
        updated_at=task.updated_at,
        user_id=task.user_id,
    )


@router.get(
    "/{task_id}/result",
    response_model=TaskResultResponse,
    summary="Get task result",
    description="Get the result of a completed task (includes base64 data)",
)
async def get_task_result(task_id: str):
    """Get task result with data"""
    task = await get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status not in (TaskStatus.COMPLETED, TaskStatus.FAILED):
        raise HTTPException(
            status_code=400,
            detail=f"Task is not completed yet. Current status: {task.status.value}"
        )
    
    return TaskResultResponse(
        id=task.id,
        type=task.type,
        status=task.status,
        result=task.result,
        error=task.error,
    )


@router.post(
    "/{task_id}/cancel",
    response_model=TaskResponse,
    summary="Cancel a task",
    description="Cancel a pending or processing task",
)
async def cancel_task_endpoint(task_id: str):
    """Cancel a task"""
    task = await cancel_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return TaskResponse(
        id=task.id,
        type=task.type,
        status=task.status,
        progress=task.progress,
        error=task.error,
        created_at=task.created_at,
        updated_at=task.updated_at,
        user_id=task.user_id,
    )
