#!/usr/bin/env python3
"""
Datadog LLM Observability - Input/Output Capture Test

PURPOSE:
    Verifies that LLM prompts and responses are captured in Datadog traces.
    Tests explicit input/output annotation using LLMObs.annotate().
    Ensures content visibility in Datadog LLM Observability UI.

WHAT IT DEMONSTRATES:
    - Capturing LLM prompts as input_data
    - Capturing LLM responses as output_data
    - Using LLMObs.workflow() wrapper for content capture
    - Metadata annotation for additional context
    - CrewAI integration with content capture

WHEN TO USE:
    - Verifying prompt/response visibility in Datadog
    - Testing content capture configuration
    - Validating LLMObs.annotate() usage
    - Debugging missing content in traces

COST WARNING:
    Makes REAL OpenAI API calls (minimal: one simple math question)
    Cost: ~$0.01 per run

REQUIREMENTS:
    pip install crewai langchain-openai ddtrace
    export OPENAI_API_KEY=sk-...
    export DD_API_KEY=...

USAGE:
    python demos/datadog-llmobs-io-capture-test.py

EXPECTED OUTPUT:
    Trace with visible prompt ("What is 2+2?") and response in Datadog UI

VIEW RESULTS:
    https://app.datadoghq.com/llm/traces
    Search: ml_app:vibecode-input-output-test
    Check trace details for input_data and output_data fields
"""

import os
import sys

# Datadog configuration
os.environ['DD_LLMOBS_ENABLED'] = '1'
os.environ['DD_LLMOBS_AGENTLESS_ENABLED'] = '1'
os.environ['DD_LLMOBS_ML_APP'] = 'vibecode-input-output-test'
os.environ['DD_SERVICE'] = 'vibecode-test'
os.environ['DD_ENV'] = 'test'

# Get API key
try:
    with open('/opt/datadog-agent/etc/datadog.yaml') as f:
        for line in f:
            if line.strip().startswith('api_key:') and 'dogfood' not in line.lower():
                os.environ['DD_API_KEY'] = line.split(':', 1)[1].strip()
                break
except:
    print("Set DD_API_KEY environment variable")
    sys.exit(1)

os.environ['DD_SITE'] = 'datadoghq.com'

if not os.getenv('OPENAI_API_KEY'):
    print("Set OPENAI_API_KEY environment variable")
    sys.exit(1)

try:
    from crewai import Agent, Task, Crew
    from langchain_openai import ChatOpenAI
    from ddtrace import patch_all
    from ddtrace.llmobs import LLMObs
except ImportError as e:
    print(f"Missing dependency: {e}")
    sys.exit(1)

# Patch and enable
patch_all()
LLMObs.enable(
    ml_app=os.getenv('DD_LLMOBS_ML_APP'),
    agentless_enabled=True,
    api_key=os.getenv('DD_API_KEY'),
    site=os.getenv('DD_SITE', 'datadoghq.com')
)

# Simple agent
agent = Agent(
    role='Test Agent',
    goal='Answer questions clearly',
    backstory='You are a helpful assistant',
    llm=ChatOpenAI(model="gpt-4o-mini", temperature=0.3),
    verbose=True
)

task = Task(
    description="What is 2+2? Answer concisely.",
    agent=agent,
    expected_output="A number"
)

crew = Crew(
    agents=[agent],
    tasks=[task],
    verbose=True
)

print("=" * 70)
print("Testing Input/Output Capture")
print("=" * 70)
print()

# Wrap in LLMObs workflow with explicit input/output
with LLMObs.workflow(name="test_input_output_capture"):
    # Capture input
    prompt_text = task.description
    LLMObs.annotate(
        input_data={
            "prompt": prompt_text,
            "agent_role": agent.role,
            "task_description": task.description
        },
        metadata={"test": "input_output_capture"}
    )
    
    # Execute
    result = crew.kickoff()
    
    # Capture output
    result_str = str(result)
    if hasattr(result, 'raw'):
        result_str = str(result.raw)
    
    LLMObs.annotate(
        output_data={
            "response": result_str,
            "full_result": str(result)
        },
        metadata={"test": "input_output_capture", "completed": True}
    )

LLMObs.flush()

print()
print("=" * 70)
print("Test Complete")
print("=" * 70)
print()
print(f"Input captured: {prompt_text}")
print(f"Output captured: {result_str[:200]}...")
print()
print("Check Datadog: https://app.datadoghq.com/llm/traces")
print("Search: ml_app:vibecode-input-output-test")
print()
print("✓ Input and output should be visible in trace details")

