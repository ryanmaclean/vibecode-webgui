# Pydantic AI CLI Coding Agent

A CLI coding assistant powered by Pydantic AI, similar to Goose but with VibeCode integration.

## Features

- 🤖 AI-powered code generation and editing
- 📁 File system access (read, write, search)
- 🔍 Semantic code search via VibeCode MCP
- 🧪 Run tests and analyze results
- 🚀 Deploy projects
- 💬 Interactive chat interface
- 🔄 Durable execution (survives crashes)
- 🎯 Type-safe with Pydantic validation

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your API keys
```

## Usage

### Basic Chat

```bash
python agent.py
```

### With Specific Task

```bash
python agent.py --task "Create a FastAPI endpoint for user authentication"
```

### With Context

```bash
python agent.py --context ./src --task "Refactor the authentication module"
```

## Configuration

Edit `.env`:

```bash
# AI Provider (openai, anthropic, gemini, etc.)
AI_PROVIDER=openai
AI_MODEL=gpt-4-turbo-preview
OPENAI_API_KEY=sk-...

# VibeCode MCP Server (optional)
MCP_SERVER_URL=http://localhost:3000/mcp

# Working Directory
WORKSPACE_DIR=./workspace
```

## Examples

### Generate Code

```
> Create a Python function to calculate fibonacci numbers

Agent: I'll create a fibonacci function with memoization...
[Writes to fibonacci.py]
Done! Created fibonacci.py
```

### Refactor Code

```
> Refactor user_service.py to use async/await

Agent: Analyzing user_service.py...
[Reads file, analyzes, rewrites]
Done! Refactored to async patterns
```

### Run Tests

```
> Run the tests for the auth module

Agent: Running pytest tests/test_auth.py...
[Executes tests, analyzes results]
All tests passed! ✅
```

### Deploy

```
> Deploy this project to production

Agent: Connecting to VibeCode MCP...
[Uses deployment tool]
Deployed to https://app.vibecode.dev ✅
```

## Architecture

```
agent.py              # Main CLI interface
├── agent/
│   ├── __init__.py
│   ├── coding_agent.py    # Main agent logic
│   ├── tools.py           # File system tools
│   ├── mcp_tools.py       # VibeCode MCP integration
│   └── prompts.py         # System prompts
├── requirements.txt
└── .env.example
```

## Tools Available

### File System Tools
- `read_file(path)` - Read file contents
- `write_file(path, content)` - Write/update file
- `list_files(directory)` - List directory contents
- `search_files(pattern)` - Search for files
- `delete_file(path)` - Delete file

### Code Tools
- `analyze_code(path)` - Static analysis
- `run_tests(pattern)` - Execute tests
- `format_code(path)` - Auto-format
- `lint_code(path)` - Lint check

### VibeCode MCP Tools (Optional)
- `create_workspace(name, template)` - Create dev environment
- `deploy_project(workspace_id)` - Deploy to production
- `search_code(query)` - Semantic code search
- `run_workspace_tests(workspace_id)` - Run tests in workspace

## Advanced Features

### Durable Execution

The agent automatically saves progress and can resume after crashes:

```python
# Agent saves state after each action
# On restart, it resumes from last checkpoint
python agent.py --resume
```

### Human-in-the-Loop

Require approval for destructive operations:

```python
# Agent will ask before:
# - Deleting files
# - Deploying to production
# - Making large changes
```

### Streaming Output

See the agent's thought process in real-time:

```python
# Agent streams:
# - Reasoning steps
# - Code generation
# - Tool execution results
```

## Development

### Run Tests

```bash
pytest tests/
```

### Type Check

```bash
mypy agent/
```

### Lint

```bash
ruff check agent/
```

## License

MIT
