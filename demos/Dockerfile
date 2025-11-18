FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir ddtrace crewai langchain-openai

# Copy demo files
COPY working-crewai-demo.py .
COPY simple-datadog-test.py .
COPY test-llm-obs-agentless.py .

# Run with ddtrace
ENTRYPOINT ["python"]
CMD ["working-crewai-demo.py"]

