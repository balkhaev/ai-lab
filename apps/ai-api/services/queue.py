"""
Task Queue Service - Redis-based task management
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as redis

from config import REDIS_URL, TASK_TTL_HOURS
from models.queue import Task, TaskStatus, TaskType

logger = logging.getLogger(__name__)

# Redis key prefixes
TASK_KEY_PREFIX = "task:"
PENDING_QUEUE_KEY = "queue:pending"
PROCESSING_SET_KEY = "queue:processing"
USER_TASKS_PREFIX = "user:"
USER_TASKS_SUFFIX = ":tasks"

# Limits
MAX_USER_TASKS_HISTORY = 100

# Global Redis client
_redis_client: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    """Get or create Redis connection"""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


async def close_redis() -> None:
    """Close Redis connection"""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None


def _task_key(task_id: str) -> str:
    """Generate Redis key for a task"""
    return f"{TASK_KEY_PREFIX}{task_id}"


def _user_tasks_key(user_id: str) -> str:
    """Generate Redis key for user's task list"""
    return f"{USER_TASKS_PREFIX}{user_id}{USER_TASKS_SUFFIX}"


def _serialize_task(task: Task) -> dict[str, str]:
    """Serialize task to Redis hash format"""
    return {
        "id": task.id,
        "type": task.type.value,
        "status": task.status.value,
        "progress": str(task.progress),
        "params": json.dumps(task.params),
        "result": json.dumps(task.result) if task.result else "",
        "error": task.error or "",
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
        "user_id": task.user_id or "",
    }


def _deserialize_task(data: dict[str, str]) -> Task:
    """Deserialize task from Redis hash format"""
    return Task(
        id=data["id"],
        type=TaskType(data["type"]),
        status=TaskStatus(data["status"]),
        progress=float(data["progress"]),
        params=json.loads(data["params"]) if data.get("params") else {},
        result=json.loads(data["result"]) if data.get("result") else None,
        error=data.get("error") or None,
        created_at=datetime.fromisoformat(data["created_at"]),
        updated_at=datetime.fromisoformat(data["updated_at"]),
        user_id=data.get("user_id") or None,
    )


async def create_task(
    task_type: TaskType,
    params: dict[str, Any],
    user_id: str | None = None,
) -> Task:
    """
    Create a new task and add it to the pending queue.
    
    Args:
        task_type: Type of task to create
        params: Task parameters
        user_id: Optional user ID for tracking
        
    Returns:
        Created task object
    """
    r = await get_redis()
    
    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    task = Task(
        id=task_id,
        type=task_type,
        status=TaskStatus.PENDING,
        progress=0.0,
        params=params,
        result=None,
        error=None,
        created_at=now,
        updated_at=now,
        user_id=user_id,
    )
    
    # Store task in Redis
    task_key = _task_key(task_id)
    task_data = _serialize_task(task)
    await r.hset(task_key, mapping=task_data)
    
    # Set TTL on task
    ttl_seconds = TASK_TTL_HOURS * 3600
    await r.expire(task_key, ttl_seconds)
    
    # Add to pending queue
    await r.rpush(PENDING_QUEUE_KEY, task_id)
    
    # Add to user's task history
    if user_id:
        user_key = _user_tasks_key(user_id)
        await r.lpush(user_key, task_id)
        await r.ltrim(user_key, 0, MAX_USER_TASKS_HISTORY - 1)
        await r.expire(user_key, ttl_seconds)
    
    logger.info(f"Created task {task_id} of type {task_type.value}")
    return task


async def get_task(task_id: str) -> Task | None:
    """
    Get a task by ID.
    
    Args:
        task_id: Task ID to retrieve
        
    Returns:
        Task object or None if not found
    """
    r = await get_redis()
    
    task_key = _task_key(task_id)
    data = await r.hgetall(task_key)
    
    if not data:
        return None
    
    return _deserialize_task(data)


async def update_task(
    task_id: str,
    status: TaskStatus | None = None,
    progress: float | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> Task | None:
    """
    Update task status, progress, result, or error.
    
    Args:
        task_id: Task ID to update
        status: New status (optional)
        progress: New progress value (optional)
        result: Task result data (optional)
        error: Error message (optional)
        
    Returns:
        Updated task object or None if not found
    """
    r = await get_redis()
    
    task = await get_task(task_id)
    if not task:
        return None
    
    updates: dict[str, str] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    if status is not None:
        task.status = status
        updates["status"] = status.value
        
        # Update queue sets based on status
        if status == TaskStatus.PROCESSING:
            await r.sadd(PROCESSING_SET_KEY, task_id)
        elif status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            await r.srem(PROCESSING_SET_KEY, task_id)
    
    if progress is not None:
        task.progress = progress
        updates["progress"] = str(progress)
    
    if result is not None:
        task.result = result
        updates["result"] = json.dumps(result)
    
    if error is not None:
        task.error = error
        updates["error"] = error
    
    task_key = _task_key(task_id)
    await r.hset(task_key, mapping=updates)
    
    logger.debug(f"Updated task {task_id}: status={status}, progress={progress}")
    return task


async def cancel_task(task_id: str) -> Task | None:
    """
    Cancel a pending or processing task.
    
    Args:
        task_id: Task ID to cancel
        
    Returns:
        Updated task or None if not found or already completed
    """
    task = await get_task(task_id)
    if not task:
        return None
    
    if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
        return task  # Already in terminal state
    
    r = await get_redis()
    
    # Remove from pending queue if present
    await r.lrem(PENDING_QUEUE_KEY, 0, task_id)
    
    # Update status
    return await update_task(task_id, status=TaskStatus.CANCELLED)


async def get_user_tasks(user_id: str, limit: int = 20) -> list[Task]:
    """
    Get tasks for a specific user.
    
    Args:
        user_id: User ID to get tasks for
        limit: Maximum number of tasks to return
        
    Returns:
        List of tasks
    """
    r = await get_redis()
    
    user_key = _user_tasks_key(user_id)
    task_ids = await r.lrange(user_key, 0, limit - 1)
    
    tasks = []
    for task_id in task_ids:
        task = await get_task(task_id)
        if task:
            tasks.append(task)
    
    return tasks


async def get_next_pending_task() -> str | None:
    """
    Get the next task from the pending queue.
    
    Returns:
        Task ID or None if queue is empty
    """
    r = await get_redis()
    
    # Use LPOP to get the oldest task (FIFO)
    task_id = await r.lpop(PENDING_QUEUE_KEY)
    return task_id


async def get_pending_count() -> int:
    """Get number of pending tasks"""
    r = await get_redis()
    return await r.llen(PENDING_QUEUE_KEY)


async def get_processing_count() -> int:
    """Get number of tasks currently processing"""
    r = await get_redis()
    return await r.scard(PROCESSING_SET_KEY)


async def get_queue_stats() -> dict[str, int]:
    """Get queue statistics"""
    return {
        "pending": await get_pending_count(),
        "processing": await get_processing_count(),
    }


async def cleanup_old_tasks() -> int:
    """
    Clean up old completed/failed tasks.
    This is automatically handled by Redis TTL, but can be called manually.
    
    Returns:
        Number of tasks cleaned up
    """
    # Redis TTL handles cleanup automatically
    # This function is here for potential manual cleanup needs
    logger.info("Task cleanup is handled automatically by Redis TTL")
    return 0

