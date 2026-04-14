import logging
import os

import httpx

logger = logging.getLogger(__name__)


class HubClient:
    """Async HTTP client for the OpenSilk worker API."""

    def __init__(self, hub_url: str, token: str):
        self.base_url = hub_url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient() as client:
            resp = await client.request(method, url, headers=self._headers, **kwargs)
            resp.raise_for_status()
            return resp

    async def claim_task(self, task_id: str | None = None) -> dict | None:
        """Claim a task by ID (from Redis Stream) or grab the first pending task."""
        if task_id:
            return await self._claim_by_id(task_id)
        return await self._claim_next_pending()

    async def _claim_by_id(self, task_id: str) -> dict | None:
        """Claim a specific task by PATCHing its status to running."""
        try:
            resp = await self._request(
                "PATCH",
                f"/worker/tasks/{task_id}",
                json={"status": "running"},
            )
            return resp.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def _claim_next_pending(self) -> dict | None:
        """Get the first pending task and claim it."""
        try:
            resp = await self._request("GET", "/worker/tasks?status=pending")
            tasks = resp.json()
            if not tasks:
                return None

            task_id = tasks[0]["id"]
            return await self._claim_by_id(task_id)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def complete_task(self, task_id: str, output_data: dict):
        """Mark a task as completed with output."""
        await self._request(
            "PATCH",
            f"/worker/tasks/{task_id}",
            json={"status": "completed", "output_data": output_data},
        )

    async def retry_task(self, task_id: str, error_log: str):
        """Signal a retry. Rust handler decides pending vs failed."""
        await self._request(
            "PATCH",
            f"/worker/tasks/{task_id}",
            json={"retry": True, "error_log": error_log},
        )

    async def update_heartbeat(self, task_id: str):
        """Update last_heartbeat_at by patching status to running."""
        try:
            await self._request(
                "PATCH",
                f"/worker/tasks/{task_id}",
                json={"status": "running"},
            )
        except Exception as e:
            logger.warning("Heartbeat failed for task %s: %s", task_id, e)


def create_client() -> HubClient:
    hub_url = os.environ.get("HUB_URL", "http://localhost:8080")
    token = os.environ.get("WORKER_TOKEN", "")
    if not token:
        raise ValueError("WORKER_TOKEN environment variable must be set")
    return HubClient(hub_url, token)
