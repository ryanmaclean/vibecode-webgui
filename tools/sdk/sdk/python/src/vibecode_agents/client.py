"""
VibeCode Agents API Client

Production-ready async HTTP client with retry logic, error handling,
and comprehensive type safety.
"""

import asyncio
import logging
from typing import Any, AsyncIterator, Dict, Optional
from urllib.parse import urljoin

import httpx
from pydantic import ValidationError

from vibecode_agents.exceptions import (
    AgentAPIError,
    AuthenticationError,
    NotFoundError,
    RateLimitError,
    ValidationError as APIValidationError,
)
from vibecode_agents.models import (
    AgentListResponse,
    AgentMessageRequest,
    AgentResponse,
    AgentStatusResponse,
    HealthResponse,
    ListAgentsQuery,
    ProblemDetails,
    RateLimitInfo,
    SendMessageResponse,
    StartAgentRequest,
    StopAgentQuery,
    StopAgentResponse,
    StreamEventsQuery,
)
from vibecode_agents.streaming import EventStream, WebSocketStream

logger = logging.getLogger(__name__)


class AgentClient:
    """
    Async HTTP client for VibeCode Agents API

    Provides production-ready features:
    - Automatic retry with exponential backoff
    - Connection pooling and keep-alive
    - Request/response validation
    - Comprehensive error handling
    - Rate limit tracking
    - Distributed tracing support

    Example:
        >>> async with AgentClient(base_url="http://localhost:3000") as client:
        ...     health = await client.get_health()
        ...     print(health.status)
    """

    def __init__(
        self,
        base_url: str = "http://localhost:3000/api",
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        headers: Optional[Dict[str, str]] = None,
    ):
        """
        Initialize AgentClient

        Args:
            base_url: Base URL for API requests
            api_key: Optional API key for authentication
            timeout: Request timeout in seconds
            max_retries: Maximum retry attempts
            headers: Additional headers to include
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries

        default_headers = {
            "User-Agent": "vibecode-agents-python/0.1.0",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if api_key:
            default_headers["Authorization"] = f"Bearer {api_key}"
        if headers:
            default_headers.update(headers)

        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=default_headers,
            timeout=httpx.Timeout(timeout),
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
        )
        self._rate_limit: Optional[RateLimitInfo] = None

    async def __aenter__(self) -> "AgentClient":
        """Async context manager entry"""
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit"""
        await self.close()

    async def close(self) -> None:
        """Close the HTTP client and cleanup resources"""
        await self._client.aclose()

    @property
    def rate_limit(self) -> Optional[RateLimitInfo]:
        """Get current rate limit information"""
        return self._rate_limit

    async def start_agent(self, request: StartAgentRequest) -> AgentResponse:
        """
        Start a new agent instance

        Args:
            request: Agent start configuration

        Returns:
            AgentResponse with agent ID and connection details

        Raises:
            ValidationError: Invalid request parameters
            AuthenticationError: Invalid or missing API key
            RateLimitError: Rate limit exceeded
            AgentAPIError: API request failed
        """
        response = await self._request(
            "POST",
            "/agents",
            json=request.model_dump(mode="json", exclude_none=True),
        )
        return AgentResponse.model_validate(response)

    async def get_agent(self, agent_id: str) -> AgentStatusResponse:
        """
        Get detailed agent status

        Args:
            agent_id: Unique agent identifier

        Returns:
            AgentStatusResponse with detailed status

        Raises:
            NotFoundError: Agent not found
            AgentAPIError: API request failed
        """
        response = await self._request("GET", f"/agents/{agent_id}")
        return AgentStatusResponse.model_validate(response)

    async def list_agents(self, query: Optional[ListAgentsQuery] = None) -> AgentListResponse:
        """
        List all agents with optional filtering

        Args:
            query: Optional query parameters for filtering

        Returns:
            AgentListResponse with agents and pagination

        Raises:
            AgentAPIError: API request failed
        """
        params = query.model_dump(exclude_none=True) if query else {}
        response = await self._request("GET", "/agents", params=params)
        return AgentListResponse.model_validate(response)

    async def stop_agent(
        self, agent_id: str, force: bool = False
    ) -> StopAgentResponse:
        """
        Stop a running agent

        Args:
            agent_id: Unique agent identifier
            force: Force immediate termination (SIGKILL)

        Returns:
            StopAgentResponse with stop confirmation

        Raises:
            NotFoundError: Agent not found
            AgentAPIError: API request failed
        """
        params = {"force": force} if force else {}
        response = await self._request("DELETE", f"/agents/{agent_id}", params=params)
        return StopAgentResponse.model_validate(response)

    async def send_message(
        self, agent_id: str, message: str, message_type: str = "user"
    ) -> SendMessageResponse:
        """
        Send message to agent

        Args:
            agent_id: Unique agent identifier
            message: Message content
            message_type: Message type (user or system)

        Returns:
            SendMessageResponse with message delivery confirmation

        Raises:
            NotFoundError: Agent not found
            ValidationError: Invalid message
            AgentAPIError: API request failed
        """
        request = AgentMessageRequest(message=message, type=message_type)  # type: ignore
        response = await self._request(
            "POST",
            f"/agents/{agent_id}/messages",
            json=request.model_dump(mode="json"),
        )
        return SendMessageResponse.model_validate(response)

    async def get_messages(
        self, agent_id: str, limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get agent output history

        Args:
            agent_id: Unique agent identifier
            limit: Maximum number of messages to retrieve

        Returns:
            Dict with messages array

        Raises:
            NotFoundError: Agent not found
            AgentAPIError: API request failed
        """
        params = {"limit": limit} if limit else {}
        return await self._request("GET", f"/agents/{agent_id}/messages", params=params)

    async def get_health(self) -> HealthResponse:
        """
        Check API health status

        Returns:
            HealthResponse with system health information

        Raises:
            AgentAPIError: API request failed
        """
        response = await self._request("GET", "/health")
        return HealthResponse.model_validate(response)

    def stream_events(
        self, agent_id: str, from_sequence: Optional[int] = None
    ) -> EventStream:
        """
        Create Server-Sent Events stream for agent output

        Args:
            agent_id: Unique agent identifier
            from_sequence: Resume from specific sequence number

        Returns:
            EventStream for async iteration

        Example:
            >>> async with client.stream_events(agent_id) as stream:
            ...     async for event in stream:
            ...         print(f"{event.event}: {event.data}")
        """
        params = {"from_sequence": from_sequence} if from_sequence else {}
        url = f"{self.base_url}/agents/{agent_id}/events"
        return EventStream(url, params, self._get_headers())

    def stream_websocket(self, agent_id: str) -> WebSocketStream:
        """
        Create WebSocket stream for bidirectional agent communication

        Args:
            agent_id: Unique agent identifier

        Returns:
            WebSocketStream for async send/receive

        Example:
            >>> async with client.stream_websocket(agent_id) as stream:
            ...     await stream.send_message("Add tests")
            ...     async for message in stream:
            ...         print(message)
        """
        ws_url = self.base_url.replace("http://", "ws://").replace("https://", "wss://")
        url = f"{ws_url}/agents/{agent_id}/ws"
        return WebSocketStream(url, self._get_headers())

    async def _request(
        self,
        method: str,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute HTTP request with retry logic and error handling

        Args:
            method: HTTP method
            path: API endpoint path
            json: JSON request body
            params: Query parameters

        Returns:
            Parsed JSON response

        Raises:
            AgentAPIError: API request failed
        """
        last_error: Optional[Exception] = None

        for attempt in range(self.max_retries):
            try:
                response = await self._client.request(
                    method,
                    path,
                    json=json,
                    params=params,
                )

                self._update_rate_limit(response.headers)

                if response.is_success:
                    return response.json()

                self._handle_error_response(response)

            except httpx.TimeoutException as e:
                last_error = AgentAPIError(
                    f"Request timeout after {self.timeout}s", status_code=0, retry_after=None
                )
                if attempt < self.max_retries - 1:
                    await self._backoff(attempt)
                    continue
                raise last_error from e

            except httpx.NetworkError as e:
                last_error = AgentAPIError(
                    f"Network error: {str(e)}", status_code=0, retry_after=None
                )
                if attempt < self.max_retries - 1:
                    await self._backoff(attempt)
                    continue
                raise last_error from e

            except Exception as e:
                logger.error(f"Unexpected error in request: {e}")
                raise

        if last_error:
            raise last_error
        raise AgentAPIError("Request failed after retries", status_code=0, retry_after=None)

    def _handle_error_response(self, response: httpx.Response) -> None:
        """Parse and raise appropriate exception for error response"""
        try:
            problem = ProblemDetails.model_validate(response.json())
            retry_after = self._extract_retry_after(response.headers)

            if response.status_code == 401 or response.status_code == 403:
                raise AuthenticationError(
                    problem.detail or problem.title,
                    status_code=problem.status,
                    retry_after=None,
                )
            elif response.status_code == 404:
                raise NotFoundError(
                    problem.detail or problem.title,
                    status_code=problem.status,
                    retry_after=None,
                )
            elif response.status_code == 422:
                raise APIValidationError(
                    problem.detail or problem.title,
                    status_code=problem.status,
                    retry_after=None,
                )
            elif response.status_code == 429:
                raise RateLimitError(
                    problem.detail or problem.title,
                    status_code=problem.status,
                    retry_after=retry_after,
                )
            else:
                raise AgentAPIError(
                    problem.detail or problem.title,
                    status_code=problem.status,
                    retry_after=retry_after,
                )
        except ValidationError:
            raise AgentAPIError(
                f"HTTP {response.status_code}: {response.text}",
                status_code=response.status_code,
                retry_after=None,
            )

    def _update_rate_limit(self, headers: httpx.Headers) -> None:
        """Extract and update rate limit information from headers"""
        limit = headers.get("x-ratelimit-limit")
        remaining = headers.get("x-ratelimit-remaining")
        reset = headers.get("x-ratelimit-reset")

        if limit and remaining and reset:
            self._rate_limit = RateLimitInfo(
                limit=int(limit),
                remaining=int(remaining),
                reset=int(reset),
                retry_after=None,
            )

    def _extract_retry_after(self, headers: httpx.Headers) -> Optional[int]:
        """Extract retry-after header value"""
        retry_after = headers.get("retry-after")
        return int(retry_after) if retry_after else None

    def _get_headers(self) -> Dict[str, str]:
        """Get current client headers"""
        return dict(self._client.headers)

    async def _backoff(self, attempt: int) -> None:
        """Execute exponential backoff delay"""
        delay = min(2**attempt, 10.0)
        logger.debug(f"Retrying after {delay}s backoff")
        await asyncio.sleep(delay)
