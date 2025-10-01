# Windsurf Roundtable AI MCP Setup

## Issue Fixed
The roundtable-ai MCP server requires Python 3.11+ due to the `tomllib` module dependency. The original configuration was failing because uvx was defaulting to Python 3.10.

## Solution

### 1. Update Windsurf MCP Configuration

Replace the contents of `~/.codeium/windsurf/mcp_config.json` with:

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-puppeteer"
      ],
      "env": {}
    },
    "sequential-thinking": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ],
      "env": {}
    },
    "roundtable-ai": {
      "command": "uvx",
      "args": [
        "--python",
        "python3.11",
        "roundtable-ai@latest"
      ],
      "env": {
        "CLI_MCP_SUBAGENTS": "codex,cursor,gemini"
      }
    }
  }
}
```

### 2. Key Changes

- **Added `--python python3.11` flag**: Forces uvx to use Python 3.11+ which includes the required `tomllib` module
- **Updated CLI_MCP_SUBAGENTS**: Removed `claude` since it's not installed on your system
- **Available agents**: `codex`, `cursor`, `gemini` (all verified as working)

### 3. Verify Installation

```bash
# Check roundtable-ai works
uvx --python python3.11 roundtable-ai@latest --check

# Verify CLI tools
which codex cursor gemini
```

### 4. CLI Availability Report

Current status of AI CLI tools:
- ✅ **Codex**: Available at `/opt/homebrew/bin/codex`
- ❌ **Claude**: Not installed (removed from config)
- ✅ **Cursor**: Available at `/usr/local/bin/cursor`
- ✅ **Gemini**: Available at `/opt/homebrew/bin/gemini`

### 5. Optional: Install Claude Code CLI

If you want to add Claude Code support:

```bash
# Install Claude Code CLI (if available)
# Then update CLI_MCP_SUBAGENTS to: "codex,claude,cursor,gemini"
```

### 6. Restart Windsurf

After updating the config:
1. Quit Windsurf completely
2. Restart Windsurf
3. The roundtable-ai MCP server should now be available

## What is Roundtable AI?

Roundtable AI is an MCP server that unifies multiple AI coding assistants through intelligent auto-discovery and a standardized interface. It allows you to:

- **Parallel execution**: Run tasks across multiple AI agents simultaneously
- **Consensus building**: Get multiple perspectives on complex problems
- **Specialized agents**: Route tasks to the best-suited AI for each job
- **Zero configuration**: Auto-discovers available CLI tools

## Usage in Windsurf

Once configured, you can use roundtable-ai through Windsurf's MCP interface:

```
Ask roundtable to analyze this code with all available agents
```

The server will automatically:
1. Detect which CLI tools are available (codex, cursor, gemini)
2. Dispatch your request to all agents in parallel
3. Aggregate and present the results

## Troubleshooting

### Error: "ModuleNotFoundError: No module named 'tomllib'"
- **Cause**: Python version < 3.11
- **Fix**: Add `--python python3.11` to uvx args (already in fixed config)

### Error: "command not found"
- **Cause**: CLI tool not installed or not in PATH
- **Fix**: Remove the tool from `CLI_MCP_SUBAGENTS` or install it

### Server not appearing in Windsurf
- **Fix**: Completely quit and restart Windsurf
- **Check**: Verify config file syntax with `cat ~/.codeium/windsurf/mcp_config.json | jq`

## References

- [Roundtable AI GitHub](https://github.com/askbudi/roundtable)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [uvx Documentation](https://docs.astral.sh/uv/)
