from langgraph.graph import StateGraph, START, END
from typing import TypedDict


class HelloState(TypedDict):
    name: str
    greeting: str


def build_greeting(state: HelloState) -> HelloState:
    name = state.get("name", "World")
    return {"greeting": f"Hello, {name}! Welcome to OpenSilk agents."}


def build_graph() -> StateGraph:
    graph = StateGraph(HelloState)
    graph.add_node("greet", build_greeting)
    graph.add_edge(START, "greet")
    graph.add_edge("greet", END)
    return graph.compile()


async def run_hello_agents(input_data: dict) -> dict:
    """Simple LangGraph workflow that returns a greeting."""
    graph = build_graph()
    result = await graph.ainvoke({"name": input_data.get("name", "World")})
    return {"greeting": result["greeting"]}
