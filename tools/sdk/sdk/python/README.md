# VibeCode Agents Python SDK

Production-ready Python client library for VibeCode's OpenAI Agents integration. Provides async/await support, streaming, tool registration, and CLI management.

[![PyPI version](https://badge.fury.io/py/vibecode-agents.svg)](https://badge.fury.io/py/vibecode-agents)
[![Python Support](https://img.shields.io/pypi/pyversions/vibecode-agents.svg)](https://pypi.org/project/vibecode-agents/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Code Coverage](https://img.shields.io/codecov/c/github/vibecode/vibecode-webgui)](https://codecov.io/gh/vibecode/vibecode-webgui)

## Features

- **Async/Await Support**: Built on `httpx` with full async support for high-performance applications
- **Streaming**: Real-time event streaming via Server-Sent Events and WebSocket
- **Tool Registration**: Decorator-based tool registration with automatic schema generation
- **Type Safety**: Complete type hints and Pydantic validation
- **Retry Logic**: Automatic retry with exponential backoff for transient failures
- **CLI Tool**: Rich command-line interface for agent management
- **Production Ready**: Comprehensive error handling, logging, and monitoring

## Installation

### Basic Installation

```bash
pip install vibecode-agents
```

### With CLI Support

```bash
pip install vibecode-agents[cli]
```

### Development Installation

```bash
git clone https://github.com/vibecode/vibecode-webgui
cd vibecode-webgui/sdk/python
pip install -e ".[dev,cli]"
```

## Quick Start

### Starting an Agent

```python
import asyncio
from vibecode_agents import AgentClient, StartAgentRequest, AgentType, ModelType

async def main():
    async with AgentClient(base_url="http://localhost:3000/api") as client:
        # Start agent
        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace="/home/coder/workspace",
            model=ModelType.CLAUDE_3_5_SONNET,
            task="Add type hints to all functions in src/api/",
            files=["src/api/routes.py", "src/api/auth.py"]
        )

        agent = await client.start_agent(request)
        print(f"Agent started: {agent.agent_id}")

        # Stream output
        async with client.stream_events(agent.agent_id) as stream:
            async for event in stream:
                if event.event.value == "output":
                    print(event.data.get("line"))

asyncio.run(main())
```

### Using Pre-built Agents

```python
from vibecode_agents import AgentClient
from vibecode_agents.agents import CodeReviewAgent

async def review_code():
    async with AgentClient() as client:
        agent = CodeReviewAgent(client)

        report = await agent.review_files(
            workspace="/home/coder/workspace",
            files=["src/api/auth.py", "src/models/user.py"],
            focus=["security", "performance"]
        )

        print(f"Found {len(report['findings'])} issues")

asyncio.run(review_code())
```

### Registering Custom Tools

```python
from vibecode_agents.tools import tool
from typing import List

@tool(
    name="search_code",
    description="Search codebase for patterns",
    tags=["search", "code"]
)
async def search_code(
    query: str,
    file_pattern: str = "*.py",
    max_results: int = 10
) -> List[str]:
    """
    Search for code patterns in files

    Args:
        query: Search pattern (regex supported)
        file_pattern: File glob pattern
        max_results: Maximum number of results

    Returns:
        List of matching file paths
    """
    # Implementation
    results = []
    return results
```

## CLI Usage

### Health Check

```bash
vibecode health
```

### Start Agent

```bash
vibecode start \
    --agent-type aider \
    --workspace /home/coder/workspace \
    --model claude-3-5-sonnet-20241022 \
    --task "Add comprehensive docstrings" \
    --files src/api/routes.py \
    --stream
```

### List Agents

```bash
vibecode list --status running
```

### Get Agent Status

```bash
vibecode status aider-12345678
```

### Stop Agent

```bash
vibecode stop aider-12345678 --force
```

### Stream Output

```bash
vibecode stream aider-12345678
```

## Pre-built Agents

### Code Review Agent

```python
from vibecode_agents.agents import CodeReviewAgent

agent = CodeReviewAgent(client)

# Review files
report = await agent.review_files(
    workspace="/home/coder/workspace",
    files=["src/api/auth.py"],
    focus=["security", "performance", "quality"]
)

# Review pull request
pr_report = await agent.review_pull_request(
    workspace="/home/coder/workspace",
    pr_diff=git_diff,
    target_branch="main"
)
```

### Documentation Agent

```python
from vibecode_agents.agents import DocumentationAgent

agent = DocumentationAgent(client)

# Generate documentation
docs = await agent.generate_docs(
    workspace="/home/coder/workspace",
    files=["src/api/routes.py"],
    doc_type="api",
    output_format="markdown"
)

# Update docstrings
await agent.update_docstrings(
    workspace="/home/coder/workspace",
    files=["src/**/*.py"],
    style="google"
)

# Generate README
readme = await agent.generate_readme(
    workspace="/home/coder/workspace",
    project_name="My Project"
)
```

### Testing Agent

```python
from vibecode_agents.agents import TestingAgent

agent = TestingAgent(client)

# Generate tests
tests = await agent.generate_tests(
    workspace="/home/coder/workspace",
    files=["src/api/auth.py"],
    test_type="unit",
    framework="pytest",
    coverage_target=95
)

# Improve coverage
await agent.improve_coverage(
    workspace="/home/coder/workspace",
    files=["src/api/auth.py"],
    current_coverage=75.0,
    target_coverage=95.0
)

# Fix failing tests
await agent.fix_failing_tests(
    workspace="/home/coder/workspace",
    test_files=["tests/test_auth.py"],
    error_output=test_output
)
```

## Streaming

### Server-Sent Events

```python
async with client.stream_events(agent_id) as stream:
    async for event in stream:
        if event.event == "output":
            print(event.data["line"])
        elif event.event == "status":
            print(f"Status: {event.data['status']}")
        elif event.event == "complete":
            print("Agent completed")
            break
```

### WebSocket

```python
async with client.stream_websocket(agent_id) as ws:
    # Send message
    await ws.send_message("Can you explain this function?")

    # Receive messages
    async for message in ws:
        if message["type"] == "output":
            print(message["content"])
        elif message["type"] == "complete":
            break
```

## Error Handling

```python
from vibecode_agents.exceptions import (
    AgentAPIError,
    AuthenticationError,
    NotFoundError,
    RateLimitError,
    ValidationError
)

try:
    agent = await client.start_agent(request)
except ValidationError as e:
    print(f"Invalid request: {e}")
except AuthenticationError as e:
    print(f"Authentication failed: {e}")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except NotFoundError as e:
    print(f"Agent not found: {e}")
except AgentAPIError as e:
    print(f"API error: {e}")
```

## Configuration

### Environment Variables

```bash
export VIBECODE_BASE_URL="http://localhost:3000/api"
export VIBECODE_API_KEY="your-api-key"
```

### Configuration File

```python
from vibecode_agents import AgentClient

client = AgentClient(
    base_url="http://localhost:3000/api",
    api_key="your-api-key",
    timeout=60.0,
    max_retries=3,
    headers={"X-Custom-Header": "value"}
)
```

## Testing

### Run Tests

```bash
pytest
```

### With Coverage

```bash
pytest --cov=vibecode_agents --cov-report=html
```

### Type Checking

```bash
mypy src/vibecode_agents
```

### Linting

```bash
ruff check src/
black --check src/
```

## Development

### Setup Development Environment

```bash
git clone https://github.com/vibecode/vibecode-webgui
cd vibecode-webgui/sdk/python
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -e ".[dev,cli,docs]"
pre-commit install
```

### Run Tests

```bash
pytest tests/
```

### Build Documentation

```bash
mkdocs serve
```

### Build Package

```bash
python -m build
```

## Architecture

```
vibecode_agents/
├── __init__.py          # Public API exports
├── client.py            # Async HTTP client
├── models.py            # Pydantic data models
├── exceptions.py        # Custom exceptions
├── streaming.py         # SSE and WebSocket streaming
├── cli.py               # CLI application
├── tools/
│   ├── decorators.py    # Tool registration decorators
│   └── registry.py      # Global tool registry
└── agents/
    ├── code_review.py   # Code review agent
    ├── documentation.py # Documentation agent
    └── testing.py       # Testing agent
```

## API Reference

Full API documentation available at: https://docs.vibecode.io/sdk/python

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

### Code Quality Standards

- Test coverage: ≥95%
- Type hints: All public APIs
- Documentation: All public functions
- Code style: Black + Ruff
- Security: Bandit + Safety checks

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Support

- Documentation: https://docs.vibecode.io
- Issues: https://github.com/vibecode/vibecode-webgui/issues
- Discord: https://discord.gg/vibecode

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
