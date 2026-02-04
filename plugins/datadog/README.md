# Datadog Integration for Gas Town

Monitors Gas Town agents, polecats, and workspace health with custom Datadog checks and APM tracing.

## Custom Check Installation

Install the Gas Town custom check to monitor agent status:

```bash
cd /Users/studio/gt/plugins/datadog/checks.d
sudo ./install.sh
```

This installs:
- `gastown.py` - Custom check that monitors Gas Town status
- `conf.yaml` - Configuration for metrics and log collection

Verify installation:
```bash
sudo datadog-agent check gastown
```

## Custom Check Metrics

- `gastown.available` - Service check (OK/WARNING/CRITICAL)
- `gastown.agents.active` - Number of active agents (mayor, deacon, witness, refinery)
- `gastown.agent.mayor` - Mayor status (1=active, 0=inactive)
- `gastown.agent.deacon` - Deacon status
- `gastown.agent.witness` - Witness status
- `gastown.agent.refinery` - Refinery status
- `gastown.polecats.total` - Total polecats configured
- `gastown.polecats.active` - Currently active polecats
- `gastown.work.ready` - Work items ready to be assigned

## APM Setup

1. Ensure Datadog agent is running on both machines
2. Configure environment variables (optional):
   - `DD_SERVICE`: Service name (default: gastown-agents)
   - `DD_ENV`: Environment (default: studio)
   - `DD_AGENT_HOST`: Datadog agent host (default: localhost)

## Usage

Wrap agent commands with the trace script:

```bash
./trace-agent.sh ollama-fast st-c8w ollama run qwen2.5:1.5b
```

## Metrics Emitted

- `gastown.agent.started` - Agent execution started
- `gastown.agent.completed` - Agent execution completed
- `gastown.agent.errors` - Agent execution failed

## Tags

All traces include:
- `agent_type`: The agent runtime (claude, ollama, codex, etc.)
- `bead_id`: The bead being worked on
- `team`: vibecode
- `env`: studio

## Dashboard

Create a Datadog dashboard with:
- Agent execution latency by type
- Error rate by agent
- Throughput by priority level
- Active agents over time
