# Datadog + CrewAI Integration - VERIFIED WORKING

## Proof of Functionality

**Test 1**: Simple LLMObs test
- Trace ID: `691ccc46000000003f283b08a829a376`
- Time: 11:43:02 AM
- Result: ✓ Workflow + task captured

**Test 2**: CrewAI with real agent
- Trace ID: `691cd51300000000cb229246d4aa6857`
- Time: 12:20:35 PM  
- ML App: `vibecode-crewai-test2`
- Service: `vibecode-crew`
- Captured:
  - Workflow: minimal_crew_test
  - CrewAI Crew execution
  - CrewAI Task
  - Test Agent
  - OpenAI API call (gpt-4.1-mini)
  - Duration: 1.51s
  - Cost: $0.0088
  - Tokens: 174

## Working Configuration

```python
from ddtrace.llmobs import LLMObs

LLMObs.enable(
    ml_app="your-app-name",
    agentless_enabled=True,
    api_key="your-dd-api-key",
    site="datadoghq.com"
)

# Use LLMObs.workflow() context
with LLMObs.workflow(name="my_workflow"):
    # CrewAI automatically traced
    crew = Crew(agents=[...], tasks=[...])
    result = crew.kickoff()

LLMObs.flush()
```

## What Gets Traced

Per https://docs.datadoghq.com/integrations/crewai/:
- crew.kickoff()
- task.execute_sync()
- agent.execute_task()
- tool.invoke()
- OpenAI API calls

All visible in Datadog LLM Observability.

## Verified

Integration tested and confirmed: November 18, 2025
Both tests successful, traces visible in Datadog UI.
