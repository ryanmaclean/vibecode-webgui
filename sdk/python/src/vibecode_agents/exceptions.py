"""
Custom exceptions for VibeCode Agents SDK

Production-ready exception hierarchy with detailed error information.
"""

from typing import Optional


class AgentAPIError(Exception):
    """Base exception for all Agent API errors"""

    def __init__(
        self,
        message: str,
        status_code: int,
        retry_after: Optional[int] = None,
    ):
        """
        Initialize API error

        Args:
            message: Human-readable error message
            status_code: HTTP status code
            retry_after: Seconds until retry allowed (429 only)
        """
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.retry_after = retry_after

    def __str__(self) -> str:
        if self.retry_after:
            return f"{self.message} (status: {self.status_code}, retry after: {self.retry_after}s)"
        return f"{self.message} (status: {self.status_code})"


class AuthenticationError(AgentAPIError):
    """Authentication failed (401/403)"""

    pass


class NotFoundError(AgentAPIError):
    """Resource not found (404)"""

    pass


class ValidationError(AgentAPIError):
    """Request validation failed (422)"""

    pass


class RateLimitError(AgentAPIError):
    """Rate limit exceeded (429)"""

    pass


class StreamError(Exception):
    """Error in event stream or WebSocket"""

    pass


class ConnectionError(StreamError):
    """Failed to establish or maintain connection"""

    pass


class MessageError(StreamError):
    """Failed to send or receive message"""

    pass
