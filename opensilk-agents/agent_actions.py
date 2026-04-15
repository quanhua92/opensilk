import logging

import httpx

logger = logging.getLogger(__name__)


class AgentActions:
    """Thin wrapper for agent-scoped actions on the Hub API.

    Uses the agent JWT returned by get_task_context to post comments,
    update cards, and update context summaries on behalf of the agent.
    """

    def __init__(self, hub_url: str, context: dict):
        self.base_url = hub_url.rstrip("/")
        self.token = context["token"]
        self.workspace_id = context["workspace_id"]
        self.board_id = context["board_id"]
        self.card_id = context["card_id"]
        self.agent_name = context["agent_name"]

        self._headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient() as client:
            resp = await client.request(method, url, headers=self._headers, **kwargs)
            resp.raise_for_status()
            return resp

    async def post_comment(self, content: str) -> dict:
        """Post a comment on the linked card as the agent."""
        resp = await self._request(
            "POST",
            f"/workspaces/{self.workspace_id}/boards/{self.board_id}"
            f"/cards/{self.card_id}/comments",
            json={"content": content},
        )
        logger.info("Agent %s posted comment on card %s", self.agent_name, self.card_id)
        return resp.json()

    async def update_card(self, patches: dict) -> dict:
        """Update fields on the linked card (title, description, status, etc.)."""
        resp = await self._request(
            "PATCH",
            f"/workspaces/{self.workspace_id}/boards/{self.board_id}"
            f"/cards/{self.card_id}",
            json=patches,
        )
        logger.info("Agent %s updated card %s: %s", self.agent_name, self.card_id, list(patches.keys()))
        return resp.json()

    async def update_context_summary(self, summary: str) -> dict:
        """Update the context_summary field on the linked card."""
        return await self.update_card({"context_summary": summary})
