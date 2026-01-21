"""
Data models for VibeCode Agents API

Type-safe Pydantic models matching the OpenAPI specification.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class AgentType(str, Enum):
    """Supported AI coding agent types"""

    AIDER = "aider"
    GOOSE = "goose"
    CLINE = "cline"


class ModelType(str, Enum):
    """Supported LLM models"""

    CLAUDE_3_5_SONNET = "claude-3-5-sonnet-20241022"
    CLAUDE_3_5_HAIKU = "claude-3-5-haiku-20241022"
    GPT_4O = "gpt-4o"
    GPT_4O_MINI = "gpt-4o-mini"
    DEEPSEEK_CHAT = "deepseek-chat"


class AgentStatus(str, Enum):
    """Agent execution status"""

    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    STOPPED = "stopped"
    ERROR = "error"


class HealthStatus(str, Enum):
    """Health check status"""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class ComponentHealthStatus(str, Enum):
    """Component health check status"""

    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"


class MessageType(str, Enum):
    """Message type for agent communication"""

    USER = "user"
    SYSTEM = "system"


class SSEEventType(str, Enum):
    """Server-Sent Events types"""

    OUTPUT = "output"
    STATUS = "status"
    ERROR = "error"
    COMPLETE = "complete"
    HEARTBEAT = "heartbeat"


class StartAgentRequest(BaseModel):
    """Request to start a new agent"""

    agent_type: AgentType = Field(..., description="Type of agent to start")
    workspace: str = Field(
        ...,
        description="Absolute path to workspace directory",
        pattern=r"^/home/coder/workspace.*",
    )
    files: Optional[List[str]] = Field(
        None, description="Files for agent to work on (relative to workspace)", max_length=50
    )
    model: ModelType = Field(..., description="LLM model identifier")
    task: str = Field(..., description="Task description for the agent", min_length=10, max_length=2000)
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    @field_validator("workspace")
    @classmethod
    def validate_workspace(cls, v: str) -> str:
        if not v.startswith("/home/coder/workspace"):
            raise ValueError("Workspace must start with /home/coder/workspace")
        return v


class AgentMessageRequest(BaseModel):
    """Request to send message to agent"""

    message: str = Field(..., description="Message content", min_length=1, max_length=5000)
    type: MessageType = Field(MessageType.USER, description="Message type")


class ListAgentsQuery(BaseModel):
    """Query parameters for listing agents"""

    status: Optional[AgentStatus] = None
    agent_type: Optional[AgentType] = None
    page: int = Field(1, ge=1, description="Page number (1-indexed)")
    limit: int = Field(50, ge=1, le=100, description="Items per page")


class StopAgentQuery(BaseModel):
    """Query parameters for stopping agent"""

    force: bool = Field(False, description="Force immediate termination (SIGKILL)")


class StreamEventsQuery(BaseModel):
    """Query parameters for streaming events"""

    from_sequence: Optional[int] = Field(None, description="Resume from sequence number")


class ResourceUsage(BaseModel):
    """Resource usage metrics"""

    cpu_percent: float = Field(..., description="CPU usage percentage")
    memory_mb: float = Field(..., description="Memory usage in megabytes")
    disk_io_mb: float = Field(..., description="Disk I/O in megabytes")


class AgentResponse(BaseModel):
    """Basic agent response"""

    agent_id: str = Field(..., description="Unique agent identifier", pattern=r"^(aider|goose|cline)-[a-f0-9]{8}$")
    status: AgentStatus = Field(..., description="Current agent status")
    terminal_id: str = Field(..., description="Associated terminal session ID")
    pid: Optional[int] = Field(None, description="Process ID of the agent")
    command: Optional[str] = Field(None, description="Command used to start agent")
    created_at: datetime = Field(..., description="Agent creation timestamp")
    stream_url: Optional[str] = Field(None, description="URL for SSE event stream")
    ws_url: Optional[str] = Field(None, description="URL for WebSocket connection")


class AgentStatusResponse(AgentResponse):
    """Detailed agent status response"""

    agent_type: AgentType = Field(..., description="Type of agent")
    workspace: str = Field(..., description="Workspace directory path")
    uptime_seconds: float = Field(..., description="Agent uptime in seconds")
    exit_code: Optional[int] = Field(None, description="Exit code (null if running)")
    resource_usage: Optional[ResourceUsage] = Field(None, description="Resource metrics")
    output_lines: Optional[int] = Field(None, description="Number of output lines")
    last_output: Optional[str] = Field(None, description="Most recent output line")
    last_output_at: Optional[datetime] = Field(None, description="Last output timestamp")


class Pagination(BaseModel):
    """Pagination metadata"""

    page: int = Field(..., description="Current page number")
    limit: int = Field(..., description="Items per page")
    total: int = Field(..., description="Total number of items")
    pages: int = Field(..., description="Total number of pages")


class AgentListSummary(BaseModel):
    """Agent list summary statistics"""

    active: int = Field(..., description="Number of running agents")
    completed: int = Field(..., description="Number of completed agents")
    failed: int = Field(..., description="Number of failed agents")
    by_type: Dict[str, int] = Field(..., description="Agent counts by type")


class AgentListResponse(BaseModel):
    """Response for listing agents"""

    agents: List[AgentStatusResponse] = Field(..., description="Array of agent status objects")
    pagination: Pagination = Field(..., description="Pagination metadata")
    summary: Optional[AgentListSummary] = Field(None, description="Summary statistics")


class StopAgentResponse(BaseModel):
    """Response for stopping agent"""

    agent_id: str = Field(..., description="Agent identifier")
    status: str = Field("stopped", description="Status after stopping")
    message: str = Field(..., description="Success message")
    stopped_at: datetime = Field(..., description="Stop timestamp")
    exit_code: Optional[int] = Field(None, description="Exit code if graceful")
    forced: bool = Field(..., description="Whether force termination was used")


class SendMessageResponse(BaseModel):
    """Response for sending message to agent"""

    message_id: str = Field(..., description="Unique message identifier (UUID)")
    status: str = Field(..., description="Message delivery status")
    timestamp: datetime = Field(..., description="Message sent timestamp")


class ComponentHealth(BaseModel):
    """Component health check result"""

    status: ComponentHealthStatus = Field(..., description="Component health status")
    response_time_ms: float = Field(..., description="Response time in milliseconds")
    error: Optional[str] = Field(None, description="Error message if failed")


class AgentCapacity(BaseModel):
    """Agent capacity information"""

    active: int = Field(..., description="Current active agents")
    max_concurrent: int = Field(..., description="Max concurrent agents globally")
    user_limit: int = Field(..., description="Max concurrent agents per user")


class HealthResponse(BaseModel):
    """Health check response"""

    status: HealthStatus = Field(..., description="Overall health status")
    version: str = Field(..., description="API version")
    timestamp: datetime = Field(..., description="Health check timestamp")
    checks: Optional[Dict[str, ComponentHealth]] = Field(None, description="Component checks")
    agents: Optional[AgentCapacity] = Field(None, description="Agent capacity")
    uptime_seconds: Optional[float] = Field(None, description="Service uptime")


class ProblemDetails(BaseModel):
    """RFC 7807 Problem Details for HTTP APIs"""

    type: str = Field(..., description="URI identifying the problem type")
    title: str = Field(..., description="Short human-readable summary")
    status: int = Field(..., description="HTTP status code")
    detail: Optional[str] = Field(None, description="Human-readable explanation")
    instance: Optional[str] = Field(None, description="URI identifying specific occurrence")
    trace_id: Optional[str] = Field(None, description="Distributed tracing ID")


class OutputEventData(BaseModel):
    """Agent output event data"""

    timestamp: datetime = Field(..., description="Event timestamp")
    line: str = Field(..., description="Output line content")


class StatusEventData(BaseModel):
    """Status change event data"""

    timestamp: datetime = Field(..., description="Event timestamp")
    status: AgentStatus = Field(..., description="New agent status")
    progress: Optional[float] = Field(None, ge=0.0, le=1.0, description="Task progress")


class ErrorEventData(BaseModel):
    """Error event data"""

    timestamp: datetime = Field(..., description="Event timestamp")
    error: str = Field(..., description="Error message")
    code: Optional[str] = Field(None, description="Error code")


class CompleteEventData(BaseModel):
    """Completion event data"""

    timestamp: datetime = Field(..., description="Event timestamp")
    status: str = Field(..., description="Final agent status")
    exit_code: int = Field(..., description="Exit code")


class HeartbeatEventData(BaseModel):
    """Heartbeat event data (keep-alive)"""

    timestamp: datetime = Field(..., description="Event timestamp")


class SSEEvent(BaseModel):
    """Server-Sent Event structure"""

    id: str = Field(..., description="Event sequence number")
    event: SSEEventType = Field(..., description="Event type")
    data: Dict[str, Any] = Field(..., description="Event data payload")


class RateLimitInfo(BaseModel):
    """Rate limit information"""

    limit: int = Field(..., description="Maximum requests per window")
    remaining: int = Field(..., description="Remaining requests")
    reset: int = Field(..., description="Reset timestamp (Unix)")
    retry_after: Optional[int] = Field(None, description="Seconds until reset (429 only)")
