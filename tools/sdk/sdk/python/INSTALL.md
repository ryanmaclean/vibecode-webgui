# Installation Guide

## Requirements

- Python 3.9 or higher
- pip 21.0 or higher

## Quick Installation

### From PyPI (When Published)

```bash
# Basic installation
pip install vibecode-agents

# With CLI support
pip install vibecode-agents[cli]

# With all extras
pip install vibecode-agents[cli,docs]
```

### From Source

```bash
# Clone repository
git clone https://github.com/vibecode/vibecode-webgui
cd vibecode-webgui/sdk/python

# Install in development mode
pip install -e ".[dev,cli]"
```

## Development Setup

### 1. Create Virtual Environment

```bash
# Create venv
python -m venv venv

# Activate (Linux/macOS)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate
```

### 2. Install Dependencies

```bash
# Install package with dev dependencies
pip install -e ".[dev,cli,docs]"

# Install pre-commit hooks
pre-commit install
```

### 3. Verify Installation

```bash
# Run tests
pytest

# Check types
mypy src/vibecode_agents

# Check linting
ruff check src/
black --check src/

# Verify CLI
vibecode health
```

## Configuration

### Environment Variables

```bash
# API configuration
export VIBECODE_BASE_URL="http://localhost:3000/api"
export VIBECODE_API_KEY="your-api-key"

# Optional settings
export VIBECODE_TIMEOUT="60"
export VIBECODE_MAX_RETRIES="3"
```

### Configuration File

Create `.vibecoderc` in your home directory:

```json
{
  "base_url": "http://localhost:3000/api",
  "api_key": "your-api-key",
  "timeout": 60,
  "max_retries": 3
}
```

## Troubleshooting

### Import Error

If you see `ModuleNotFoundError: No module named 'vibecode_agents'`:

```bash
# Reinstall in development mode
pip install -e .
```

### CLI Not Found

If `vibecode` command is not found:

```bash
# Ensure scripts are in PATH
pip install --force-reinstall vibecode-agents[cli]

# Or use python -m
python -m vibecode_agents.cli health
```

### WebSocket Support

WebSocket streaming requires additional package:

```bash
pip install websockets
```

### SSL Certificate Errors

If you encounter SSL errors:

```python
import ssl
import httpx

# Create client with custom SSL context
client = AgentClient(
    verify=False  # Only for development!
)
```

## Platform-Specific Notes

### Linux

```bash
# Install system dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install python3-dev python3-pip

# Install package
pip install vibecode-agents[cli]
```

### macOS

```bash
# Install via Homebrew (when available)
brew install vibecode

# Or via pip
pip3 install vibecode-agents[cli]
```

### Windows

```powershell
# Install via pip
pip install vibecode-agents[cli]

# If you see encoding errors, set UTF-8
$env:PYTHONIOENCODING="utf-8"
```

## Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install SDK
RUN pip install vibecode-agents[cli]

# Copy your code
COPY . .

CMD ["python", "your_script.py"]
```

## Upgrading

```bash
# Upgrade to latest version
pip install --upgrade vibecode-agents

# Upgrade with extras
pip install --upgrade vibecode-agents[cli]
```

## Uninstallation

```bash
pip uninstall vibecode-agents
```

## Verification

After installation, verify everything works:

```python
# test_install.py
import asyncio
from vibecode_agents import AgentClient

async def test():
    async with AgentClient() as client:
        health = await client.get_health()
        print(f"API Status: {health.status.value}")

asyncio.run(test())
```

```bash
python test_install.py
```

## Getting Help

- Documentation: https://docs.vibecode.io/sdk/python
- Issues: https://github.com/vibecode/vibecode-webgui/issues
- Discord: https://discord.gg/vibecode
