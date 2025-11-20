# Datadog LLM Observability Instrumentation Guide

This guide explains how Datadog LLM Observability is configured across the VibeCode platform.

## Supported Libraries

### Node.js/TypeScript
- ✅ **Vercel AI SDK** - Auto-instrumented via `src/instrument.ts`
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
# Set DD_API_KEY to your Datadog API key
export DD_API_KEY="your-key-here"
export DD_SITE=datadoghq.com  # or your Datadog site

# Enable LLM Observability
export DD_LLMOBS_ENABLED=1
export DD_LLMOBS_AGENTLESS_ENABLED=1  # Use agentless mode (direct to Datadog API)
export DD_LLMOBS_ML_APP=vibecode-ai  # Optional, defaults to 'vibecode-ai'
```

### Node.js Setup

The instrumentation is automatically initialized via:
- `src/instrumentation.ts` (Next.js instrumentation hook)
- `src/instrument.ts` (Tracer configuration)

No additional code changes needed in your application code.

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

## Verification

1. **Check Node.js instrumentation:**
   ```bash
   export DD_LLMOBS_ENABLED=1
   export DD_API_KEY="your-key-here"
   npm run dev
   # Look for: "✅ Datadog LLM Observability enabled for OpenAI spans"
   ```

2. **Check Python instrumentation:**
   ```bash
   export DD_LLMOBS_ENABLED=1
   export DD_API_KEY="your-key-here"
   python scripts/your_script.py
   # Look for: "✅ Datadog LLM Observability enabled"
   ```

3. **View traces in Datadog:**
   - Go to: https://app.datadoghq.com/llm/traces
   - Filter by: `ml_app:vibecode-ai`

## References

- [Datadog LLM Observability Documentation](https://docs.datadoghq.com/llm_observability/)
- [Auto Instrumentation Guide](https://docs.datadoghq.com/llm_observability/instrumentation/auto_instrumentation/)
- [Vercel AI SDK Integration](https://docs.datadoghq.com/integrations/vercel-ai-sdk/)

