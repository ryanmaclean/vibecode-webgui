#!/usr/bin/env python3
"""
Unified AI Agent Telemetry for Datadog
Collects metrics for: Ralph Loop, Sequential Thinking, Claude Code, Gas Town, OpenAI/Codex

Usage:
    from scripts.lib.ai_agent_telemetry import AIAgentTelemetry

    telemetry = AIAgentTelemetry()

    # Track Claude API call
    with telemetry.track_claude_request(model="claude-3-opus") as tracker:
        response = client.messages.create(...)
        tracker.set_tokens(input=100, output=50)

    # Track Ralph loop iteration
    with telemetry.track_ralph_iteration(session_id="abc123") as tracker:
        # do work
        tracker.set_outcome("success")
        tracker.set_thought_count(5)
"""

from __future__ import annotations

import os
import time
import socket
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, Generator
from functools import wraps

# Datadog tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
    DD_ENABLED = True
except ImportError:
    DD_ENABLED = False
    tracer = None

# DogStatsD for metrics
try:
    from datadog import DogStatsd
    statsd = DogStatsd(
        host=os.getenv("DD_AGENT_HOST", "127.0.0.1"),
        port=int(os.getenv("DD_DOGSTATSD_PORT", "8125")),
        namespace="ai_agent"
    )
    STATSD_ENABLED = True
except ImportError:
    STATSD_ENABLED = False
    statsd = None


# Model pricing (USD per 1M tokens) - updated Jan 2026
MODEL_PRICING = {
    # Anthropic
    "claude-3-opus": {"input": 15.00, "output": 75.00},
    "claude-3-sonnet": {"input": 3.00, "output": 15.00},
    "claude-3-haiku": {"input": 0.25, "output": 1.25},
    "claude-3.5-sonnet": {"input": 3.00, "output": 15.00},
    "claude-opus-4": {"input": 15.00, "output": 75.00},
    "claude-sonnet-4": {"input": 3.00, "output": 15.00},
    # OpenAI
    "gpt-4": {"input": 30.00, "output": 60.00},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    "gpt-4o": {"input": 5.00, "output": 15.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
    # Ollama (local, no cost)
    "llama3": {"input": 0.0, "output": 0.0},
    "codellama": {"input": 0.0, "output": 0.0},
    "mistral": {"input": 0.0, "output": 0.0},
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost in microcents (1 USD = 1,000,000 microcents)"""
    pricing = MODEL_PRICING.get(model, {"input": 0, "output": 0})
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return (input_cost + output_cost) * 1_000_000  # Convert to microcents


@dataclass
class RequestTracker:
    """Tracks a single request's metrics"""
    provider: str
    model: str
    start_time: float = field(default_factory=time.time)
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    success: bool = True
    error_type: Optional[str] = None
    extra_tags: Dict[str, str] = field(default_factory=dict)

    def set_tokens(self, input: int = 0, output: int = 0,
                   cache_read: int = 0, cache_write: int = 0):
        self.input_tokens = input
        self.output_tokens = output
        self.cache_read_tokens = cache_read
        self.cache_write_tokens = cache_write

    def set_error(self, error_type: str):
        self.success = False
        self.error_type = error_type

    def set_outcome(self, outcome: str):
        self.extra_tags["outcome"] = outcome
        self.success = outcome == "success"

    def set_thought_count(self, count: int):
        self.extra_tags["thought_count"] = str(count)

    @property
    def duration_ms(self) -> float:
        return (time.time() - self.start_time) * 1000

    @property
    def cost_microcents(self) -> float:
        return calculate_cost(self.model, self.input_tokens, self.output_tokens)


class AIAgentTelemetry:
    """Unified telemetry for all AI agents"""

    def __init__(self, service_name: str = "ai-agent"):
        self.service_name = service_name
        self.default_tags = [
            f"service:{service_name}",
            f"env:{os.getenv('DD_ENV', 'dev')}",
            f"host:{socket.gethostname()}"
        ]

    def _send_metric(self, name: str, value: float, metric_type: str = "count",
                     tags: Optional[list] = None):
        """Send metric to DogStatsD"""
        if not STATSD_ENABLED or statsd is None:
            return

        all_tags = self.default_tags + (tags or [])

        if metric_type == "count":
            statsd.increment(name, value, tags=all_tags)
        elif metric_type == "gauge":
            statsd.gauge(name, value, tags=all_tags)
        elif metric_type == "histogram":
            statsd.histogram(name, value, tags=all_tags)

    def _finalize_tracker(self, tracker: RequestTracker):
        """Send all metrics for a completed request"""
        provider = tracker.provider
        model = tracker.model

        base_tags = [
            f"provider:{provider}",
            f"model:{model}",
            f"status:{'success' if tracker.success else 'error'}"
        ]
        base_tags.extend([f"{k}:{v}" for k, v in tracker.extra_tags.items()])

        # Provider-specific metrics
        prefix = f"{provider}.api"
        self._send_metric(f"{prefix}.request.count", 1, "count", base_tags)
        self._send_metric(f"{prefix}.request.duration_ms", tracker.duration_ms,
                         "histogram", base_tags)

        if tracker.input_tokens > 0:
            self._send_metric(f"{prefix}.tokens.input", tracker.input_tokens,
                            "count", base_tags)
        if tracker.output_tokens > 0:
            self._send_metric(f"{prefix}.tokens.output", tracker.output_tokens,
                            "count", base_tags)

        if tracker.cache_read_tokens > 0:
            self._send_metric(f"{prefix}.tokens.cache_read", tracker.cache_read_tokens,
                            "count", base_tags)
        if tracker.cache_write_tokens > 0:
            self._send_metric(f"{prefix}.tokens.cache_write", tracker.cache_write_tokens,
                            "count", base_tags)

        # Cost tracking
        if tracker.cost_microcents > 0:
            self._send_metric(f"{prefix}.cost_usd", tracker.cost_microcents,
                            "count", base_tags)

        # Error tracking
        if not tracker.success:
            error_tags = base_tags + [f"error_type:{tracker.error_type or 'unknown'}"]
            self._send_metric(f"{prefix}.error.count", 1, "count", error_tags)

        # Unified agent metrics
        unified_tags = base_tags + [f"agent_type:{self.service_name}"]
        self._send_metric("request.count", 1, "count", unified_tags)
        self._send_metric("request.duration_ms", tracker.duration_ms, "histogram", unified_tags)
        self._send_metric("tokens.total", tracker.input_tokens, "count",
                         unified_tags + ["direction:input"])
        self._send_metric("tokens.total", tracker.output_tokens, "count",
                         unified_tags + ["direction:output"])
        self._send_metric("cost.total_usd", tracker.cost_microcents, "count", unified_tags)

    @contextmanager
    def track_claude_request(self, model: str = "claude-3-sonnet",
                             **extra_tags) -> Generator[RequestTracker, None, None]:
        """Track a Claude/Anthropic API request"""
        tracker = RequestTracker(provider="anthropic", model=model)
        tracker.extra_tags.update(extra_tags)

        span = None
        if DD_ENABLED and tracer:
            span = tracer.trace("claude.api.request", service=self.service_name)
            span.set_tag("model", model)

        try:
            yield tracker
        except Exception as e:
            tracker.set_error(type(e).__name__)
            raise
        finally:
            if span:
                span.set_tag("tokens.input", tracker.input_tokens)
                span.set_tag("tokens.output", tracker.output_tokens)
                span.set_tag("duration_ms", tracker.duration_ms)
                span.finish()
            self._finalize_tracker(tracker)

    @contextmanager
    def track_openai_request(self, model: str = "gpt-4",
                             **extra_tags) -> Generator[RequestTracker, None, None]:
        """Track an OpenAI API request"""
        tracker = RequestTracker(provider="openai", model=model)
        tracker.extra_tags.update(extra_tags)

        span = None
        if DD_ENABLED and tracer:
            span = tracer.trace("openai.api.request", service=self.service_name)
            span.set_tag("model", model)

        try:
            yield tracker
        except Exception as e:
            tracker.set_error(type(e).__name__)
            raise
        finally:
            if span:
                span.set_tag("tokens.input", tracker.input_tokens)
                span.set_tag("tokens.output", tracker.output_tokens)
                span.finish()
            self._finalize_tracker(tracker)

    @contextmanager
    def track_ralph_iteration(self, session_id: str,
                              **extra_tags) -> Generator[RequestTracker, None, None]:
        """Track a Ralph loop iteration"""
        tracker = RequestTracker(provider="ralph", model="sequential-thinking")
        tracker.extra_tags["session_id"] = session_id
        tracker.extra_tags.update(extra_tags)

        span = None
        if DD_ENABLED and tracer:
            span = tracer.trace("ralph.loop.iteration", service="ralph-loop")
            span.set_tag("session_id", session_id)

        try:
            yield tracker
        except Exception as e:
            tracker.set_error(type(e).__name__)
            raise
        finally:
            if span:
                span.set_tag("outcome", tracker.extra_tags.get("outcome", "unknown"))
                span.finish()

            # Ralph-specific metrics
            tags = [f"session_id:{session_id}",
                   f"outcome:{tracker.extra_tags.get('outcome', 'unknown')}"]
            self._send_metric("ralph.loop.iteration", 1, "count", tags)
            self._send_metric("ralph.loop.duration_ms", tracker.duration_ms,
                            "histogram", tags)

            if "thought_count" in tracker.extra_tags:
                self._send_metric("ralph.thinking.thought_count",
                                int(tracker.extra_tags["thought_count"]),
                                "histogram", tags)

    @contextmanager
    def track_sequential_thinking(self, model: str = "claude-3-sonnet",
                                  **extra_tags) -> Generator[RequestTracker, None, None]:
        """Track a sequential thinking request"""
        tracker = RequestTracker(provider="sequential-thinking", model=model)
        tracker.extra_tags.update(extra_tags)

        span = None
        if DD_ENABLED and tracer:
            span = tracer.trace("sequential_thinking.request",
                               service="sequential-thinking")
            span.set_tag("model", model)

        try:
            yield tracker
        except Exception as e:
            tracker.set_error(type(e).__name__)
            # Track fallback
            self._send_metric("sequential_thinking.fallback.count", 1, "count",
                            [f"reason:{type(e).__name__}", f"from_model:{model}"])
            raise
        finally:
            if span:
                span.finish()

            tags = [f"model:{model}"]
            self._send_metric("sequential_thinking.request.count", 1, "count", tags)
            self._send_metric("sequential_thinking.request.duration_ms",
                            tracker.duration_ms, "histogram", tags)

    def track_polecat_spawn(self, rig_name: str, agent_type: str = "claude",
                           priority: str = "normal"):
        """Track polecat spawn event"""
        tags = [f"rig_name:{rig_name}", f"agent_type:{agent_type}",
                f"priority:{priority}"]
        self._send_metric("gastown.polecats.spawned", 1, "count", tags)

    def track_polecat_complete(self, rig_name: str, success: bool = True,
                               duration_s: float = 0, tokens_used: int = 0,
                               cost_usd: float = 0):
        """Track polecat completion"""
        tags = [f"rig_name:{rig_name}", f"success:{str(success).lower()}"]

        if success:
            self._send_metric("gastown.polecats.completed", 1, "count", tags)
        else:
            self._send_metric("gastown.polecats.failed", 1, "count", tags)

        self._send_metric("gastown.polecat.duration_s", duration_s, "histogram", tags)
        if tokens_used > 0:
            self._send_metric("gastown.polecat.tokens_used", tokens_used, "count", tags)
        if cost_usd > 0:
            self._send_metric("gastown.polecat.cost_usd", cost_usd * 1_000_000,
                            "count", tags)

    def set_active_polecats(self, rig_name: str, count: int):
        """Set gauge for active polecats"""
        self._send_metric("gastown.polecats.active", count, "gauge",
                         [f"rig_name:{rig_name}"])

    def track_tool_use(self, tool_name: str, model: str, success: bool = True,
                       duration_ms: float = 0):
        """Track tool use call"""
        tags = [f"tool_name:{tool_name}", f"model:{model}",
                f"success:{str(success).lower()}"]
        self._send_metric("claude.tool_use.count", 1, "count", tags)
        self._send_metric("claude.tool_use.duration_ms", duration_ms, "histogram", tags)

    def track_routing_decision(self, selected_provider: str, selected_model: str,
                               reason: str = "default"):
        """Track model routing decision"""
        tags = [f"selected_provider:{selected_provider}",
                f"selected_model:{selected_model}",
                f"reason:{reason}"]
        self._send_metric("routing.decision", 1, "count", tags)


# Decorator for easy function instrumentation
def track_ai_call(provider: str = "anthropic", model: str = "claude-3-sonnet"):
    """Decorator to track AI API calls"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            telemetry = AIAgentTelemetry()
            if provider == "anthropic":
                ctx = telemetry.track_claude_request(model=model)
            elif provider == "openai":
                ctx = telemetry.track_openai_request(model=model)
            else:
                ctx = telemetry.track_claude_request(model=model)

            with ctx as tracker:
                result = func(*args, **kwargs)
                # Try to extract token counts from response
                if hasattr(result, 'usage'):
                    tracker.set_tokens(
                        input=getattr(result.usage, 'input_tokens', 0),
                        output=getattr(result.usage, 'output_tokens', 0)
                    )
                return result
        return wrapper
    return decorator


# Global instance for convenience
_telemetry = None

def get_telemetry(service_name: str = "ai-agent") -> AIAgentTelemetry:
    """Get or create global telemetry instance"""
    global _telemetry
    if _telemetry is None:
        _telemetry = AIAgentTelemetry(service_name)
    return _telemetry


if __name__ == "__main__":
    # Test the telemetry
    telemetry = AIAgentTelemetry(service_name="test-agent")

    print("Testing AI Agent Telemetry...")

    # Test Claude tracking
    with telemetry.track_claude_request(model="claude-3-sonnet") as t:
        time.sleep(0.1)
        t.set_tokens(input=100, output=50)
    print(f"Claude request: {t.duration_ms:.2f}ms, cost: ${t.cost_microcents/1_000_000:.6f}")

    # Test Ralph loop
    with telemetry.track_ralph_iteration(session_id="test-123") as t:
        time.sleep(0.05)
        t.set_outcome("success")
        t.set_thought_count(5)
    print(f"Ralph iteration: {t.duration_ms:.2f}ms")

    # Test polecat tracking
    telemetry.track_polecat_spawn("vibecode-107", "claude", "high")
    telemetry.set_active_polecats("vibecode-107", 5)
    telemetry.track_polecat_complete("vibecode-107", success=True,
                                      duration_s=120, tokens_used=5000)
    print("Polecat metrics sent")

    print("\nTelemetry test complete!")
