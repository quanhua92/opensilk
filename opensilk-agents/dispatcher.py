import logging
from uuid import UUID

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
    task_type: str, task_name: str, task_id: UUID, input_data: dict | None
) -> dict:
    """Dispatch a task to the appropriate handler based on type and name."""
    type_handlers = REGISTRY.get(task_type)
    if not type_handlers:
        raise ValueError(f"Unknown task type: {task_type}")

    handler = type_handlers.get(task_name)
    if not handler:
        raise ValueError(f"Unknown task name '{task_name}' for type '{task_type}'")

    logger.info("Dispatching task %s (%s/%s)", task_id, task_type, task_name)
    result = await handler(input_data or {})
    return result
