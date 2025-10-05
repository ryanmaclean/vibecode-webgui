# Roundtable AI MCP Server Setup

## Current Status
❌ **Not Connected** - roundtable-ai MCP server is configured but not accessible

## Configuration
Location: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
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

## Troubleshooting Steps

### 1. Check if uvx is installed
```bash
which uvx
# If not found, install uv:
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. Check Python 3.11
```bash
python3.11 --version
# If not found, install via brew:
brew install python@3.11
```

### 3. Test roundtable-ai manually
```bash
uvx --python python3.11 roundtable-ai@latest --help
```

### 4. Restart Windsurf/Cascade
After fixing dependencies, restart the IDE to reconnect MCP servers.

## Expected Functionality

Once connected, roundtable-ai provides:
- Multi-agent collaboration via subagents (codex, cursor, gemini)
- Parallel task execution
- Agent coordination and consensus building

## Workaround (Current)

Since roundtable-ai isn't available, we're using:
1. **GitHub Issues** for task distribution
2. **TODO.md** for coordination
3. **Sequential Thinking** for planning
4. **Manual agent simulation** with clear handoffs

This achieves similar results but requires more manual coordination.

## Integration Plan

Once roundtable-ai is working:

### Example Usage
```typescript
// Coordinate multi-agent build
await roundtable({
  agents: ['codex', 'cursor', 'gemini'],
  task: 'Build and verify code-server profiles',
  subtasks: [
    { agent: 'codex', task: 'Build ai/web/full profiles' },
    { agent: 'cursor', task: 'Create verification scripts' },
    { agent: 'gemini', task: 'Update documentation' }
  ]
});
```

### Benefits Over Current Approach
- ✅ True parallel execution
- ✅ Automatic consensus building
- ✅ Better error handling across agents
- ✅ Integrated progress tracking

## Next Steps

1. [ ] Install uv/uvx if missing
2. [ ] Verify Python 3.11 available
3. [ ] Test roundtable-ai manually
4. [ ] Restart IDE to reconnect MCP
5. [ ] Update this doc with working examples

## Related
- GitHub: https://github.com/askbudi/roundtable
- MCP Config: `~/.codeium/windsurf/mcp_config.json`
- Current Workaround: `docker/code-server/BUILD_STATUS.md`
