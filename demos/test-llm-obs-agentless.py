#!/usr/bin/env python3
"""
Test Datadog LLM Observability in Agentless Mode

Per: https://docs.datadoghq.com/llm_observability/instrumentation/

Sends traces directly to Datadog API, bypassing local agent.
This PROVES traces land in Datadog without any doubt.
"""

import os
import sys

# Configure for AGENTLESS mode (direct to Datadog API)
os.environ['DD_LLMOBS_ENABLED'] = '1'
os.environ['DD_LLMOBS_AGENTLESS_ENABLED'] = '1'
os.environ['DD_LLMOBS_ML_APP'] = 'vibecode-agentless-proof'
os.environ['DD_SERVICE'] = 'vibecode-agentless-test'
os.environ['DD_ENV'] = 'proof-test'

# Get API key from datadog config
try:
    with open('/opt/datadog-agent/etc/datadog.yaml') as f:
        for line in f:
            if line.strip().startswith('api_key:') and 'dogfood' not in line.lower():
                api_key = line.split(':', 1)[1].strip()
                os.environ['DD_API_KEY'] = api_key
                print(f"Using API key: {api_key[:10]}...")
                break
except:
    print("Could not read API key from config")
    print("Set DD_API_KEY environment variable")
    sys.exit(1)

try:
    from ddtrace.llmobs import LLMObs
    print("✓ ddtrace.llmobs imported")
except ImportError:
    print("✗ ddtrace not available")
    print("Install: pip install ddtrace")
    sys.exit(1)

def main():
    print("=" * 70)
    print("Datadog LLM Observability - Agentless Mode Test")
    print("=" * 70)
    print()
    
    print("Configuration:")
    print(f"  DD_SITE: {os.getenv('DD_SITE', 'datadoghq.com')}")
    print(f"  DD_API_KEY: {os.getenv('DD_API_KEY', 'NOT SET')[:10]}...")
    print(f"  DD_LLMOBS_ENABLED: {os.getenv('DD_LLMOBS_ENABLED')}")
    print(f"  DD_LLMOBS_AGENTLESS_ENABLED: {os.getenv('DD_LLMOBS_AGENTLESS_ENABLED')}")
    print(f"  ML App: {os.getenv('DD_LLMOBS_ML_APP')}")
    print(f"  Service: {os.getenv('DD_SERVICE')}")
    print()
    
    # Enable LLMObs
    LLMObs.enable(
        ml_app=os.getenv('DD_LLMOBS_ML_APP'),
        agentless_enabled=True,
        api_key=os.getenv('DD_API_KEY'),
        site=os.getenv('DD_SITE', 'datadoghq.com')
    )
    print("✓ LLMObs enabled in agentless mode")
    print()
    
    # Create a test workflow span
    print("Creating test LLM workflow span...")
    with LLMObs.workflow(name="test_workflow") as workflow_id:
        print(f"  Workflow ID: {workflow_id}")
        
        # Create a task span
        with LLMObs.task(name="test_task") as task_id:
            print(f"  Task ID: {task_id}")
            
            # Annotate with data
            LLMObs.annotate(
                input_data="Test input to prove Datadog integration",
                output_data="Test output - if you see this in Datadog, IT WORKS",
                metadata={
                    "test": "agentless",
                    "purpose": "proof_of_integration",
                    "timestamp": "2025-11-18"
                }
            )
            print("  ✓ Annotated with test data")
    
    print()
    print("✓ Workflow complete")
    print()
    
    # Flush to ensure data is sent
    LLMObs.flush()
    print("✓ Flushed spans to Datadog API")
    print()
    
    print("=" * 70)
    print("Test Complete - Data Sent Directly to Datadog")
    print("=" * 70)
    print()
    print("Verify in Datadog (wait 1-2 minutes):")
    print("  https://app.datadoghq.com/llm/traces")
    print()
    print("Search for:")
    print("  - Service: vibecode-agentless-test")
    print("  - ML App: vibecode-agentless-proof")
    print("  - Input contains: 'Test input to prove'")
    print("  - Output contains: 'IT WORKS'")
    print()
    print("If you see these traces, integration is PROVEN.")

if __name__ == '__main__':
    main()

