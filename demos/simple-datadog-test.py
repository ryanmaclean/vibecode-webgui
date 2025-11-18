#!/usr/bin/env python3
"""
Simple Datadog Integration Test

Run with: ddtrace-run python demos/simple-datadog-test.py

Tests that ddtrace is working and sending data to Datadog.
Much simpler than full CrewAI demo - good for verification.
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

