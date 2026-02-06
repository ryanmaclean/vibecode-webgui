
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

# Datadog Unified Service Tagging
_dd_service = "datadog-python-setup"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


"""
Datadog LLM Observability setup for Python scripts.
Import this at the top of Python files that use LLM libraries.

Usage:
    from scripts.datadog_python_setup import setup_datadog_llmobs
    setup_datadog_llmobs()
    
Or set environment variables and import will auto-setup:
    export DD_LLMOBS_ENABLED=1
    export DD_API_KEY=your_key
    python your_script.py
"""
import os
import sys

def setup_datadog_llmobs():
    """Setup Datadog LLM Observability for Python scripts"""
    # Check if LLM Observability is enabled
    if os.getenv('DD_LLMOBS_ENABLED', '0') not in ('1', 'true', 'True'):
        return False
    
    try:
        from ddtrace import patch_all
        from ddtrace.llmobs import LLMObs
    except ImportError:
        print('⚠️ ddtrace not installed, skipping Datadog LLM Observability')
        print('   Install with: pip install ddtrace')
        return False
    
    # Get configuration
    ml_app = os.getenv('DD_LLMOBS_ML_APP', 'vibecode-ai')
    api_key = os.getenv('DD_API_KEY')
    site = os.getenv('DD_SITE', 'datadoghq.com')
    agentless = os.getenv('DD_LLMOBS_AGENTLESS_ENABLED', '0') in ('1', 'true', 'True')
    
    if not api_key:
        print('⚠️ DD_API_KEY not set, skipping Datadog LLM Observability')
        return False
    
    # Patch all supported libraries
    # This patches: OpenAI, Anthropic, LangChain, Hugging Face, Mistral, Cohere, Vertex AI
    patch_all()
    
    # Enable LLMObs
    LLMObs.enable(
        ml_app=ml_app,
        agentless_enabled=agentless,
        api_key=api_key,
        site=site
    )
    
    print(f'✅ Datadog LLM Observability enabled (ml_app={ml_app}, agentless={agentless})')
    return True

# Auto-setup if environment variables are set and module is imported
if __name__ != '__main__':
    # Only auto-setup if explicitly enabled via env var
    if os.getenv('DD_LLMOBS_ENABLED') in ('1', 'true', 'True'):
        setup_datadog_llmobs()

if __name__ == '__main__':
    # Allow manual testing
    setup_datadog_llmobs()
