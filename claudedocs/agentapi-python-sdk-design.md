# AgentAPI Python SDK - Production Design

## Overview

Production-ready async Python client library for VibeCode AgentAPI integration with type safety, session persistence, event streaming, and comprehensive error handling.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────┐
│                  AgentAPIClient                      │
│  - Connection pooling                                │
│  - Rate limiting                                     │
│  - Retry logic with exponential backoff              │
│  - Auth token management                             │
└─────────────────┬───────────────────────────────────┘
                  │
      ┌───────────┴───────────┬──────────────────┐
      ▼                       ▼                  ▼
┌─────────────┐      ┌────────────────┐   ┌──────────────┐
│   Agent     │      │ SessionManager │   │ EventStream  │
│  - Claude   │      │ - SQLite       │   │ - SSE client │
│  - Cline    │      │ - JSON files   │   │ - Async gen  │
│  - Continue │      │ - Redis cache  │   │ - Reconnect  │
└─────────────┘      └────────────────┘   └──────────────┘
```

### Type System

All data structures use Pydantic v2 for:
- Runtime validation
- Serialization/deserialization
- JSON Schema generation
- IDE autocomplete support

---

## 1. Configuration Management

### Config Class

```python
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, Dict, Any
from pathlib import Path

class AgentAPIConfig(BaseModel):
    """Configuration for AgentAPI client."""

    # Connection settings
    base_url: HttpUrl = Field(default="http://localhost:3284")
    timeout: float = Field(default=30.0, gt=0)
    max_retries: int = Field(default=3, ge=0, le=10)

    # Authentication
    api_key: Optional[str] = Field(default=None, repr=False)
    auth_header: str = Field(default="Authorization")

    # Session persistence
    session_dir: Path = Field(default=Path.home() / ".vibecode" / "sessions")
    auto_save: bool = Field(default=True)

    # Rate limiting
    requests_per_minute: int = Field(default=60, gt=0)

    # Event streaming
    sse_timeout: float = Field(default=60.0, gt=0)
    reconnect_interval: float = Field(default=1.0, gt=0)
    max_reconnects: int = Field(default=5, ge=0)

    # Connection pooling
    pool_size: int = Field(default=10, gt=0)
    pool_maxsize: int = Field(default=100, gt=0)

    model_config = {
        "validate_assignment": True,
        "extra": "forbid"
    }

    @classmethod
    def from_env(cls) -> "AgentAPIConfig":
        """Load config from environment variables."""
        import os
        return cls(
            base_url=os.getenv("AGENTAPI_URL", "http://localhost:3284"),
            api_key=os.getenv("AGENTAPI_KEY"),
            timeout=float(os.getenv("AGENTAPI_TIMEOUT", "30")),
        )

    @classmethod
    def from_file(cls, path: Path) -> "AgentAPIConfig":
        """Load config from TOML/JSON file."""
        import tomllib
        with open(path, "rb") as f:
            data = tomllib.load(f)
        return cls(**data)
```

---

## 2. Data Models

### Core Models

```python
from pydantic import BaseModel, Field, validator
from typing import Literal, Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

class AgentType(str, Enum):
    """Supported agent types."""
    CLAUDE = "claude"
    CLINE = "cline"
    CONTINUE = "continue"
    CUSTOM = "custom"

class MessageRole(str, Enum):
    """Message roles in conversation."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"

class AgentStatus(str, Enum):
    """Agent lifecycle states."""
    STARTING = "starting"
    READY = "ready"
    BUSY = "busy"
    ERROR = "error"
    STOPPED = "stopped"

class Message(BaseModel):
    """Conversation message."""
    id: UUID = Field(default_factory=uuid4)
    role: MessageRole
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "role": "user",
                "content": "Explain this code",
                "metadata": {"file": "auth.py", "line": 45}
            }]
        }
    }

class AgentStartRequest(BaseModel):
    """Request to start an agent instance."""
    agent_type: AgentType
    workspace_id: str = Field(min_length=1)
    config: Dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[UUID] = None

class AgentStartResponse(BaseModel):
    """Response from starting agent."""
    agent_id: UUID
    agent_type: AgentType
    status: AgentStatus
    workspace_id: str
    created_at: datetime

class MessageRequest(BaseModel):
    """Request to send message to agent."""
    content: str = Field(min_length=1)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    stream: bool = Field(default=False)

class MessageResponse(BaseModel):
    """Response from agent message."""
    message_id: UUID
    content: str
    role: MessageRole = Field(default=MessageRole.ASSISTANT)
    timestamp: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)

class AgentEvent(BaseModel):
    """Server-sent event from agent."""
    event_type: Literal["message", "status", "error", "tool_use", "complete"]
    agent_id: UUID
    timestamp: datetime
    data: Dict[str, Any]

    @validator("data")
    def validate_data(cls, v, values):
        """Ensure data matches event type requirements."""
        event_type = values.get("event_type")
        if event_type == "error" and "error" not in v:
            raise ValueError("error event must contain 'error' field")
        return v

class ConversationHistory(BaseModel):
    """Full conversation history."""
    agent_id: UUID
    messages: List[Message]
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)
```

---

## 3. Retry Logic

### Exponential Backoff with Jitter

```python
import asyncio
import random
from typing import TypeVar, Callable, Optional, Type
from functools import wraps
import logging

logger = logging.getLogger(__name__)

T = TypeVar("T")

class RetryConfig(BaseModel):
    """Configuration for retry behavior."""
    max_retries: int = Field(default=3, ge=0)
    base_delay: float = Field(default=1.0, gt=0)
    max_delay: float = Field(default=60.0, gt=0)
    exponential_base: float = Field(default=2.0, gt=1.0)
    jitter: bool = Field(default=True)

    def calculate_delay(self, attempt: int) -> float:
        """Calculate delay for given attempt with exponential backoff + jitter."""
        delay = min(
            self.base_delay * (self.exponential_base ** attempt),
            self.max_delay
        )
        if self.jitter:
            # Full jitter: random between 0 and calculated delay
            delay = random.uniform(0, delay)
        return delay

class RetryableError(Exception):
    """Base class for errors that should trigger retry."""
    pass

class RateLimitError(RetryableError):
    """Rate limit exceeded."""
    retry_after: Optional[float] = None

class NetworkError(RetryableError):
    """Network connectivity error."""
    pass

class ServerError(RetryableError):
    """Server-side error (5xx)."""
    pass

def retry_async(
    config: Optional[RetryConfig] = None,
    retryable_exceptions: tuple[Type[Exception], ...] = (RetryableError,),
):
    """
    Async retry decorator with exponential backoff.

    Usage:
        @retry_async(config=RetryConfig(max_retries=5))
        async def fetch_data():
            ...
    """
    config = config or RetryConfig()

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            last_exception = None

            for attempt in range(config.max_retries + 1):
                try:
                    return await func(*args, **kwargs)

                except retryable_exceptions as e:
                    last_exception = e

                    if attempt >= config.max_retries:
                        logger.error(
                            f"{func.__name__} failed after {config.max_retries} retries",
                            exc_info=True
                        )
                        raise

                    # Special handling for rate limits
                    if isinstance(e, RateLimitError) and e.retry_after:
                        delay = e.retry_after
                    else:
                        delay = config.calculate_delay(attempt)

                    logger.warning(
                        f"{func.__name__} attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {delay:.2f}s..."
                    )

                    await asyncio.sleep(delay)

            raise last_exception

        return wrapper
    return decorator
```

---

## 4. Core Client

### AgentAPIClient

```python
import aiohttp
import asyncio
from typing import Optional, Dict, Any, AsyncIterator
from contextlib import asynccontextmanager
import logging

logger = logging.getLogger(__name__)

class AgentAPIClient:
    """
    Async HTTP client for AgentAPI with connection pooling,
    rate limiting, and automatic retry.

    Example:
        async with AgentAPIClient(config) as client:
            agent = await client.start_agent("claude", workspace_id="ws-123")
            response = await agent.send_message("Hello")
    """

    def __init__(self, config: Optional[AgentAPIConfig] = None):
        self.config = config or AgentAPIConfig()
        self._session: Optional[aiohttp.ClientSession] = None
        self._rate_limiter = RateLimiter(self.config.requests_per_minute)
        self._retry_config = RetryConfig(max_retries=self.config.max_retries)

    async def __aenter__(self) -> "AgentAPIClient":
        await self._ensure_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def _ensure_session(self):
        """Initialize aiohttp session with connection pooling."""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=self.config.timeout)
            connector = aiohttp.TCPConnector(
                limit=self.config.pool_size,
                limit_per_host=self.config.pool_maxsize,
                ttl_dns_cache=300,
            )
            self._session = aiohttp.ClientSession(
                timeout=timeout,
                connector=connector,
                headers=self._build_headers(),
            )

    def _build_headers(self) -> Dict[str, str]:
        """Build default headers including auth."""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": f"vibecode-agentapi-python/{__version__}",
        }
        if self.config.api_key:
            headers[self.config.auth_header] = f"Bearer {self.config.api_key}"
        return headers

    @retry_async()
    async def _request(
        self,
        method: str,
        path: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make HTTP request with rate limiting and retry.

        Raises:
            NetworkError: Connection failed
            RateLimitError: Rate limit exceeded
            ServerError: Server returned 5xx
            AgentAPIError: Other API errors
        """
        await self._ensure_session()
        await self._rate_limiter.acquire()

        url = f"{self.config.base_url}{path}"

        try:
            async with self._session.request(method, url, **kwargs) as response:
                # Handle rate limiting
                if response.status == 429:
                    retry_after = float(response.headers.get("Retry-After", 60))
                    error = RateLimitError("Rate limit exceeded")
                    error.retry_after = retry_after
                    raise error

                # Handle server errors (retryable)
                if 500 <= response.status < 600:
                    text = await response.text()
                    raise ServerError(f"Server error {response.status}: {text}")

                # Handle client errors (not retryable)
                if 400 <= response.status < 500:
                    text = await response.text()
                    raise AgentAPIError(f"Client error {response.status}: {text}")

                # Success
                response.raise_for_status()
                return await response.json()

        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            raise NetworkError(f"Network error: {e}") from e

    async def start_agent(
        self,
        agent_type: AgentType | str,
        workspace_id: str,
        config: Optional[Dict[str, Any]] = None,
        session_id: Optional[UUID] = None,
    ) -> "Agent":
        """
        Start a new agent instance.

        Args:
            agent_type: Type of agent (claude, cline, continue, custom)
            workspace_id: Workspace identifier
            config: Agent-specific configuration
            session_id: Optional session ID for resuming

        Returns:
            Agent instance ready for interaction

        Raises:
            AgentAPIError: Failed to start agent
        """
        request = AgentStartRequest(
            agent_type=AgentType(agent_type),
            workspace_id=workspace_id,
            config=config or {},
            session_id=session_id,
        )

        response = await self._request(
            "POST",
            "/agents/start",
            json=request.model_dump(mode="json"),
        )

        start_response = AgentStartResponse(**response)

        return Agent(
            client=self,
            agent_id=start_response.agent_id,
            agent_type=start_response.agent_type,
            workspace_id=start_response.workspace_id,
        )

    async def get_agent(self, agent_id: UUID) -> "Agent":
        """Get existing agent by ID."""
        response = await self._request("GET", f"/agents/{agent_id}")

        return Agent(
            client=self,
            agent_id=response["agent_id"],
            agent_type=AgentType(response["agent_type"]),
            workspace_id=response["workspace_id"],
        )

    async def list_agents(
        self,
        workspace_id: Optional[str] = None,
        status: Optional[AgentStatus] = None,
    ) -> List["Agent"]:
        """List all agents, optionally filtered."""
        params = {}
        if workspace_id:
            params["workspace_id"] = workspace_id
        if status:
            params["status"] = status.value

        response = await self._request("GET", "/agents", params=params)

        return [
            Agent(
                client=self,
                agent_id=agent["agent_id"],
                agent_type=AgentType(agent["agent_type"]),
                workspace_id=agent["workspace_id"],
            )
            for agent in response["agents"]
        ]

    async def close(self):
        """Close HTTP session and cleanup resources."""
        if self._session and not self._session.closed:
            await self._session.close()
        await self._rate_limiter.close()

class RateLimiter:
    """Token bucket rate limiter for API requests."""

    def __init__(self, requests_per_minute: int):
        self.rate = requests_per_minute / 60.0  # requests per second
        self.tokens = requests_per_minute
        self.max_tokens = requests_per_minute
        self.last_update = asyncio.get_event_loop().time()
        self._lock = asyncio.Lock()

    async def acquire(self):
        """Acquire token, waiting if necessary."""
        async with self._lock:
            now = asyncio.get_event_loop().time()
            elapsed = now - self.last_update

            # Add tokens based on elapsed time
            self.tokens = min(
                self.max_tokens,
                self.tokens + elapsed * self.rate
            )
            self.last_update = now

            # Wait if no tokens available
            if self.tokens < 1:
                wait_time = (1 - self.tokens) / self.rate
                await asyncio.sleep(wait_time)
                self.tokens = 0
            else:
                self.tokens -= 1

    async def close(self):
        """Cleanup resources."""
        pass
```

---

## 5. Agent Abstraction

### Agent Class

```python
from typing import Optional, Dict, Any, AsyncIterator, List
from uuid import UUID
import logging

logger = logging.getLogger(__name__)

class Agent:
    """
    High-level agent interface for interaction.

    Provides message sending, event streaming, and history management.
    Delegates HTTP operations to AgentAPIClient.
    """

    def __init__(
        self,
        client: AgentAPIClient,
        agent_id: UUID,
        agent_type: AgentType,
        workspace_id: str,
    ):
        self.client = client
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.workspace_id = workspace_id
        self._event_stream: Optional[EventStream] = None

    async def send_message(
        self,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        stream: bool = False,
    ) -> MessageResponse:
        """
        Send message to agent and get response.

        Args:
            content: Message content
            metadata: Optional metadata (file context, line numbers, etc)
            stream: Whether to stream response (use stream_response instead)

        Returns:
            Agent's response message

        Example:
            response = await agent.send_message(
                "Explain this function",
                metadata={"file": "auth.py", "line": 45}
            )
            print(response.content)
        """
        request = MessageRequest(
            content=content,
            metadata=metadata or {},
            stream=stream,
        )

        response = await self.client._request(
            "POST",
            f"/agents/{self.agent_id}/messages",
            json=request.model_dump(mode="json"),
        )

        return MessageResponse(**response)

    async def stream_response(
        self,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AsyncIterator[str]:
        """
        Send message and stream response chunks.

        Args:
            content: Message content
            metadata: Optional metadata

        Yields:
            Response content chunks as they arrive

        Example:
            async for chunk in agent.stream_response("Write a function"):
                print(chunk, end="", flush=True)
        """
        request = MessageRequest(
            content=content,
            metadata=metadata or {},
            stream=True,
        )

        await self.client._ensure_session()
        url = f"{self.client.config.base_url}/agents/{self.agent_id}/messages"

        async with self.client._session.post(
            url,
            json=request.model_dump(mode="json"),
        ) as response:
            response.raise_for_status()

            async for line in response.content:
                if line:
                    # Parse SSE format: "data: {json}\n\n"
                    line_str = line.decode("utf-8").strip()
                    if line_str.startswith("data: "):
                        data = json.loads(line_str[6:])
                        if "content" in data:
                            yield data["content"]

    async def get_messages(
        self,
        limit: Optional[int] = None,
        before: Optional[UUID] = None,
    ) -> List[Message]:
        """
        Get conversation history.

        Args:
            limit: Maximum messages to return
            before: Get messages before this message ID

        Returns:
            List of messages in chronological order
        """
        params = {}
        if limit:
            params["limit"] = limit
        if before:
            params["before"] = str(before)

        response = await self.client._request(
            "GET",
            f"/agents/{self.agent_id}/messages",
            params=params,
        )

        return [Message(**msg) for msg in response["messages"]]

    async def get_status(self) -> AgentStatus:
        """Get current agent status."""
        response = await self.client._request(
            "GET",
            f"/agents/{self.agent_id}/status",
        )
        return AgentStatus(response["status"])

    async def stop(self):
        """Stop agent and cleanup resources."""
        await self.client._request(
            "POST",
            f"/agents/{self.agent_id}/stop",
        )

        if self._event_stream:
            await self._event_stream.close()

    def stream_events(self) -> "EventStream":
        """
        Stream events from agent.

        Returns:
            EventStream for async iteration

        Example:
            async for event in agent.stream_events():
                if event.event_type == "message":
                    print(event.data["content"])
                elif event.event_type == "error":
                    print(f"Error: {event.data['error']}")
        """
        if self._event_stream is None:
            self._event_stream = EventStream(
                client=self.client,
                agent_id=self.agent_id,
            )
        return self._event_stream

    def __repr__(self) -> str:
        return (
            f"Agent(id={self.agent_id}, "
            f"type={self.agent_type.value}, "
            f"workspace={self.workspace_id})"
        )
```

---

## 6. Event Streaming

### EventStream Class

```python
import asyncio
import json
from typing import AsyncIterator, Optional
from uuid import UUID
import logging

logger = logging.getLogger(__name__)

class EventStream:
    """
    Server-Sent Events (SSE) stream for agent events.

    Handles connection, reconnection, and event parsing.
    """

    def __init__(self, client: AgentAPIClient, agent_id: UUID):
        self.client = client
        self.agent_id = agent_id
        self._connected = False
        self._reconnect_count = 0

    async def __aiter__(self) -> AsyncIterator[AgentEvent]:
        """
        Async iterator for streaming events.

        Automatically reconnects on connection loss up to max_reconnects.

        Yields:
            AgentEvent objects as they arrive

        Raises:
            EventStreamError: Max reconnects exceeded
        """
        while True:
            try:
                async for event in self._stream_events():
                    self._reconnect_count = 0  # Reset on successful event
                    yield event

            except EventStreamError as e:
                if self._reconnect_count >= self.client.config.max_reconnects:
                    logger.error(
                        f"Max reconnects ({self.client.config.max_reconnects}) exceeded"
                    )
                    raise

                self._reconnect_count += 1
                delay = self.client.config.reconnect_interval * self._reconnect_count

                logger.warning(
                    f"Event stream disconnected: {e}. "
                    f"Reconnecting in {delay:.1f}s (attempt {self._reconnect_count})"
                )

                await asyncio.sleep(delay)

    async def _stream_events(self) -> AsyncIterator[AgentEvent]:
        """Internal event streaming with SSE parsing."""
        await self.client._ensure_session()

        url = f"{self.client.config.base_url}/agents/{self.agent_id}/events"
        timeout = aiohttp.ClientTimeout(total=self.client.config.sse_timeout)

        try:
            async with self.client._session.get(url, timeout=timeout) as response:
                response.raise_for_status()
                self._connected = True

                async for line in response.content:
                    if not line:
                        continue

                    line_str = line.decode("utf-8").strip()

                    # SSE format: "event: type\ndata: {json}\n\n"
                    if line_str.startswith("data: "):
                        try:
                            data = json.loads(line_str[6:])
                            event = AgentEvent(**data)
                            yield event

                        except (json.JSONDecodeError, ValueError) as e:
                            logger.warning(f"Failed to parse event: {e}")
                            continue

        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            self._connected = False
            raise EventStreamError(f"Stream error: {e}") from e

    async def close(self):
        """Close event stream."""
        self._connected = False

class EventStreamError(Exception):
    """Event stream connection error."""
    pass
```

---

## 7. Session Persistence

### SessionManager Class

```python
import json
import sqlite3
from pathlib import Path
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class SessionManager:
    """
    Persistent storage for conversation history.

    Supports SQLite (default), JSON files, and Redis cache.
    """

    def __init__(
        self,
        storage_dir: Path,
        backend: Literal["sqlite", "json", "redis"] = "sqlite",
    ):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.backend = backend

        if backend == "sqlite":
            self._init_sqlite()

    def _init_sqlite(self):
        """Initialize SQLite database with schema."""
        db_path = self.storage_dir / "sessions.db"
        self.conn = sqlite3.connect(str(db_path))
        self.conn.row_factory = sqlite3.Row

        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                agent_id TEXT PRIMARY KEY,
                agent_type TEXT NOT NULL,
                workspace_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                metadata TEXT
            )
        """)

        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                metadata TEXT,
                FOREIGN KEY (agent_id) REFERENCES sessions (agent_id)
            )
        """)

        self.conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_agent_id
            ON messages (agent_id, timestamp)
        """)

        self.conn.commit()

    async def save_session(
        self,
        agent_id: UUID,
        agent_type: AgentType,
        workspace_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Save or update session metadata."""
        now = datetime.utcnow().isoformat()

        self.conn.execute("""
            INSERT OR REPLACE INTO sessions
            (agent_id, agent_type, workspace_id, created_at, updated_at, metadata)
            VALUES (?, ?, ?, COALESCE(
                (SELECT created_at FROM sessions WHERE agent_id = ?),
                ?
            ), ?, ?)
        """, (
            str(agent_id),
            agent_type.value,
            workspace_id,
            str(agent_id),
            now,
            now,
            json.dumps(metadata or {}),
        ))

        self.conn.commit()

    async def save_message(self, agent_id: UUID, message: Message):
        """Save message to session history."""
        self.conn.execute("""
            INSERT INTO messages
            (id, agent_id, role, content, timestamp, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            str(message.id),
            str(agent_id),
            message.role.value,
            message.content,
            message.timestamp.isoformat(),
            json.dumps(message.metadata),
        ))

        self.conn.commit()

        # Update session timestamp
        now = datetime.utcnow().isoformat()
        self.conn.execute(
            "UPDATE sessions SET updated_at = ? WHERE agent_id = ?",
            (now, str(agent_id))
        )
        self.conn.commit()

    async def load_session(
        self,
        agent_id: UUID
    ) -> Optional[ConversationHistory]:
        """Load full conversation history for agent."""
        cursor = self.conn.execute(
            "SELECT * FROM sessions WHERE agent_id = ?",
            (str(agent_id),)
        )
        session = cursor.fetchone()

        if not session:
            return None

        cursor = self.conn.execute(
            "SELECT * FROM messages WHERE agent_id = ? ORDER BY timestamp",
            (str(agent_id),)
        )
        messages = [
            Message(
                id=UUID(row["id"]),
                role=MessageRole(row["role"]),
                content=row["content"],
                timestamp=datetime.fromisoformat(row["timestamp"]),
                metadata=json.loads(row["metadata"]),
            )
            for row in cursor.fetchall()
        ]

        return ConversationHistory(
            agent_id=UUID(session["agent_id"]),
            messages=messages,
            created_at=datetime.fromisoformat(session["created_at"]),
            updated_at=datetime.fromisoformat(session["updated_at"]),
            metadata=json.loads(session["metadata"]),
        )

    async def list_sessions(
        self,
        workspace_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """List recent sessions."""
        query = "SELECT * FROM sessions"
        params = []

        if workspace_id:
            query += " WHERE workspace_id = ?"
            params.append(workspace_id)

        query += " ORDER BY updated_at DESC LIMIT ?"
        params.append(limit)

        cursor = self.conn.execute(query, params)

        return [
            {
                "agent_id": UUID(row["agent_id"]),
                "agent_type": AgentType(row["agent_type"]),
                "workspace_id": row["workspace_id"],
                "created_at": datetime.fromisoformat(row["created_at"]),
                "updated_at": datetime.fromisoformat(row["updated_at"]),
                "metadata": json.loads(row["metadata"]),
            }
            for row in cursor.fetchall()
        ]

    async def delete_session(self, agent_id: UUID):
        """Delete session and all messages."""
        self.conn.execute(
            "DELETE FROM messages WHERE agent_id = ?",
            (str(agent_id),)
        )
        self.conn.execute(
            "DELETE FROM sessions WHERE agent_id = ?",
            (str(agent_id),)
        )
        self.conn.commit()

    def close(self):
        """Close database connection."""
        if hasattr(self, "conn"):
            self.conn.close()
```

---

## 8. Exception Hierarchy

### Custom Exceptions

```python
class AgentAPIError(Exception):
    """Base exception for AgentAPI client."""
    pass

class NetworkError(AgentAPIError):
    """Network connectivity error."""
    pass

class RateLimitError(AgentAPIError):
    """Rate limit exceeded."""
    retry_after: Optional[float] = None

class ServerError(AgentAPIError):
    """Server-side error (5xx)."""
    pass

class ValidationError(AgentAPIError):
    """Request validation failed."""
    pass

class AuthenticationError(AgentAPIError):
    """Authentication failed."""
    pass

class AgentNotFoundError(AgentAPIError):
    """Agent ID not found."""
    pass

class EventStreamError(AgentAPIError):
    """Event stream connection error."""
    pass

class SessionError(AgentAPIError):
    """Session persistence error."""
    pass
```

---

## 9. Usage Examples

### Basic Usage

```python
import asyncio
from vibecode_agentapi import AgentAPIClient, AgentAPIConfig

async def main():
    # Initialize client
    config = AgentAPIConfig(
        base_url="http://localhost:3284",
        api_key="your-api-key",
    )

    async with AgentAPIClient(config) as client:
        # Start Claude agent
        agent = await client.start_agent(
            agent_type="claude",
            workspace_id="ws-123"
        )

        # Send message
        response = await agent.send_message("Explain this code")
        print(response.content)

        # Get conversation history
        messages = await agent.get_messages()
        for msg in messages:
            print(f"{msg.role}: {msg.content}")

        # Stop agent
        await agent.stop()

if __name__ == "__main__":
    asyncio.run(main())
```

### Streaming Response

```python
async def streaming_example():
    async with AgentAPIClient.from_env() as client:
        agent = await client.start_agent("claude", workspace_id="ws-123")

        # Stream response chunks
        print("Agent: ", end="", flush=True)
        async for chunk in agent.stream_response("Write a hello world function"):
            print(chunk, end="", flush=True)
        print()

        await agent.stop()
```

### Event Streaming

```python
async def event_stream_example():
    async with AgentAPIClient.from_env() as client:
        agent = await client.start_agent("cline", workspace_id="ws-123")

        # Start background task to send messages
        asyncio.create_task(
            agent.send_message("Analyze this codebase")
        )

        # Stream events
        async for event in agent.stream_events():
            if event.event_type == "message":
                print(f"Message: {event.data['content']}")

            elif event.event_type == "tool_use":
                print(f"Tool: {event.data['tool_name']}")

            elif event.event_type == "error":
                print(f"Error: {event.data['error']}")
                break

            elif event.event_type == "complete":
                print("Task complete")
                break

        await agent.stop()
```

### Session Persistence

```python
from vibecode_agentapi import SessionManager

async def session_example():
    config = AgentAPIConfig.from_env()
    session_manager = SessionManager(config.session_dir)

    async with AgentAPIClient(config) as client:
        # Try to resume existing session
        sessions = await session_manager.list_sessions(workspace_id="ws-123")

        if sessions:
            # Resume last session
            last_session = sessions[0]
            agent = await client.get_agent(last_session["agent_id"])
            print(f"Resumed session: {agent.agent_id}")

            # Load history
            history = await session_manager.load_session(agent.agent_id)
            print(f"Loaded {len(history.messages)} previous messages")

        else:
            # Start new session
            agent = await client.start_agent("claude", workspace_id="ws-123")
            await session_manager.save_session(
                agent.agent_id,
                agent.agent_type,
                agent.workspace_id,
            )
            print(f"Started new session: {agent.agent_id}")

        # Continue conversation
        response = await agent.send_message("Continue from where we left off")

        # Save message to persistent storage
        await session_manager.save_message(
            agent.agent_id,
            Message(role="assistant", content=response.content)
        )

        await agent.stop()

    session_manager.close()
```

### Multi-Agent Orchestration

```python
async def multi_agent_example():
    async with AgentAPIClient.from_env() as client:
        # Start multiple agents
        claude = await client.start_agent("claude", workspace_id="ws-123")
        cline = await client.start_agent("cline", workspace_id="ws-123")

        # Parallel execution
        results = await asyncio.gather(
            claude.send_message("Analyze architecture"),
            cline.send_message("Implement feature X"),
            return_exceptions=True,
        )

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"Agent {i} failed: {result}")
            else:
                print(f"Agent {i}: {result.content[:100]}...")

        # Cleanup
        await asyncio.gather(
            claude.stop(),
            cline.stop(),
        )
```

### Error Handling

```python
from vibecode_agentapi import (
    AgentAPIClient,
    RateLimitError,
    NetworkError,
    AgentNotFoundError,
)

async def error_handling_example():
    async with AgentAPIClient.from_env() as client:
        try:
            agent = await client.start_agent("claude", workspace_id="ws-123")
            response = await agent.send_message("Hello")

        except RateLimitError as e:
            print(f"Rate limited. Retry after {e.retry_after}s")
            await asyncio.sleep(e.retry_after)

        except NetworkError as e:
            print(f"Network error: {e}. Check connection.")

        except AgentNotFoundError as e:
            print(f"Agent not found: {e}")

        except Exception as e:
            print(f"Unexpected error: {e}")

        finally:
            if 'agent' in locals():
                await agent.stop()
```

---

## 10. Testing Strategy

### Unit Tests

```python
# tests/unit/test_retry.py
import pytest
from vibecode_agentapi.retry import retry_async, RetryConfig, RateLimitError

@pytest.mark.asyncio
async def test_retry_with_success():
    """Test retry succeeds after failures."""
    attempts = []

    @retry_async(config=RetryConfig(max_retries=3, base_delay=0.01))
    async def flaky_function():
        attempts.append(1)
        if len(attempts) < 3:
            raise RateLimitError("Rate limited")
        return "success"

    result = await flaky_function()
    assert result == "success"
    assert len(attempts) == 3

@pytest.mark.asyncio
async def test_retry_exhausted():
    """Test retry gives up after max attempts."""
    @retry_async(config=RetryConfig(max_retries=2, base_delay=0.01))
    async def always_fails():
        raise RateLimitError("Always fails")

    with pytest.raises(RateLimitError):
        await always_fails()
```

### Integration Tests

```python
# tests/integration/test_client.py
import pytest
from vibecode_agentapi import AgentAPIClient, AgentAPIConfig

@pytest.mark.asyncio
async def test_agent_lifecycle():
    """Test full agent lifecycle: start -> message -> stop."""
    config = AgentAPIConfig(base_url="http://localhost:3284")

    async with AgentAPIClient(config) as client:
        # Start agent
        agent = await client.start_agent("claude", workspace_id="test-ws")
        assert agent.agent_id is not None

        # Send message
        response = await agent.send_message("Hello")
        assert response.content
        assert response.role == MessageRole.ASSISTANT

        # Get history
        messages = await agent.get_messages()
        assert len(messages) >= 2  # user + assistant

        # Stop agent
        await agent.stop()
        status = await agent.get_status()
        assert status == AgentStatus.STOPPED
```

### E2E Tests

```python
# tests/e2e/test_conversation.py
import pytest
from vibecode_agentapi import AgentAPIClient, SessionManager

@pytest.mark.asyncio
async def test_full_conversation_with_persistence():
    """Test complete conversation flow with session persistence."""
    config = AgentAPIConfig.from_env()
    session_manager = SessionManager(config.session_dir)

    async with AgentAPIClient(config) as client:
        # Start conversation
        agent = await client.start_agent("claude", workspace_id="e2e-test")

        # Multi-turn conversation
        response1 = await agent.send_message("What is Python?")
        assert "python" in response1.content.lower()

        response2 = await agent.send_message("What did I just ask?")
        assert "python" in response2.content.lower()

        # Save session
        for msg in await agent.get_messages():
            await session_manager.save_message(agent.agent_id, msg)

        agent_id = agent.agent_id
        await agent.stop()

    # Resume session in new client
    async with AgentAPIClient(config) as client:
        history = await session_manager.load_session(agent_id)
        assert len(history.messages) >= 4  # 2 user + 2 assistant

        # Verify context retained
        agent = await client.get_agent(agent_id)
        response3 = await agent.send_message("What was my first question?")
        assert "python" in response3.content.lower()

        await agent.stop()

    session_manager.close()
```

---

## 11. Package Configuration

### pyproject.toml

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "vibecode-agentapi"
version = "0.1.0"
description = "Production-ready async Python client for VibeCode AgentAPI"
readme = "README.md"
requires-python = ">=3.10"
license = {text = "MIT"}
authors = [
    {name = "VibeCode Team", email = "info@vibecode.dev"},
]
keywords = ["ai", "agents", "api", "async", "vibecode"]
classifiers = [
    "Development Status :: 4 - Beta",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: MIT License",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Framework :: AsyncIO",
    "Topic :: Software Development :: Libraries :: Python Modules",
]

dependencies = [
    "aiohttp>=3.9.0,<4.0.0",
    "pydantic>=2.0.0,<3.0.0",
    "pydantic-settings>=2.0.0,<3.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.21.0",
    "pytest-cov>=4.1.0",
    "mypy>=1.5.0",
    "ruff>=0.1.0",
    "black>=23.9.0",
]
redis = [
    "redis[hiredis]>=5.0.0",
]
all = [
    "vibecode-agentapi[dev,redis]",
]

[project.urls]
Homepage = "https://github.com/vibecode/agentapi-python"
Documentation = "https://docs.vibecode.dev/agentapi-python"
Repository = "https://github.com/vibecode/agentapi-python"
Issues = "https://github.com/vibecode/agentapi-python/issues"

[tool.hatch.build.targets.wheel]
packages = ["src/vibecode_agentapi"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = [
    "--strict-markers",
    "--strict-config",
    "--cov=vibecode_agentapi",
    "--cov-report=term-missing",
    "--cov-report=html",
]

[tool.mypy]
python_version = "3.10"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_any_generics = true
check_untyped_defs = true

[tool.ruff]
target-version = "py310"
line-length = 88
select = [
    "E",   # pycodestyle errors
    "W",   # pycodestyle warnings
    "F",   # pyflakes
    "I",   # isort
    "B",   # flake8-bugbear
    "C4",  # flake8-comprehensions
    "UP",  # pyupgrade
    "ARG", # flake8-unused-arguments
    "SIM", # flake8-simplify
]
ignore = [
    "E501",  # line too long (handled by black)
]

[tool.ruff.per-file-ignores]
"tests/*" = ["ARG", "S101"]

[tool.black]
line-length = 88
target-version = ["py310", "py311", "py312"]
```

---

## 12. Key Design Decisions

### Production-Ready Features

1. **Async-First Design**
   - All I/O operations use `asyncio`
   - Connection pooling with `aiohttp`
   - Parallel operation support with `asyncio.gather`

2. **Type Safety**
   - Pydantic v2 models for all data structures
   - Full type hints (mypy strict mode)
   - Runtime validation on all inputs

3. **Error Handling**
   - Comprehensive exception hierarchy
   - Automatic retry with exponential backoff + jitter
   - Rate limit handling with token bucket algorithm

4. **Resource Management**
   - Context manager protocol (`async with`)
   - Automatic connection cleanup
   - Session persistence with SQLite

5. **Event Streaming**
   - SSE client with reconnection logic
   - Async generator interface
   - Graceful degradation on connection loss

6. **Security**
   - API key management (not in code)
   - Secure header handling
   - No secrets in logs (repr=False)

### Architecture Patterns

- **SOLID Principles**: Single responsibility, dependency injection
- **Clean Architecture**: Separation of client, agent, session layers
- **Async Context Managers**: Resource safety with `async with`
- **Dependency Injection**: Client injected into Agent instances
- **Strategy Pattern**: Pluggable session backends (SQLite, JSON, Redis)

### Performance Optimizations

- **Connection Pooling**: Reuse HTTP connections
- **Rate Limiting**: Token bucket prevents API overload
- **Batch Operations**: `asyncio.gather` for parallel requests
- **Lazy Initialization**: Sessions created on demand
- **Streaming**: Memory-efficient event processing

---

## 13. Next Steps

### Implementation Roadmap

1. **Phase 1: Core Foundation**
   - Implement models, client, retry logic
   - Unit tests for all components
   - Basic documentation

2. **Phase 2: Agent Layer**
   - Agent abstraction with message handling
   - Event streaming with SSE
   - Integration tests

3. **Phase 3: Persistence**
   - Session manager with SQLite
   - Redis backend (optional)
   - E2E tests

4. **Phase 4: Polish**
   - Comprehensive documentation
   - Usage examples
   - Performance benchmarking
   - Security audit

### Testing Requirements

- Unit test coverage: >90%
- Integration tests against live API
- E2E tests for full workflows
- Load testing for connection pooling
- Mutation testing with `mutmut`

### Documentation Deliverables

- API reference (Sphinx)
- Usage guide with examples
- Migration guide (if applicable)
- Architecture documentation
- Contribution guidelines

---

## Summary

This design provides a production-ready Python SDK with:

- **Clean API**: Intuitive async interface with context managers
- **Type Safety**: Full Pydantic models and type hints
- **Robustness**: Retry logic, rate limiting, error handling
- **Scalability**: Connection pooling, async operations
- **Persistence**: Session management with multiple backends
- **Streaming**: SSE events with reconnection
- **Testing**: Comprehensive test strategy

The library follows modern Python best practices (PEP 8, type hints, async/await) and SOLID principles for maintainability and extensibility.
