
# Datadog Unified Service Tagging
_dd_service = "telemetry"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass

import os
import logging
from ddtrace import tracer, patch_all
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("vibecode")

def init_telemetry(service_name):
    """
    Initialize Datadog Tracing and OpenTelemetry.
    """
    # 1. Datadog Official Patching
    patch_all(logging=True, requests=True)
    
    # 2. Configure Datadog Tracer
    # hostname/port are picked up from env vars automatically
    tracer.configure()
    
    # 3. Set Service Tags
    tracer.set_tags({
        "service": service_name,
        "env": os.getenv("DD_ENV", "development"),
        "version": os.getenv("DD_VERSION", "5.0.0")
    })
    
    # 4. OpenTelemetry Setup (Bridged if needed, or standalone)
    # For scripts, direct DDTrace usage is often simpler/more robust for "Official" support
    # but we will init the provider just in case OTel API is used.
    provider = TracerProvider()
    # In a real setup, we'd add an OTLP exporter here pointing to the DD Agent
    # provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    
    logger.info(f"Telemetry initialized for {service_name}")
    return tracer

def get_logger(name):
    return logging.getLogger(name)
