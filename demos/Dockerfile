FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir ddtrace crewai langchain-openai

# Copy demo files
COPY crewai-4-agent-openai-workflow.py .
COPY datadog-ddtrace-basic-test.py .
COPY datadog-llmobs-agentless-proof.py .

# Run with ddtrace
ENTRYPOINT ["python"]
CMD ["crewai-4-agent-openai-workflow.py"]

