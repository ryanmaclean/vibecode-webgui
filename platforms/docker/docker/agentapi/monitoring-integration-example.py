#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
AgentAPI Monitoring Integration Example
Demonstrates how to integrate monitoring instrumentation into the AgentAPI server
"""

import os
import time
import json
from typing import Dict, Any, Optional
from enum import Enum
from dataclasses import dataclass

# Note: This is a Python example for the AgentAPI server
# The actual TypeScript instrumentation is in src/lib/monitoring/

# OpenTelemetry imports (to be added to requirements.txt)
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.prometheus import PrometheusMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.semconv.resource import ResourceAttributes

# Agent states
class AgentState(str, Enum):
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    STOPPED = "stopped"
    FAILED = "failed"
    TIMEOUT = "timeout"

# Agent types
class AgentType(str, Enum):
    AIDER = "aider"
    GOOSE = "goose"
    CLINE = "cline"

@dataclass
class AgentMetrics:
    agent_id: str
    agent_type: AgentType
    state: AgentState
    start_time: float
    last_activity: float
    task_duration: Optional[float] = None
    error_count: int = 0
    output_lines: int = 0


class AgentAPIMonitoring:
    """AgentAPI monitoring instrumentation"""

    def __init__(self):
        self.setup_telemetry()
        self.active_agents: Dict[str, AgentMetrics] = {}

    def setup_telemetry(self):
        """Initialize OpenTelemetry instrumentation"""
        # Create resource with service information
        resource = Resource.create({
            ResourceAttributes.SERVICE_NAME: "agentapi",
            ResourceAttributes.SERVICE_VERSION: "1.0.0",
            ResourceAttributes.SERVICE_NAMESPACE: "vibecode",
            ResourceAttributes.DEPLOYMENT_ENVIRONMENT: os.getenv("NODE_ENV", "development")
        })

        # Setup tracing
        trace_provider = TracerProvider(resource=resource)
        otlp_exporter = OTLPSpanExporter(
            endpoint=os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "http://localhost:4318/v1/traces")
        )
        trace_provider.add_span_processor(otlp_exporter)
        trace.set_tracer_provider(trace_provider)

        # Setup metrics
        prometheus_reader = PrometheusMetricReader()
        meter_provider = MeterProvider(resource=resource, metric_readers=[prometheus_reader])
        metrics.set_meter_provider(meter_provider)

        # Get meter for creating metrics
        self.meter = metrics.get_meter("agentapi-metrics")

        # Create metrics
        self.agent_task_duration = self.meter.create_histogram(
            "agent_task_duration_seconds",
            description="Duration of agent task execution in seconds",
            unit="s"
        )

        self.agent_success_total = self.meter.create_counter(
            "agent_success_total",
            description="Total number of successfully completed agent tasks",
            unit="1"
        )

        self.agent_failure_total = self.meter.create_counter(
            "agent_failure_total",
            description="Total number of failed agent tasks",
            unit="1"
        )

        self.agent_output_lines_total = self.meter.create_counter(
            "agent_output_lines_total",
            description="Total lines of output produced by agents",
            unit="1"
        )

        self.agent_errors_total = self.meter.create_counter(
            "agent_errors_total",
            description="Total errors encountered by agents",
            unit="1"
        )

        self.http_requests_total = self.meter.create_counter(
            "http_requests_total",
            description="Total HTTP requests to AgentAPI",
            unit="1"
        )

        self.http_request_duration = self.meter.create_histogram(
            "http_request_duration_seconds",
            description="HTTP request duration in seconds",
            unit="s"
        )

        # Get tracer
        self.tracer = trace.get_tracer("agentapi-instrumentation")

        print("✅ AgentAPI monitoring initialized")

    def start_agent_task(self, agent_id: str, agent_type: AgentType,
                        workspace: str, files: list, task: str, model: str = None):
        """Start tracing an agent task"""
        with self.tracer.start_as_current_span("agent.task") as span:
            span.set_attributes({
                "agent.id": agent_id,
                "agent.type": agent_type.value,
                "agent.workspace": workspace,
                "agent.files": ",".join(files),
                "agent.task": task,
                "agent.model": model or "default",
                "agent.files_count": len(files)
            })

            # Initialize agent metrics
            self.active_agents[agent_id] = AgentMetrics(
                agent_id=agent_id,
                agent_type=agent_type,
                state=AgentState.STARTING,
                start_time=time.time(),
                last_activity=time.time()
            )

            return span

    def update_agent_state(self, agent_id: str, new_state: AgentState, span=None):
        """Update agent state transition"""
        if agent_id not in self.active_agents:
            return

        agent = self.active_agents[agent_id]
        old_state = agent.state
        agent.state = new_state
        agent.last_activity = time.time()

        if span:
            span.add_event("agent.state_change", {
                "agent.state.from": old_state.value,
                "agent.state.to": new_state.value,
                "agent.uptime_ms": (time.time() - agent.start_time) * 1000
            })

    def record_agent_output(self, agent_id: str, line_count: int = 1, span=None):
        """Record agent output lines"""
        if agent_id not in self.active_agents:
            return

        agent = self.active_agents[agent_id]
        agent.output_lines += line_count
        agent.last_activity = time.time()

        self.agent_output_lines_total.add(
            line_count,
            {"agent_id": agent_id, "agent_type": agent.agent_type.value}
        )

        if span:
            span.set_attribute("agent.output_lines", agent.output_lines)

    def record_agent_error(self, agent_id: str, error_type: str, error_message: str, span=None):
        """Record agent error"""
        if agent_id not in self.active_agents:
            return

        agent = self.active_agents[agent_id]
        agent.error_count += 1

        self.agent_errors_total.add(
            1,
            {
                "agent_id": agent_id,
                "agent_type": agent.agent_type.value,
                "error_type": error_type
            }
        )

        if span:
            span.record_exception(Exception(error_message))
            span.set_attribute("agent.error_count", agent.error_count)
            span.set_status(trace.Status(trace.StatusCode.ERROR, error_message))

    def complete_agent_task(self, agent_id: str, span=None):
        """Complete agent task successfully"""
        if agent_id not in self.active_agents:
            return

        agent = self.active_agents[agent_id]
        duration = time.time() - agent.start_time
        agent.task_duration = duration
        agent.state = AgentState.STOPPED

        self.agent_task_duration.record(
            duration,
            {"agent_type": agent.agent_type.value, "success": "true"}
        )

        self.agent_success_total.add(
            1,
            {"agent_type": agent.agent_type.value}
        )

        if span:
            span.set_attributes({
                "agent.duration_seconds": duration,
                "agent.output_lines": agent.output_lines,
                "agent.error_count": agent.error_count
            })
            span.set_status(trace.Status(trace.StatusCode.OK))
            span.end()

        # Remove from active agents after delay
        # In production, use async scheduling
        del self.active_agents[agent_id]

    def fail_agent_task(self, agent_id: str, reason: str, span=None):
        """Fail agent task"""
        if agent_id not in self.active_agents:
            return

        agent = self.active_agents[agent_id]
        duration = time.time() - agent.start_time
        agent.task_duration = duration
        agent.state = AgentState.FAILED

        self.agent_task_duration.record(
            duration,
            {
                "agent_type": agent.agent_type.value,
                "success": "false",
                "failure_reason": reason
            }
        )

        self.agent_failure_total.add(
            1,
            {"agent_type": agent.agent_type.value, "failure_reason": reason}
        )

        if span:
            span.set_attributes({
                "agent.duration_seconds": duration,
                "agent.failure_reason": reason,
                "agent.error_count": agent.error_count
            })
            span.set_status(trace.Status(trace.StatusCode.ERROR, reason))
            span.end()

        # Remove from active agents
        del self.active_agents[agent_id]

    def track_http_request(self, method: str, path: str, status_code: int, duration: float):
        """Track HTTP request metrics"""
        self.http_requests_total.add(
            1,
            {
                "method": method,
                "route": path,
                "status_code": str(status_code)
            }
        )

        self.http_request_duration.record(
            duration,
            {
                "method": method,
                "route": path,
                "status_code": str(status_code)
            }
        )


# Example usage in AgentAPI server
def example_agent_start_handler(monitoring: AgentAPIMonitoring):
    """Example handler for /v1/agents/start endpoint"""

    # Extract request data
    agent_id = "agent-123"
    agent_type = AgentType.AIDER
    workspace = "/workspace/project"
    files = ["src/main.py", "tests/test_main.py"]
    task = "Add error handling to main function"
    model = "claude-3-5-sonnet"

    # Start tracing
    span = monitoring.start_agent_task(
        agent_id,
        agent_type,
        workspace,
        files,
        task,
        model
    )

    try:
        # Update state to running
        monitoring.update_agent_state(agent_id, AgentState.RUNNING, span)

        # Simulate agent execution
        time.sleep(1)

        # Record output
        monitoring.record_agent_output(agent_id, 10, span)

        # Simulate more execution
        time.sleep(2)

        # Record more output
        monitoring.record_agent_output(agent_id, 25, span)

        # Complete successfully
        monitoring.complete_agent_task(agent_id, span)

        return {"status": "success", "agent_id": agent_id}

    except Exception as e:
        # Record error and fail task
        monitoring.record_agent_error(
            agent_id,
            "ExecutionError",
            str(e),
            span
        )
        monitoring.fail_agent_task(agent_id, str(e), span)

        return {"status": "error", "error": str(e)}


def example_http_middleware(monitoring: AgentAPIMonitoring):
    """Example HTTP middleware for tracking requests"""

    def middleware(request, handler):
        start_time = time.time()

        try:
            # Call handler
            response = handler(request)

            # Track successful request
            duration = time.time() - start_time
            monitoring.track_http_request(
                request.method,
                request.path,
                response.status_code,
                duration
            )

            return response

        except Exception as e:
            # Track failed request
            duration = time.time() - start_time
            monitoring.track_http_request(
                request.method,
                request.path,
                500,
                duration
            )
            raise

    return middleware


if __name__ == "__main__":
    # Initialize monitoring
    monitoring = AgentAPIMonitoring()

    # Example: Track an agent task
    result = example_agent_start_handler(monitoring)
    print(f"Agent task result: {json.dumps(result, indent=2)}")

    print("\n✅ Monitoring integration example complete")
    print("📊 Metrics available at http://localhost:9090/metrics")
    print("🔍 Traces sent to OTLP endpoint")