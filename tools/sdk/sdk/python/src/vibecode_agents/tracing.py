"""Datadog tracing integration for VibeCode Agents SDK.

This module provides automatic tracing, logging, and metrics collection
using Datadog's ddtrace library.

Usage:
    # Auto-instrument at startup
    from vibecode_agents.tracing import init_datadog
    init_datadog()

    # Or use as a decorator
    from vibecode_agents.tracing import trace

    @trace(service="my-service", resource="my-operation")
    def my_function():
        pass

Environment Variables:
    DD_SERVICE: Service name (default: vibecode-agents)
    DD_ENV: Environment name (default: development)
    DD_VERSION: Service version (default: 0.1.0)
    DD_TRACE_ENABLED: Enable/disable tracing (default: true)
    DD_LOGS_INJECTION: Inject trace IDs into logs (default: true)
    DD_PROFILING_ENABLED: Enable profiling (default: false)
"""

from __future__ import annotations

import functools
import logging
import os
from typing import Any, Callable, Optional, TypeVar

logger = logging.getLogger(__name__)

# Type for decorated functions
F = TypeVar("F", bound=Callable[..., Any])


def init_datadog(
    service: Optional[str] = None,
    env: Optional[str] = None,
    version: Optional[str] = None,
    **kwargs: Any,
) -> bool:
    """Initialize Datadog tracing, logging, and metrics.

    Args:
        service: Service name (default: DD_SERVICE or vibecode-agents)
        env: Environment (default: DD_ENV or development)
        version: Version (default: DD_VERSION or 0.1.0)
        **kwargs: Additional ddtrace configuration options

    Returns:
        True if initialization succeeded, False otherwise
    """
    try:
        from ddtrace import config, patch_all, tracer
        from ddtrace.runtime import RuntimeMetrics
    except ImportError:
        logger.warning(
            "ddtrace not installed. Install with: pip install vibecode-agents[datadog]"
        )
        return False

    # Set configuration from args or environment
    service = service or os.getenv("DD_SERVICE", "vibecode-agents")
    env = env or os.getenv("DD_ENV", "development")
    version = version or os.getenv("DD_VERSION", "0.1.0")

    # Configure tracer
    tracer.configure(
        hostname=os.getenv("DD_AGENT_HOST", "localhost"),
        port=int(os.getenv("DD_TRACE_AGENT_PORT", "8126")),
    )

    # Set service info
    config.service = service
    config.env = env
    config.version = version

    # Enable log injection
    if os.getenv("DD_LOGS_INJECTION", "true").lower() == "true":
        config.logs_injection = True

    # Patch all supported libraries
    patch_all(
        logging=True,
        httpx=True,
        aiohttp=True,
        requests=True,
        asyncio=True,
        **kwargs,
    )

    # Enable runtime metrics
    RuntimeMetrics.enable()

    logger.info(
        "Datadog tracing initialized",
        extra={
            "dd.service": service,
            "dd.env": env,
            "dd.version": version,
        },
    )
    return True


def trace(
    service: Optional[str] = None,
    resource: Optional[str] = None,
    span_type: Optional[str] = None,
) -> Callable[[F], F]:
    """Decorator to add tracing to a function.

    Args:
        service: Service name for the span
        resource: Resource name for the span
        span_type: Type of span (web, db, cache, etc.)

    Returns:
        Decorated function with tracing

    Example:
        @trace(service="agent", resource="process_message")
        async def process_message(msg: str) -> str:
            return msg.upper()
    """
    def decorator(func: F) -> F:
        try:
            from ddtrace import tracer
        except ImportError:
            # If ddtrace not installed, return function unchanged
            return func

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            with tracer.trace(
                func.__name__,
                service=service,
                resource=resource or func.__name__,
                span_type=span_type,
            ) as span:
                span.set_tag("function", func.__qualname__)
                try:
                    result = func(*args, **kwargs)
                    span.set_tag("status", "success")
                    return result
                except Exception as e:
                    span.set_tag("status", "error")
                    span.set_tag("error.type", type(e).__name__)
                    span.set_tag("error.message", str(e))
                    raise

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            with tracer.trace(
                func.__name__,
                service=service,
                resource=resource or func.__name__,
                span_type=span_type,
            ) as span:
                span.set_tag("function", func.__qualname__)
                try:
                    result = await func(*args, **kwargs)
                    span.set_tag("status", "success")
                    return result
                except Exception as e:
                    span.set_tag("status", "error")
                    span.set_tag("error.type", type(e).__name__)
                    span.set_tag("error.message", str(e))
                    raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper  # type: ignore
        return sync_wrapper  # type: ignore

    return decorator


def get_current_trace_context() -> dict[str, str]:
    """Get current trace context for log correlation.

    Returns:
        Dictionary with trace_id and span_id if available
    """
    try:
        from ddtrace import tracer
        span = tracer.current_span()
        if span:
            return {
                "dd.trace_id": str(span.trace_id),
                "dd.span_id": str(span.span_id),
                "dd.service": span.service or "",
            }
    except ImportError:
        pass
    return {}


class DatadogLogFormatter(logging.Formatter):
    """Log formatter that injects Datadog trace context."""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record with trace context."""
        trace_context = get_current_trace_context()
        for key, value in trace_context.items():
            setattr(record, key, value)
        return super().format(record)


def setup_logging(
    level: int = logging.INFO,
    format_string: Optional[str] = None,
) -> None:
    """Configure logging with Datadog trace injection.

    Args:
        level: Log level (default: INFO)
        format_string: Custom format string (default includes trace IDs)
    """
    if format_string is None:
        format_string = (
            "%(asctime)s [%(levelname)s] %(name)s "
            "[dd.trace_id=%(dd.trace_id)s dd.span_id=%(dd.span_id)s] "
            "%(message)s"
        )

    handler = logging.StreamHandler()
    handler.setFormatter(DatadogLogFormatter(format_string))

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(handler)
