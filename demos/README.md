# CrewAI Demo with Datadog Monitoring

Demonstrates multi-agent orchestration for VM management tasks, monitored by Datadog.

## What This Does

Uses CrewAI to coordinate 4 agents working on VibeCode improvements:

1. **Research Agent** - Studies Tart/UTM source code
2. **Bootloader Agent** - Fixes EFI configuration
3. **Service Agent** - Installs PostgreSQL/Valkey/Node.js/VSCode
4. **QA Agent** - Validates everything works

All agent activity is automatically traced and sent to Datadog LLM Observability.

## Setup

### Install Dependencies

```bash
pip3 install crewai ddtrace
```

### Configure Datadog

Set environment variables:

```bash
export DD_SITE="datadoghq.com"  # Your Datadog site
export DD_API_KEY="your-api-key"
export DD_LLMOBS_ENABLED=1
export DD_LLMOBS_ML_APP="vibecode-crewai-demo"
```

Or if you have Datadog Agent running locally:

```bash
# Agent must have APM and StatsD enabled
export DD_LLMOBS_ENABLED=1
export DD_LLMOBS_ML_APP="vibecode-crewai-demo"
```

## Running the Demo

### With Datadog Agent (Recommended)

```bash
# Start Datadog Agent if not running
# Agent should be on localhost:8126 for APM

# Run the crew
ddtrace-run python demos/crewai-vm-agents.py
```

### Agentless Mode

```bash
DD_SITE=datadoghq.com \
DD_API_KEY=your-key \
DD_LLMOBS_ENABLED=1 \
DD_LLMOBS_AGENTLESS_ENABLED=1 \
DD_LLMOBS_ML_APP=vibecode-crewai-demo \
ddtrace-run python demos/crewai-vm-agents.py
```

## What You'll See

### In Datadog

Navigate to: https://app.datadoghq.com/llm/traces

You'll see:
- Each crew kickoff as a trace
- Agent execution spans
- Task execution timing
- Tool invocations
- Input/output messages
- Errors and latency

### In Console

The crew will execute sequentially:
1. Research agent studies Tart/UTM code
2. Bootloader agent creates EFI solution
3. Service agent installs applications
4. QA agent validates everything

## Monitored Operations

According to [Datadog's CrewAI integration](https://docs.datadoghq.com/integrations/crewai/), the following are automatically traced:

**Crew Operations**:
- `crew.kickoff()`
- `crew.kickoff_async()`
- `crew.kickoff_for_each()`

**Task Operations**:
- `task.execute_sync()`
- `task.execute_async()`

**Agent Operations**:
- `agent.execute_task()`

**Tool Operations**:
- `tool.invoke()`

All captured with:
- Latency measurements
- Input/output messages
- Error tracking
- Directional data flow

## Validation

Check if Datadog integration is working:

```bash
ddtrace-run --info
```

Look for: `Agent error: None`

## Debugging

Enable debug logging:

```bash
ddtrace-run --debug python demos/crewai-vm-agents.py
```

## What This Demonstrates

**For VibeCode**:
- Multi-agent coordination (like our 4-agent sessions)
- Automated workflow orchestration
- Monitoring agent performance
- Tracking task dependencies

**For Datadog**:
- LLM Observability for agent workflows
- Tracing crew execution
- Monitoring AI/agent systems
- Performance insights

## Extending the Demo

Add your own agents:

```python
documentation_agent = Agent(
    role='Documentation Writer',
    goal='Create clear, authentic documentation',
    backstory='Expert technical writer who values honesty over hype',
    verbose=True
)

doc_task = Task(
    description='Review and improve documentation tone',
    agent=documentation_agent
)
```

## Cost Note

CrewAI can use LLM APIs (OpenAI, etc.) which cost money. For this demo:
- Agents use simple logic (no LLM calls)
- Just demonstrates the orchestration pattern
- To use actual LLMs, configure API keys

## References

- [Datadog CrewAI Integration](https://docs.datadoghq.com/integrations/crewai/)
- [CrewAI Documentation](https://docs.crewai.com/)
- [Datadog LLM Observability](https://docs.datadoghq.com/llm_observability/)

## License

MIT - Same as VibeCode. CrewAI is also MIT licensed.
