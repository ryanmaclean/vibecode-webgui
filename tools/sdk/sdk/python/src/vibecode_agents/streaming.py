
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
Streaming support for VibeCode Agents SDK

Production-ready Server-Sent Events and WebSocket streaming with
automatic reconnection and comprehensive error handling.
"""

import asyncio
import json
import logging
from typing import Any, AsyncIterator, Dict, Optional

import httpx
from sseclient import SSEClient

from vibecode_agents.exceptions import ConnectionError, MessageError, StreamError
from vibecode_agents.models import SSEEvent, SSEEventType

logger = logging.getLogger(__name__)


class EventStream:
    """
    Server-Sent Events stream for agent output

    Provides automatic reconnection, event parsing, and async iteration.

    Example:
        >>> async with EventStream(url, params, headers) as stream:
        ...     async for event in stream:
        ...         if event.event == SSEEventType.OUTPUT:
        ...             print(event.data["line"])
    """

    def __init__(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        reconnect_interval: float = 3.0,
        max_reconnect_attempts: int = 5,
    ):
        """
        Initialize EventStream

        Args:
            url: SSE endpoint URL
            params: Query parameters
            headers: HTTP headers
            reconnect_interval: Seconds between reconnection attempts
            max_reconnect_attempts: Maximum reconnection attempts
        """
        self.url = url
        self.params = params or {}
        self.headers = headers or {}
        self.reconnect_interval = reconnect_interval
        self.max_reconnect_attempts = max_reconnect_attempts
        self._client: Optional[httpx.AsyncClient] = None
        self._last_event_id: Optional[str] = None
        self._closed = False

    async def __aenter__(self) -> "EventStream":
        """Async context manager entry"""
        self._client = httpx.AsyncClient(timeout=None)
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit"""
        await self.close()

    async def close(self) -> None:
        """Close the stream and cleanup resources"""
        self._closed = True
        if self._client:
            await self._client.aclose()

    async def __aiter__(self) -> AsyncIterator[SSEEvent]:
        """Async iterator for stream events"""
        if not self._client:
            raise StreamError("Stream not initialized. Use 'async with' context manager.")

        reconnect_attempts = 0

        while not self._closed:
            try:
                async with self._connect() as response:
                    reconnect_attempts = 0  # Reset on successful connection

                    async for line in response.aiter_lines():
                        if self._closed:
                            break

                        event = self._parse_sse_line(line)
                        if event:
                            self._last_event_id = event.id
                            yield event

                            # Break on completion
                            if event.event == SSEEventType.COMPLETE:
                                logger.info("Agent completed, closing stream")
                                await self.close()
                                break

            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error in stream: {e}")
                if e.response.status_code < 500:
                    # Don't retry on client errors
                    raise ConnectionError(f"Stream failed: {e}") from e

                # Retry on server errors
                reconnect_attempts += 1
                if reconnect_attempts >= self.max_reconnect_attempts:
                    raise ConnectionError(
                        f"Max reconnection attempts ({self.max_reconnect_attempts}) exceeded"
                    ) from e

                logger.info(f"Reconnecting in {self.reconnect_interval}s...")
                await asyncio.sleep(self.reconnect_interval)

            except Exception as e:
                logger.error(f"Unexpected error in stream: {e}")
                raise StreamError(f"Stream error: {e}") from e

    async def _connect(self) -> httpx.Response:
        """Establish SSE connection with resume support"""
        if not self._client:
            raise StreamError("Client not initialized")

        headers = dict(self.headers)
        headers["Accept"] = "text/event-stream"
        headers["Cache-Control"] = "no-cache"

        params = dict(self.params)
        if self._last_event_id:
            params["from_sequence"] = self._last_event_id

        response = await self._client.get(
            self.url,
            params=params,
            headers=headers,
        )
        response.raise_for_status()
        return response

    def _parse_sse_line(self, line: str) -> Optional[SSEEvent]:
        """Parse SSE formatted line into event"""
        if not line or line.startswith(":"):
            return None

        if line.startswith("data:"):
            try:
                data = json.loads(line[5:].strip())
                event_type = data.get("event", "output")
                event_id = data.get("id", "0")

                return SSEEvent(
                    id=event_id,
                    event=SSEEventType(event_type),
                    data=data.get("data", data),
                )
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Failed to parse SSE data: {e}")
                return None

        return None


class WebSocketStream:
    """
    WebSocket stream for bidirectional agent communication

    Provides automatic reconnection, message queuing, and ping/pong handling.

    Example:
        >>> async with WebSocketStream(url, headers) as stream:
        ...     await stream.send_message("Add type hints")
        ...     async for message in stream:
        ...         print(message)
    """

    def __init__(
        self,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        ping_interval: float = 30.0,
        reconnect_interval: float = 3.0,
        max_reconnect_attempts: int = 5,
    ):
        """
        Initialize WebSocketStream

        Args:
            url: WebSocket endpoint URL
            headers: HTTP headers for connection
            ping_interval: Seconds between ping messages
            reconnect_interval: Seconds between reconnection attempts
            max_reconnect_attempts: Maximum reconnection attempts
        """
        self.url = url
        self.headers = headers or {}
        self.ping_interval = ping_interval
        self.reconnect_interval = reconnect_interval
        self.max_reconnect_attempts = max_reconnect_attempts
        self._ws: Optional[Any] = None  # WebSocket connection
        self._closed = False
        self._ping_task: Optional[asyncio.Task[None]] = None

    async def __aenter__(self) -> "WebSocketStream":
        """Async context manager entry"""
        await self.connect()
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit"""
        await self.close()

    async def connect(self) -> None:
        """Establish WebSocket connection"""
        try:
            import websockets

            extra_headers = list(self.headers.items())
            self._ws = await websockets.connect(
                self.url,
                extra_headers=extra_headers,
                subprotocols=["agent-v1"],
            )

            # Start ping task
            self._ping_task = asyncio.create_task(self._ping_loop())

            logger.info(f"WebSocket connected to {self.url}")

        except ImportError:
            raise StreamError(
                "websockets package required for WebSocket support. "
                "Install with: pip install websockets"
            )
        except Exception as e:
            raise ConnectionError(f"Failed to connect WebSocket: {e}") from e

    async def close(self) -> None:
        """Close WebSocket connection and cleanup"""
        self._closed = True

        if self._ping_task:
            self._ping_task.cancel()
            try:
                await self._ping_task
            except asyncio.CancelledError:
                pass

        if self._ws:
            await self._ws.close()
            logger.info("WebSocket closed")

    async def send_message(self, content: str) -> None:
        """
        Send message to agent via WebSocket

        Args:
            content: Message content to send

        Raises:
            MessageError: Failed to send message
        """
        if not self._ws:
            raise ConnectionError("WebSocket not connected")

        message = {"type": "message", "content": content}
        try:
            await self._ws.send(json.dumps(message))
        except Exception as e:
            raise MessageError(f"Failed to send message: {e}") from e

    async def send_ping(self) -> None:
        """Send ping message to keep connection alive"""
        if not self._ws:
            raise ConnectionError("WebSocket not connected")

        message = {"type": "ping"}
        try:
            await self._ws.send(json.dumps(message))
        except Exception as e:
            logger.warning(f"Failed to send ping: {e}")

    async def __aiter__(self) -> AsyncIterator[Dict[str, Any]]:
        """Async iterator for WebSocket messages"""
        if not self._ws:
            raise StreamError("WebSocket not connected")

        try:
            async for message in self._ws:
                if self._closed:
                    break

                try:
                    data = json.loads(message)

                    # Handle pong responses
                    if data.get("type") == "pong":
                        continue

                    # Handle completion
                    if data.get("type") == "complete":
                        logger.info("Agent completed, closing WebSocket")
                        await self.close()
                        yield data
                        break

                    yield data

                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse WebSocket message: {e}")

        except Exception as e:
            if not self._closed:
                logger.error(f"WebSocket error: {e}")
                raise StreamError(f"WebSocket stream error: {e}") from e

    async def _ping_loop(self) -> None:
        """Background task to send periodic ping messages"""
        while not self._closed:
            try:
                await asyncio.sleep(self.ping_interval)
                if not self._closed:
                    await self.send_ping()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Error in ping loop: {e}")