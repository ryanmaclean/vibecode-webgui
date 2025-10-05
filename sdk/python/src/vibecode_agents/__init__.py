"""
VibeCode Agents SDK

Production-ready Python client for VibeCode's OpenAI Agents integration.
Provides async/await support, streaming, tool registration, and CLI management.

Example:
    >>> from vibecode_agents import AgentClient
    >>> async with AgentClient() as client:
    ...     agent = await client.start_agent(
    ...         agent_type="aider",
    ...         workspace="/home/coder/workspace",
    ...         model="claude-3-5-sonnet-20241022",
    ...         task="Add type hints to all functions"
    ...     )
    ...     async for event in client.stream_events(agent.agent_id):
    ...         print(event.data)
"""

from vibecode_agents.client import AgentClient
from vibecode_agents.models import (
    AgentResponse,
    AgentStatus,
    AgentStatusResponse,
    AgentType,
    ModelType,
    StartAgentRequest,
)
from vibecode_agents.streaming import EventStream, WebSocketStream
from vibecode_agents.tools import Tool, tool

__version__ = "0.1.0"
__all__ = [
    "AgentClient",
    "AgentResponse",
    "AgentStatus",
    "AgentStatusResponse",
    "AgentType",
    "EventStream",
    "ModelType",
    "StartAgentRequest",
    "Tool",
    "WebSocketStream",
    "tool",
]
