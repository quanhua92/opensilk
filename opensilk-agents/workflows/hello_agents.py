import random
from langgraph.graph import StateGraph, START, END
from typing import TypedDict


class HelloState(TypedDict):
    name: str
    greeting: str
    mood: str
    response: str


def build_greeting(state: HelloState) -> HelloState:
    name = state.get("name", "World")
    return {"greeting": f"Hello, {name}!"}


def assess_mood(state: HelloState) -> HelloState:
    moods = ["cheerful", "curious", "philosophical"]
    return {"mood": random.choice(moods)}


def route_by_mood(state: HelloState) -> str:
    return state["mood"]


def respond_cheerful(state: HelloState) -> HelloState:
    return {"response": f"{state['greeting']} Great to have you here. The agents are fired up and ready!"}


def respond_curious(state: HelloState) -> HelloState:
    return {
        "response": f"{state['greeting']} Interesting name. Did you know OpenSilk "
        "uses a three-tier architecture: Dashboard, Hub, and Workers?"
    }


def respond_philosophical(state: HelloState) -> HelloState:
    return {
        "response": f"{state['greeting']} A name is just the start. "
        "What matters is what we build together — one task at a time."
    }


def build_graph() -> StateGraph:
    graph = StateGraph(HelloState)
    graph.add_node("greet", build_greeting)
    graph.add_node("assess_mood", assess_mood)
    graph.add_node("respond_cheerful", respond_cheerful)
    graph.add_node("respond_curious", respond_curious)
    graph.add_node("respond_philosophical", respond_philosophical)

    graph.add_edge(START, "greet")
    graph.add_edge("greet", "assess_mood")
    graph.add_conditional_edges("assess_mood", route_by_mood, {
        "cheerful": "respond_cheerful",
        "curious": "respond_curious",
        "philosophical": "respond_philosophical",
    })
    graph.add_edge("respond_cheerful", END)
    graph.add_edge("respond_curious", END)
    graph.add_edge("respond_philosophical", END)
    return graph.compile()


async def run_hello_agents(input_data: dict) -> dict:
    """Multi-step LangGraph workflow: greet, assess mood, branch to response."""
    graph = build_graph()
    result = await graph.ainvoke({"name": input_data.get("name", "World")})
    return {"greeting": result["greeting"], "mood": result["mood"], "response": result["response"]}
