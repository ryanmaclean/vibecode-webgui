# Datadog Setup for CrewAI Demo

## Quick Start

```bash
# Install ddtrace
python3 -m pip install --user ddtrace crewai

# Run the test
python3 -m ddtrace.commands.ddtrace_run demos/datadog-ddtrace-basic-test.py

# Or if ddtrace-run is in PATH:
ddtrace-run demos/datadog-ddtrace-basic-test.py
```

## Verify Installation

```bash
python3 -c "import ddtrace; print(f'ddtrace version: {ddtrace.__version__}')"
```

## Configuration Options

### Option 1: With Local Datadog Agent (Recommended)

Agent must be running with APM enabled:

```bash
datadog-agent status | grep "APM Agent"
# Should show: Status: Running
```

Then:
```bash
export DD_LLMOBS_ENABLED=1
export DD_SERVICE="vibecode-test"
export DD_ENV="development"

ddtrace-run python demos/datadog-ddtrace-basic-test.py
```

Traces go to: `localhost:8126` (Datadog Agent)

### Option 2: Agentless (Direct to Datadog)

```bash
export DD_SITE="datadoghq.com"
export DD_API_KEY="your-api-key"
export DD_LLMOBS_ENABLED=1
export DD_LLMOBS_AGENTLESS_ENABLED=1
export DD_SERVICE="vibecode-test"

ddtrace-run python demos/datadog-ddtrace-basic-test.py
```

Traces go directly to Datadog API.

## Viewing Results

### APM Traces

https://app.datadoghq.com/apm/traces?query=service:vibecode-test

### LLM Observability (CrewAI)

https://app.datadoghq.com/llm/traces

Look for:
- Service: vibecode-test or vibecode-crewai-demo
- Recent traces (last 15 minutes)
- Spans from your test run

## Troubleshooting

### ddtrace not found

```bash
# Add to PATH
export PATH="$HOME/.local/bin:$PATH"

# Or use python -m
python3 -m ddtrace.commands.ddtrace_run --help
```

### No traces in Datadog

Check:
1. Agent running: `datadog-agent status`
2. APM enabled: Should show port 8126
3. API key set: `echo $DD_API_KEY`
4. Firewall: Allow localhost:8126

### Python package issues

```bash
# Use virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate
pip install -r demos/requirements.txt

# Then run
ddtrace-run python demos/datadog-ddtrace-basic-test.py
```

## What Gets Tracked

According to [Datadog's CrewAI docs](https://docs.datadoghq.com/integrations/crewai/):

**Automatically traced**:
- `crew.kickoff()` - Full workflow
- `task.execute_sync()` - Individual tasks
- `agent.execute_task()` - Agent executions
- `tool.invoke()` - Tool usage

**Captured data**:
- Latency for each operation
- Input/output messages
- Errors and exceptions
- Directional data flow

## Demo Comparison

### datadog-ddtrace-basic-test.py
- Basic ddtrace verification
- No CrewAI dependencies
- Quick validation

### crewai-vm-management-demo.py
- Full multi-agent workflow
- Mimics real VM management
- Shows agent coordination
- LLM Observability features

Start with simple test, then run CrewAI demo.

