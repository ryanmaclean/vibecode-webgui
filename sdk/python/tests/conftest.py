"""
Pytest configuration and shared fixtures

Provides test fixtures and configuration for SDK testing.
"""

import pytest
from unittest.mock import AsyncMock, Mock
from typing import AsyncGenerator, Generator

from vibecode_agents.client import AgentClient
from vibecode_agents.models import (
    AgentResponse,
    AgentStatus,
    AgentStatusResponse,
    AgentType,
    HealthResponse,
    HealthStatus,
    ModelType,
)


@pytest.fixture
def mock_agent_response() -> AgentResponse:
    """Mock AgentResponse for testing"""
    return AgentResponse(
        agent_id="aider-12345678",
        status=AgentStatus.RUNNING,
        terminal_id="term-87654321",
        pid=1234,
        command="aider --model claude-3-5-sonnet-20241022",
        created_at="2025-10-02T10:00:00Z",
        stream_url="/api/agents/aider-12345678/events",
        ws_url="/api/agents/aider-12345678/ws",
    )


@pytest.fixture
def mock_agent_status_response() -> AgentStatusResponse:
    """Mock AgentStatusResponse for testing"""
    return AgentStatusResponse(
        agent_id="aider-12345678",
        status=AgentStatus.RUNNING,
        terminal_id="term-87654321",
        pid=1234,
        command="aider --model claude-3-5-sonnet-20241022",
        created_at="2025-10-02T10:00:00Z",
        stream_url="/api/agents/aider-12345678/events",
        ws_url="/api/agents/aider-12345678/ws",
        agent_type=AgentType.AIDER,
        workspace="/home/coder/workspace",
        uptime_seconds=120.5,
        exit_code=None,
        output_lines=42,
        last_output="Processing files...",
        last_output_at="2025-10-02T10:02:00Z",
    )


@pytest.fixture
def mock_health_response() -> HealthResponse:
    """Mock HealthResponse for testing"""
    return HealthResponse(
        status=HealthStatus.HEALTHY,
        version="1.0.0",
        timestamp="2025-10-02T10:00:00Z",
        uptime_seconds=3600.0,
    )


@pytest.fixture
async def mock_client() -> AsyncGenerator[AgentClient, None]:
    """Mock AgentClient for testing"""
    client = AgentClient(base_url="http://test.localhost/api")

    # Mock the internal HTTP client
    client._client.request = AsyncMock()

    yield client

    await client.close()


@pytest.fixture
def sample_workspace() -> str:
    """Sample workspace path for testing"""
    return "/home/coder/workspace/test-project"


@pytest.fixture
def sample_files() -> list[str]:
    """Sample file list for testing"""
    return ["src/main.py", "src/utils.py", "tests/test_main.py"]
