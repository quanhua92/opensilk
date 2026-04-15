import logging
import os
from uuid import UUID

from agent_actions import AgentActions
from workflows.hello_agents import run_hello_agents
from agents.openclaw import run_openclaw

logger = logging.getLogger(__name__)

REGISTRY = {
    "workflow": {
        "hello_agents": run_hello_agents,
    },
    "agentic": {
        "openclaw": run_openclaw,
    },
}


async def dispatch(
    task_type: str,
    task_name: str,
    task_id: UUID,
    input_data: dict | None,
    context: dict | None = None,
) -> dict:
    """Dispatch a task to the appropriate handler based on type and name.

    If context is provided (from get_task_context), agentic handlers receive
    the agent persona as a system prompt hint and an AgentActions instance
    for posting comments and updating cards.
    """
    type_handlers = REGISTRY.get(task_type)
    if not type_handlers:
        raise ValueError(f"Unknown task type: {task_type}")

    handler = type_handlers.get(task_name)
    if not handler:
        raise ValueError(f"Unknown task name '{task_name}' for type '{task_type}'")

    logger.info("Dispatching task %s (%s/%s)", task_id, task_type, task_name)

    # For agentic tasks with context, inject persona and actions
    kwargs: dict = {"input_data": input_data or {}}
    if context and task_type == "agentic":
        kwargs["agent_persona"] = context.get("agent_persona", "")
        kwargs["agent_name"] = context.get("agent_name", "")
        hub_url = os.environ.get("HUB_URL", "http://localhost:8080")
        kwargs["actions"] = AgentActions(hub_url, context)
        logger.info(
            "Task %s has agent context: %s (card %s)",
            task_id,
            context.get("agent_name"),
            context.get("card_id"),
        )

    result = await handler(**kwargs)
    return result
