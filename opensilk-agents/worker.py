import asyncio
import logging
import os

import redis.asyncio as aioredis

from api import HubClient
from heartbeat import Heartbeat
from dispatcher import dispatch

logger = logging.getLogger(__name__)

POLL_INTERVAL = 5.0  # seconds between polling when no tasks
STREAM_BLOCK_MS = 5000  # milliseconds to block on Redis XREAD


async def run_task(client: HubClient, task: dict) -> str:
    """Execute a single task with heartbeat and error handling."""
    task_id = task["id"]
    heartbeat = Heartbeat(client, task_id)
    await heartbeat.start()

    try:
        output = await dispatch(
            task["type"],
            task["name"],
            task_id,
            task.get("input_data"),
        )
        await client.complete_task(task_id, output)
        logger.info("Task %s completed successfully", task_id)
        return "completed"
    except Exception as e:
        logger.error("Task %s failed: %s", task_id, e)
        await client.retry_task(task_id, str(e))
        return "retrying_or_failed"
    finally:
        await heartbeat.stop()


async def poll_with_stream(client: HubClient, worker_id: str):
    """Poll loop with Redis Stream notifications for instant task pickup."""
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    r = aioredis.from_url(redis_url, decode_responses=True)

    logger.info("Worker %s starting with Redis Stream", worker_id)

    last_id = "0-0"

    try:
        while True:
            try:
                results = await r.xread(
                    {"tasks:pending": last_id},
                    block=STREAM_BLOCK_MS,
                    count=10,
                )

                task_id = None
                if results:
                    for _stream_name, messages in results:
                        for msg_id, fields in messages:
                            last_id = msg_id
                            logger.debug("Received stream event: %s", msg_id)
                            data = fields.get("data")
                            if data:
                                import json
                                event = json.loads(data)
                                task_id = event.get("task_id")

                task = await client.claim_task(task_id)
                if task:
                    logger.info(
                        "Worker %s claimed task %s (%s/%s)",
                        worker_id, task["id"], task["type"], task["name"],
                    )
                    await run_task(client, task)

            except asyncio.CancelledError:
                logger.info("Worker %s shutting down", worker_id)
                break
            except Exception as e:
                logger.error("Worker %s poll error: %s", worker_id, e)
                await asyncio.sleep(POLL_INTERVAL)
    finally:
        await r.aclose()


async def poll_without_stream(client: HubClient, worker_id: str):
    """Fallback polling loop when Redis is not available."""
    logger.info("Worker %s starting in polling mode (no Redis)", worker_id)

    while True:
        try:
            task = await client.claim_task()
            if task:
                logger.info(
                    "Worker %s claimed task %s (%s/%s)",
                    worker_id, task["id"], task["type"], task["name"],
                )
                await run_task(client, task)
            else:
                await asyncio.sleep(POLL_INTERVAL)
        except asyncio.CancelledError:
            logger.info("Worker %s shutting down", worker_id)
            break
        except Exception as e:
            logger.error("Worker %s poll error: %s", worker_id, e)
            await asyncio.sleep(POLL_INTERVAL)


async def start(worker_id: str, use_redis: bool = True):
    """Start the worker loop."""
    from api import create_client

    client = create_client()

    if use_redis:
        try:
            await poll_with_stream(client, worker_id)
            return
        except Exception as e:
            logger.warning("Redis unavailable, falling back to polling: %s", e)

    await poll_without_stream(client, worker_id)
