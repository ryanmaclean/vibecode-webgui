
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

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

# Tracing imports (optional - requires [datadog] extra)
try:
    from vibecode_agents.tracing import (
        init_datadog,
        trace,
        get_current_trace_context,
        setup_logging,
    )
    _TRACING_AVAILABLE = True
except ImportError:
    init_datadog = None  # type: ignore
    trace = None  # type: ignore
    get_current_trace_context = None  # type: ignore
    setup_logging = None  # type: ignore
    _TRACING_AVAILABLE = False

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
    # Tracing (optional)
    "init_datadog",
    "trace",
    "get_current_trace_context",
    "setup_logging",
]