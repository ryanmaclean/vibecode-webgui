"""
Unit tests for AgentClient

Tests HTTP client functionality, error handling, and retry logic.
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
import httpx

from vibecode_agents.client import AgentClient
from vibecode_agents.exceptions import (
    AgentAPIError,
    AuthenticationError,
    NotFoundError,
    RateLimitError,
)
from vibecode_agents.models import (
    AgentType,
    HealthResponse,
    ModelType,
    StartAgentRequest,
)


@pytest.mark.unit
class TestAgentClient:
    """Test suite for AgentClient"""

    def test_client_initialization(self) -> None:
        """Test client initializes with correct defaults"""
        client = AgentClient()

        assert client.base_url == "http://localhost:3000/api"
        assert client.timeout == 30.0
        assert client.max_retries == 3
        assert client.api_key is None

    def test_client_with_custom_config(self) -> None:
        """Test client accepts custom configuration"""
        client = AgentClient(
            base_url="https://api.example.com",
            api_key="test-key",
            timeout=60.0,
            max_retries=5,
        )

        assert client.base_url == "https://api.example.com"
        assert client.api_key == "test-key"
        assert client.timeout == 60.0
        assert client.max_retries == 5

    @pytest.mark.asyncio
    async def test_context_manager(self) -> None:
        """Test client works as async context manager"""
        async with AgentClient() as client:
            assert client._client is not None

    @pytest.mark.asyncio
    async def test_get_health_success(
        self, mock_client: AgentClient, mock_health_response: HealthResponse
    ) -> None:
        """Test successful health check"""
        mock_client._client.request = AsyncMock(
            return_value=Mock(
                is_success=True,
                json=Mock(return_value=mock_health_response.model_dump()),
                headers={},
            )
        )

        health = await mock_client.get_health()

        assert health.status.value == "healthy"
        assert health.version == "1.0.0"

    @pytest.mark.asyncio
    async def test_start_agent_success(
        self, mock_client: AgentClient, mock_agent_response: AgentResponse
    ) -> None:
        """Test successful agent start"""
        mock_client._client.request = AsyncMock(
            return_value=Mock(
                is_success=True,
                json=Mock(return_value=mock_agent_response.model_dump()),
                headers={},
            )
        )

        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace="/home/coder/workspace",
            model=ModelType.CLAUDE_3_5_SONNET,
            task="Add type hints to all functions",
        )

        agent = await mock_client.start_agent(request)

        assert agent.agent_id == "aider-12345678"
        assert agent.status.value == "running"

    @pytest.mark.asyncio
    async def test_authentication_error(self, mock_client: AgentClient) -> None:
        """Test authentication error handling"""
        mock_client._client.request = AsyncMock(
            return_value=Mock(
                is_success=False,
                status_code=401,
                json=Mock(
                    return_value={
                        "type": "about:blank",
                        "title": "Unauthorized",
                        "status": 401,
                        "detail": "Invalid API key",
                    }
                ),
                headers={},
            )
        )

        with pytest.raises(AuthenticationError) as exc_info:
            await mock_client.get_health()

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_not_found_error(self, mock_client: AgentClient) -> None:
        """Test not found error handling"""
        mock_client._client.request = AsyncMock(
            return_value=Mock(
                is_success=False,
                status_code=404,
                json=Mock(
                    return_value={
                        "type": "about:blank",
                        "title": "Not Found",
                        "status": 404,
                        "detail": "Agent not found",
                    }
                ),
                headers={},
            )
        )

        with pytest.raises(NotFoundError) as exc_info:
            await mock_client.get_agent("invalid-id")

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_rate_limit_error(self, mock_client: AgentClient) -> None:
        """Test rate limit error handling"""
        mock_client._client.request = AsyncMock(
            return_value=Mock(
                is_success=False,
                status_code=429,
                json=Mock(
                    return_value={
                        "type": "about:blank",
                        "title": "Too Many Requests",
                        "status": 429,
                        "detail": "Rate limit exceeded",
                    }
                ),
                headers={"retry-after": "60"},
            )
        )

        with pytest.raises(RateLimitError) as exc_info:
            await mock_client.get_health()

        assert exc_info.value.status_code == 429
        assert exc_info.value.retry_after == 60

    @pytest.mark.asyncio
    async def test_retry_on_server_error(self, mock_client: AgentClient) -> None:
        """Test retry logic on server errors"""
        # First two calls fail, third succeeds
        mock_responses = [
            Mock(
                is_success=False,
                status_code=503,
                json=Mock(
                    return_value={
                        "type": "about:blank",
                        "title": "Service Unavailable",
                        "status": 503,
                    }
                ),
                headers={},
            ),
            Mock(
                is_success=False,
                status_code=503,
                json=Mock(
                    return_value={
                        "type": "about:blank",
                        "title": "Service Unavailable",
                        "status": 503,
                    }
                ),
                headers={},
            ),
            Mock(
                is_success=True,
                json=Mock(
                    return_value={
                        "status": "healthy",
                        "version": "1.0.0",
                        "timestamp": "2025-10-02T10:00:00Z",
                    }
                ),
                headers={},
            ),
        ]

        mock_client._client.request = AsyncMock(side_effect=mock_responses)
        mock_client.max_retries = 3

        # Should eventually succeed after retries
        health = await mock_client.get_health()
        assert health.status.value == "healthy"

    @pytest.mark.asyncio
    async def test_no_retry_on_client_error(self, mock_client: AgentClient) -> None:
        """Test no retry on client errors (4xx)"""
        mock_client._client.request = AsyncMock(
            return_value=Mock(
                is_success=False,
                status_code=400,
                json=Mock(
                    return_value={
                        "type": "about:blank",
                        "title": "Bad Request",
                        "status": 400,
                        "detail": "Invalid request",
                    }
                ),
                headers={},
            )
        )

        with pytest.raises(AgentAPIError):
            await mock_client.get_health()

        # Should only be called once (no retries)
        assert mock_client._client.request.call_count == 1

    @pytest.mark.asyncio
    async def test_rate_limit_tracking(
        self, mock_client: AgentClient, mock_health_response: HealthResponse
    ) -> None:
        """Test rate limit information is tracked"""
        mock_client._client.request = AsyncMock(
            return_value=Mock(
                is_success=True,
                json=Mock(return_value=mock_health_response.model_dump()),
                headers={
                    "x-ratelimit-limit": "100",
                    "x-ratelimit-remaining": "95",
                    "x-ratelimit-reset": "1696248000",
                },
            )
        )

        await mock_client.get_health()

        assert mock_client.rate_limit is not None
        assert mock_client.rate_limit.limit == 100
        assert mock_client.rate_limit.remaining == 95
        assert mock_client.rate_limit.reset == 1696248000


@pytest.mark.unit
class TestAgentClientStreaming:
    """Test suite for streaming functionality"""

    def test_event_stream_creation(self) -> None:
        """Test event stream can be created"""
        client = AgentClient()
        stream = client.stream_events("aider-12345678")

        assert stream is not None
        assert stream.url.endswith("/agents/aider-12345678/events")

    def test_websocket_stream_creation(self) -> None:
        """Test WebSocket stream can be created"""
        client = AgentClient()
        stream = client.stream_websocket("aider-12345678")

        assert stream is not None
        assert "ws://" in stream.url
        assert stream.url.endswith("/agents/aider-12345678/ws")
