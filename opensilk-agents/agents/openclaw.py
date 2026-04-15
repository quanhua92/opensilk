import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from agent_actions import AgentActions

logger = logging.getLogger(__name__)


async def run_openclaw(
    input_data: dict,
    agent_persona: str = "",
    agent_name: str = "",
    actions: "AgentActions | None" = None,
) -> dict:
    """Placeholder autonomous agent.

    When called with agent context (persona + actions), the agent can:
    - Use agent_persona as its system prompt
    - Post comments to the linked card via actions.post_comment()
    - Update the card via actions.update_card()
    - Update context summary via actions.update_context_summary()
    """
    logger.info("OpenClaw agent invoked with input: %s", input_data)

    if actions:
        logger.info(
            "OpenClaw running as agent '%s' on card %s",
            agent_name,
            actions.card_id,
        )
        # Post a comment announcing the agent is working
        await actions.post_comment(
            f"Agent {agent_name} started working on this card."
        )
        # Update context summary
        await actions.update_context_summary(
            f"Agent {agent_name} is processing this task."
        )
        return {
            "message": f"Agent {agent_name} completed processing",
            "agent": agent_name,
            "card_id": actions.card_id,
        }

    return {"message": "OpenClaw agent invoked without card context"}
