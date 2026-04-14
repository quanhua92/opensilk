import asyncio
import logging

logger = logging.getLogger(__name__)


class Heartbeat:
    """Background task that updates task heartbeat every N seconds."""

    def __init__(self, client, task_id: str, workspace_id: str, interval: float = 30.0):
        self.client = client
        self.task_id = task_id
        self.workspace_id = workspace_id
        self.interval = interval
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

    async def start(self):
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run())
        logger.info(
            "Heartbeat started for task %s (interval=%.1fs)", self.task_id, self.interval
        )

    async def stop(self):
        self._stop_event.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Heartbeat stopped for task %s", self.task_id)

    async def _run(self):
        while not self._stop_event.is_set():
            try:
                await self.client.update_heartbeat(self.workspace_id, self.task_id)
                logger.debug("Heartbeat updated for task %s", self.task_id)
            except Exception as e:
                logger.warning("Failed to update heartbeat for task %s: %s", self.task_id, e)
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval)
            except asyncio.TimeoutError:
                continue
