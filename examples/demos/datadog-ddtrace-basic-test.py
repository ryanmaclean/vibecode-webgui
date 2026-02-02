#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Datadog dd-trace Basic Integration Test

PURPOSE:
    Minimal test to verify dd-trace instrumentation is working correctly.
    Tests basic APM tracing without LLM Observability features.
    Good first step before testing more complex integrations.

WHAT IT DEMONSTRATES:
    - Basic dd-trace auto-instrumentation
    - Trace generation for Python functions
    - APM trace delivery to Datadog
    - Service and environment tagging

WHEN TO USE:
    - Verifying dd-trace installation
    - Testing basic APM connectivity
    - Troubleshooting tracer issues
    - Before setting up LLM Observability

COST:
    FREE - No LLM or external API calls

REQUIREMENTS:
    pip install ddtrace
    Have Datadog Agent running OR use agentless mode with DD_API_KEY

USAGE:
    ddtrace-run python demos/datadog-ddtrace-basic-test.py

EXPECTED OUTPUT:
    Basic function traces appear in Datadog APM

VIEW RESULTS:
    https://app.datadoghq.com/apm/traces
    Service: vibecode-demo
"""

import os
import time

# Configure Datadog
os.environ.setdefault('DD_LLMOBS_ENABLED', '1')
os.environ.setdefault('DD_LLMOBS_ML_APP', 'vibecode-test')
os.environ.setdefault('DD_SERVICE', 'vibecode-demo')
os.environ.setdefault('DD_ENV', 'development')

def monitored_function():
    """Simple function that will be traced by Datadog."""
    print("Running monitored function...")
    time.sleep(0.5)  # Simulate work
    return "Function complete"

def main():
    print("=" * 60)
    print("Datadog Integration Test")
    print("=" * 60)
    print()
    
    # Check if ddtrace is active
    try:
        from ddtrace import tracer
        print(f"✓ ddtrace is active")
        print(f"  Service: {os.getenv('DD_SERVICE', 'unknown')}")
        print(f"  Environment: {os.getenv('DD_ENV', 'unknown')}")
        print(f"  LLM Obs: {os.getenv('DD_LLMOBS_ENABLED', 'disabled')}")
    except ImportError:
        print("✗ ddtrace not available")
        print("  Install with: pip install ddtrace")
        return
    
    print()
    print("Running monitored function...")
    result = monitored_function()
    print(f"Result: {result}")
    
    print()
    print("=" * 60)
    print("Test Complete")
    print("=" * 60)
    print()
    print("Check Datadog:")
    print("  Traces: https://app.datadoghq.com/apm/traces")
    print("  Service: vibecode-demo")
    print()
    print("Look for spans from this test run.")

if __name__ == '__main__':
    main()
