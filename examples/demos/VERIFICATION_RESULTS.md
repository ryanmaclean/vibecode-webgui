# Datadog Input/Output Capture Verification

## Test Execution

**Date**: November 18, 2025  
**Test Script**: `demos/test-input-output-capture.py`  
**ML App**: `vibecode-input-output-test`  
**Service**: `vibecode-test`

## Code Changes Made

### 1. Explicit LLMObs Workflow Wrapping
- Wrapped `crew.kickoff()` in `LLMObs.workflow()` context
- Explicitly annotated with `input_data` and `output_data`
- Called `LLMObs.flush()` to ensure delivery

### 2. LangChain Patching
- Added `patch_all()` to ensure OpenAI calls are traced
- Enables automatic LangChain instrumentation

### 3. LLMObs Initialization
- Explicitly called `LLMObs.enable()` before use
- Configured agentless mode with API key

## What Should Be Captured

### Workflow Level (Explicit Annotations)
```python
LLMObs.annotate(
    input_data={
        "prompt": "What is 2+2? Answer concisely.",
        "agent_role": "Test Agent",
        "task_description": "What is 2+2? Answer concisely."
    }
)

LLMObs.annotate(
    output_data={
        "response": "4",
        "full_result": "4"
    }
)
```

### Agent/Task Level (CrewAI Auto-Instrumentation)
- **INPUT**: Task description
- **OUTPUT**: Agent response (from `response.raw`)

### LLM Call Level (LangChain Auto-Instrumentation)
- **INPUT**: Actual prompt sent to OpenAI
- **OUTPUT**: Actual response from OpenAI
- **Model**: gpt-4o-mini
- **Tokens**: Token count
- **Cost**: Estimated cost

## Verification Steps

1. **Go to Datadog LLM Observability**:
   - URL: https://app.datadoghq.com/llm/traces

2. **Search for the trace**:
   - Filter: `ml_app:vibecode-input-output-test`
   - Service: `vibecode-test`
   - Time range: Last 10 minutes

3. **Check the workflow span**:
   - Click on the top-level workflow span
   - Verify **INPUT** field shows:
     ```json
     {
       "prompt": "What is 2+2? Answer concisely.",
       "agent_role": "Test Agent",
       "task_description": "What is 2+2? Answer concisely."
     }
     ```
   - Verify **OUTPUT** field shows:
     ```json
     {
       "response": "4",
       "full_result": "4"
     }
     ```

4. **Check agent/task spans**:
   - Expand child spans
   - Verify agent span has INPUT/OUTPUT
   - Verify task span has INPUT/OUTPUT

5. **Check LLM span**:
   - Find the OpenAI API call span
   - Verify it shows:
     - Actual prompt sent to OpenAI
     - Actual response received
     - Model name (gpt-4o-mini)
     - Token count
     - Cost estimate

## Expected Results

✅ **SUCCESS**: All three levels show content
- Workflow span: INPUT/OUTPUT visible
- Agent span: INPUT/OUTPUT visible  
- LLM span: INPUT/OUTPUT visible

❌ **FAILURE**: Any level shows "No content"
- Check that `LLMObs.enable()` was called
- Check that `LLMObs.workflow()` wraps execution
- Check that `LLMObs.annotate()` was called
- Check that `LLMObs.flush()` was called
- Verify agentless mode is enabled
- Verify API key is correct

## Test Execution Log

The test script executed successfully:
- CrewAI workflow completed
- Agent returned result: "4"
- LLMObs annotations applied
- Spans flushed to Datadog

## Next Steps

1. **Verify in Datadog UI** (wait 1-2 minutes for trace to appear)
2. **If INPUT/OUTPUT still shows "No content"**:
   - Check trace ID matches
   - Verify agentless mode configuration
   - Check Datadog agent logs for errors
   - Verify API key has correct permissions

3. **If successful**:
   - Run full demo: `python3 demos/working-crewai-demo.py`
   - Verify all 4 agents show input/output
   - Check that different models are traced correctly

## Files Modified

- `demos/working-crewai-demo.py`: Added explicit input/output capture
- `demos/test-input-output-capture.py`: Created simple test script
- `demos/INPUT_OUTPUT_CAPTURE.md`: Documentation of solution

## Status

✅ Code changes complete
✅ Test script executed
⏳ Awaiting Datadog UI verification

