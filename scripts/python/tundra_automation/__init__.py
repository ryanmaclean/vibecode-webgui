
# Datadog Unified Service Tagging
_dd_service = "tundra---init--"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "tundra", "cluster": "tundra-dome"})
    _dd_patch()
except ImportError:
    pass

# Datadog APM tracing - must be initialized before other imports
# Auto-detects local agent at localhost:8126 or DD_AGENT_HOST
import os

# Always use tundra-automation as service name for this package
_DD_SERVICE = "tundra-automation"
_DD_ENV = os.environ.get("DD_ENV", "development")

try:
    from ddtrace import config, patch_all, tracer

    # Configure service metadata - always use our service name
    config.service = _DD_SERVICE
    config.env = _DD_ENV

    # Configure HTTP integrations to use our service name
    for integration in ["requests", "httpx", "aiohttp", "urllib3"]:
        if hasattr(config, integration):
            getattr(config, integration).service = _DD_SERVICE

    # Auto-instrument common libraries (requests, subprocess, logging, etc.)
    patch_all()

    # Export tracer for manual instrumentation
    _tracer = tracer
except ImportError:
    _tracer = None  # ddtrace not installed

"""
Tundra Automation - Kubernetes Development Environment Setup

This package provides tools for setting up and managing local Kubernetes
development environments using KIND (Kubernetes IN Docker).

Also provides Datadog metrics validation for infrastructure monitoring.

Example:
    from tundra_automation import (
        PrerequisitesChecker,
        DatadogConfig,
        TundraBootstrap,
        MetricsValidator,
    )

    # Check prerequisites
    checker = PrerequisitesChecker()
    if not checker.all_required_available():
        print("Missing prerequisites:", checker.get_missing_required())

    # Load Datadog credentials
    config = DatadogConfig()
    config.load_credentials()

    # Deploy
    bootstrap = TundraBootstrap(cluster_name="my-cluster")
    result = bootstrap.deploy_datadog_agent(
        api_key=config.credentials.api_key,
        app_key=config.credentials.app_key,
    )

    # Validate metrics
    validator = MetricsValidator()
    validation = validator.wait_for_metrics("my-cluster")
"""

from .prerequisites import PrerequisitesChecker
from .datadog_config import (
    DatadogConfig,
    DatadogConfigError,
    DatadogCredentials,
    InvalidKeyFormatError,
    KeyNotFoundError,
)
from .bootstrap import (
    # New BootstrapOrchestrator (wraps shell script)
    BootstrapOrchestrator,
    BootstrapResult,
    BootstrapStage,
    StageProgress,
    # Legacy TundraBootstrap (direct Helm deployment)
    TundraBootstrap,
    DeploymentStatus,
    DeploymentResult,
)
from .metrics_validator import (
    MetricsValidator,
    ValidationResult,
    MetricCheckResult,
    DatadogAPIError,
)

__version__ = "0.3.0"
__all__ = [
    # Tracer for manual instrumentation
    "_tracer",
    # Prerequisites
    "PrerequisitesChecker",
    # Datadog config
    "DatadogConfig",
    "DatadogConfigError",
    "DatadogCredentials",
    "InvalidKeyFormatError",
    "KeyNotFoundError",
    # Bootstrap Orchestrator (wraps shell script)
    "BootstrapOrchestrator",
    "BootstrapResult",
    "BootstrapStage",
    "StageProgress",
    # Legacy Bootstrap (direct Helm deployment)
    "TundraBootstrap",
    "DeploymentStatus",
    "DeploymentResult",
    # Metrics validation
    "MetricsValidator",
    "ValidationResult",
    "MetricCheckResult",
    "DatadogAPIError",
]
