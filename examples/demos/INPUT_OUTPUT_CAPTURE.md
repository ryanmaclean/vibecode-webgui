# Capturing Prompts and Responses in Datadog

## Problem

When viewing CrewAI traces in Datadog LLM Observability, the INPUT and OUTPUT fields showed "No content" even though traces were being created.

## Root Cause

CrewAI's auto-instrumentation captures:
- Task descriptions (as input)
- Agent metadata
- Workflow structure

But the actual LLM prompts sent to OpenAI and the responses received may not be visible in the INPUT/OUTPUT fields because:
1. CrewAI wraps LangChain calls, and the response format (`response.raw`) may not contain the text
2. LangChain OpenAI calls are traced separately but may not be linked to show content in the workflow view

## Solution

### 1. Explicit LLMObs Workflow Wrapping

Wrap your `crew.kickoff()` call in an `LLMObs.workflow()` context and explicitly annotate:

```python
from ddtrace.llmobs import LLMObs

# Enable LLMObs first
LLMObs.enable(
    ml_app="your-app-name",
    agentless_enabled=True,
    api_key=os.getenv('DD_API_KEY'),
    site="datadoghq.com"
)

# Wrap execution
with LLMObs.workflow(name="your_workflow"):
    # Capture input
    LLMObs.annotate(
        input_data={
            "prompt": task.description,
            "agent": agent.role,
            "full_context": task.description
        }
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
        }
    )

LLMObs.flush()
```

### 2. Patch LangChain

Ensure LangChain is patched so OpenAI calls are traced:

```python
from ddtrace import patch_all

patch_all()  # Automatically patches LangChain, OpenAI, etc.
```

### 3. What Gets Captured

**Workflow Level** (via explicit LLMObs.workflow):
- Input: Task descriptions, agent roles, full context
- Output: Final crew result

**Agent/Task Level** (via CrewAI auto-instrumentation):
- Input: Task description
- Output: Agent response (from `response.raw`)

**LLM Call Level** (via LangChain auto-instrumentation):
- Input: Actual prompt sent to OpenAI
- Output: Actual response from OpenAI
- Model: gpt-4, gpt-3.5-turbo, etc.
- Tokens, cost, latency

## Verification

After running your workflow:

1. Go to https://app.datadoghq.com/llm/traces
2. Find your trace (search by `ml_app:your-app-name`)
3. Click on the workflow span
4. Check INPUT/OUTPUT fields - they should now show:
   - **INPUT**: Task descriptions and context
   - **OUTPUT**: Agent responses and final results
5. Expand child spans to see:
   - Agent execution spans
   - OpenAI API call spans with actual prompts/responses

## Example

See `demos/crewai-4-agent-openai-workflow.py` for a complete example with:
- 4 agents using different OpenAI models
- Explicit input/output capture
- Full workflow tracing

## Notes

- The explicit `LLMObs.workflow()` wrapper ensures content is visible at the workflow level
- LangChain's auto-instrumentation captures the actual LLM calls separately
- Both are needed for complete observability:
  - Workflow-level: See the high-level task flow
  - LLM-level: See the actual prompts/responses sent to OpenAI

