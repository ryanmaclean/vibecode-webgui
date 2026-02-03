
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Default environment values for bootstrap-focused pytest suites."""

DEFAULT_TEST_ENV = {
    "CLUSTER_NAME": "vibecode-test",
    "RESOURCE_GROUP": "vibecode-rg",
    "ACR_NAME": "vibecodeacr",
    "NAMESPACE": "vibecode",
    "LOCATION": "eastus2",
    "STORAGE_CLASS": "default",
    "DD_API_KEY": "test_datadog_api_key_here",
    "DD_SITE": "datadoghq.com",
}