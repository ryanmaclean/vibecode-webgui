# Datadog LLM Observability Instrumentation Guide

This guide explains how Datadog LLM Observability is configured across the VibeCode platform.

## Supported Libraries

### Node.js/TypeScript
- ✅ **Vercel AI SDK** - Auto-instrumented via `src/instrument.ts`
- ✅ **LangChain** - Auto-instrumented via `src/instrument.ts`
- ✅ **OpenAI** - Auto-instrumented via `src/instrument.ts`

### Python
- ✅ **LangChain** - Instrumented via `ddtrace.patch_all()`
- ✅ **OpenAI** - Instrumented via `ddtrace.patch_all()`
- ✅ **Anthropic** - Instrumented via `ddtrace.patch_all()`
- ✅ **Hugging Face Transformers** - Instrumented via `ddtrace.patch_all()`
- ✅ **Pydantic AI** - Instrumented via `ddtrace.patch_all()`

## Configuration

### Environment Variables

```bash
# Required for LLM Observability
# Set DD_API_KEY environment variable with your Datadog API key
DD_SITE=datadoghq.com  # or your Datadog site

# Enable LLM Observability
DD_LLMOBS_ENABLED=1
DD_LLMOBS_AGENTLESS_ENABLED=1  # Use agentless mode (direct to Datadog API)
DD_LLMOBS_ML_APP=vibecode-ai  # Optional, defaults to 'vibecode-ai'
```

### Node.js Setup

The instrumentation is automatically initialized via:
- `src/instrumentation.ts` (Next.js instrumentation hook)
- `src/instrument.ts` (Tracer configuration)

No additional code changes needed in your application code. The following plugins are automatically enabled:
- `openai` - For OpenAI SDK calls
- `langchain` - For LangChain operations

### Python Setup

For Python scripts, import the setup helper:

```python
from scripts.datadog_python_setup import setup_datadog_llmobs
setup_datadog_llmobs()
```

Or use ddtrace directly:

```python
from ddtrace import patch_all
from ddtrace.llmobs import LLMObs

patch_all()  # Patches all supported libraries
LLMObs.enable(
    ml_app='vibecode-ai',
    agentless_enabled=True,
    api_key=os.getenv('DD_API_KEY'),
    site=os.getenv('DD_SITE', 'datadoghq.com')
)
```

## Files with Instrumentation

### Node.js/TypeScript
- `src/instrument.ts` - Main tracer configuration with OpenAI and LangChain plugins
- `src/instrumentation.ts` - Next.js instrumentation hook
- `src/app/api/ai/chat/route.ts` - Vercel AI SDK usage (auto-instrumented)
- `src/lib/ai/search/vector-search.ts` - LangChain usage (auto-instrumented)
- `src/lib/ai/documentation/ingest.ts` - LangChain usage (auto-instrumented)

### Python
- `scripts/datadog_python_setup.py` - Centralized setup helper
- `scripts/install-opencode-cli.sh` - OpenAI and Anthropic usage
- `scripts/install-claude-code-cli.sh` - Anthropic usage
- `templates/python/huggingface-inference-app/app.py` - Hugging Face usage
- `examples/pydantic-ai-cli-agent/agent.py` - Pydantic AI usage
- `demos/crewai-4-agent-openai-workflow.py` - LangChain and CrewAI usage

## Verification

1. **Check Node.js instrumentation:**
   ```bash
   export DD_LLMOBS_ENABLED=1
   export DD_API_KEY=your_key
   npm run dev
   # Look for: "✅ Datadog LLM Observability enabled for OpenAI and LangChain"
   ```

2. **Check Python instrumentation:**
   ```bash
   export DD_LLMOBS_ENABLED=1
   export DD_API_KEY=your_key
   python scripts/datadog_python_setup.py
   # Look for: "✅ Datadog LLM Observability enabled"
   ```

3. **View traces in Datadog:**
   - Go to: https://app.datadoghq.com/llm/traces
   - Filter by: `ml_app:vibecode-ai`

## Troubleshooting

### No traces appearing in Datadog

1. Check environment variables are set:
   ```bash
   echo $DD_API_KEY
   echo $DD_LLMOBS_ENABLED
   ```

2. Check logs for initialization messages:
   - Node.js: Look for "✅ Datadog LLM Observability enabled"
   - Python: Look for "✅ Datadog LLM Observability enabled"

3. Verify ddtrace is installed:
   - Node.js: `npm list dd-trace`
   - Python: `pip list | grep ddtrace`

### Python scripts not instrumented

1. Ensure `ddtrace` is installed:
   ```bash
   pip install ddtrace
   ```

2. Import the setup helper at the top of your script:
   ```python
   from scripts.datadog_python_setup import setup_datadog_llmobs
   setup_datadog_llmobs()
   ```

### Node.js plugins not working

1. Check `src/instrument.ts` has the plugin configuration
2. Verify `DD_LLMOBS_ENABLED=1` is set
3. Check console logs for plugin initialization errors

## References

- [Datadog LLM Observability Documentation](https://docs.datadoghq.com/llm_observability/)
- [Auto Instrumentation Guide](https://docs.datadoghq.com/llm_observability/instrumentation/auto_instrumentation/)
- [Vercel AI SDK Integration](https://docs.datadoghq.com/integrations/vercel-ai-sdk/)
- [LangChain Integration](https://docs.datadoghq.com/integrations/langchain/)
