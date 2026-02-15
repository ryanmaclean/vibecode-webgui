"""
OpenTelemetry Telemetry Initialization for AgentAPI
Provides tracing and metrics instrumentation for the AgentAPI service
"""

import logging
from typing import Optional, Any

# Lazy imports - only import OpenTelemetry when needed
try:
    from opentelemetry import trace, metrics
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
    from opentelemetry.instrumentation.aiohttp_server import AioHttpServerInstrumentor
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False
    trace = None
    metrics = None
    TracerProvider = None
    MeterProvider = None

try:
    from otel_config import config
except ImportError:
    # Fallback config if otel_config is not available
    class FallbackConfig:
        enabled = False
        service_name = 'agentapi'
        resource_attributes = {}
        exporter_otlp_endpoint = 'http://localhost:4318'
        metrics_export_interval = 60000
    config = FallbackConfig()

logger = logging.getLogger(__name__)

# Global state
_initialized = False
_tracer_provider: Optional[Any] = None
_meter_provider: Optional[Any] = None


def init_telemetry(service_name: Optional[str] = None) -> Any:
    """
    Initialize OpenTelemetry instrumentation

    Args:
        service_name: Optional service name (defaults to config.service_name)

    Returns:
        Tracer instance for manual instrumentation (or None if unavailable)
    """
    global _initialized, _tracer_provider, _meter_provider

    if not OTEL_AVAILABLE:
        logger.warning("OpenTelemetry not available - telemetry disabled")
        _initialized = True
        return None

    if _initialized:
        logger.debug("Telemetry already initialized, returning existing tracer")
        return trace.get_tracer(service_name or config.service_name)

    if not config.enabled:
        logger.info("OpenTelemetry disabled via OTEL_ENABLED=false")
        _initialized = True
        return trace.get_tracer(service_name or config.service_name)

    try:
        # Create resource with service information
        resource = Resource.create(config.resource_attributes)

        # Initialize tracing
        _init_tracing(resource)

        # Initialize metrics
        _init_metrics(resource)

        # Auto-instrument aiohttp server
        AioHttpServerInstrumentor().instrument()

        _initialized = True
        logger.info(
            f"OpenTelemetry initialized: service={config.service_name} "
            f"endpoint={config.exporter_otlp_endpoint}"
        )

        return trace.get_tracer(service_name or config.service_name)

    except Exception as e:
        logger.error(f"Failed to initialize OpenTelemetry: {e}", exc_info=True)
        _initialized = True
        return trace.get_tracer(service_name or config.service_name) if trace else None


def _init_tracing(resource: Any):
    """Initialize tracing with OTLP exporter"""
    global _tracer_provider

    if not OTEL_AVAILABLE:
        return

    try:
        # Create OTLP span exporter
        otlp_exporter = OTLPSpanExporter(
            endpoint=f"{config.exporter_otlp_endpoint}/v1/traces"
        )

        # Create tracer provider
        _tracer_provider = TracerProvider(resource=resource)

        # Add batch span processor
        span_processor = BatchSpanProcessor(otlp_exporter)
        _tracer_provider.add_span_processor(span_processor)

        # Set global tracer provider
        trace.set_tracer_provider(_tracer_provider)

        logger.debug("Tracing initialized with OTLP exporter")

    except Exception as e:
        logger.error(f"Failed to initialize tracing: {e}", exc_info=True)


def _init_metrics(resource: Any):
    """Initialize metrics with OTLP exporter"""
    global _meter_provider

    if not OTEL_AVAILABLE:
        return

    try:
        # Create OTLP metric exporter
        otlp_exporter = OTLPMetricExporter(
            endpoint=f"{config.exporter_otlp_endpoint}/v1/metrics"
        )

        # Create metric reader with periodic export
        metric_reader = PeriodicExportingMetricReader(
            exporter=otlp_exporter,
            export_interval_millis=config.metrics_export_interval
        )

        # Create meter provider
        _meter_provider = MeterProvider(
            resource=resource,
            metric_readers=[metric_reader]
        )

        # Set global meter provider
        metrics.set_meter_provider(_meter_provider)

        logger.debug("Metrics initialized with OTLP exporter")

    except Exception as e:
        logger.error(f"Failed to initialize metrics: {e}", exc_info=True)


def get_tracer(name: str) -> Any:
    """Get a tracer instance"""
    if not OTEL_AVAILABLE:
        return None
    return trace.get_tracer(name)


def get_meter(name: str) -> Any:
    """Get a meter instance"""
    if not OTEL_AVAILABLE:
        return None
    return metrics.get_meter(name)


def get_trace_context() -> dict:
    """
    Get current trace context for propagation

    Returns:
        dict with trace_id, span_id, and trace_flags (empty dict if unavailable)
    """
    if not OTEL_AVAILABLE:
        return {}

    try:
        span = trace.get_current_span()
        if not span or not span.get_span_context().is_valid:
            return {}

        span_context = span.get_span_context()

        return {
            'trace_id': format(span_context.trace_id, '032x'),
            'span_id': format(span_context.span_id, '016x'),
            'trace_flags': format(span_context.trace_flags, '02x')
        }
    except Exception as e:
        logger.error(f"Error getting trace context: {e}", exc_info=True)
        return {}


def shutdown():
    """Shutdown telemetry providers"""
    global _initialized, _tracer_provider, _meter_provider

    if not _initialized:
        return

    try:
        if _tracer_provider:
            _tracer_provider.shutdown()
            logger.debug("Tracer provider shutdown")

        if _meter_provider:
            _meter_provider.shutdown()
            logger.debug("Meter provider shutdown")

        _initialized = False
        logger.info("OpenTelemetry shutdown complete")

    except Exception as e:
        logger.error(f"Error during telemetry shutdown: {e}", exc_info=True)
