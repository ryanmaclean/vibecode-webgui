# Zen MCP Server - Example Integration

This directory contains example configurations for integrating the [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server) with various IDEs and AI coding assistants.

## What is Zen MCP Server?

Zen MCP Server brings mindfulness and focus tools to your AI-powered development workflow. It helps you:

- Maintain focus during coding sessions
- Take mindful breaks
- Track productivity patterns
- Balance AI assistance with intentional coding

## Installation

The Zen MCP Server is available via npm:

```bash
# Run directly with npx (recommended)
npx -y @beehiveinnovations/zen-mcp-server

# Or install globally
npm install -g @beehiveinnovations/zen-mcp-server
```

## IDE Configurations

### Neovim (with Avante.nvim)

See [neovim/README.md](./neovim/README.md) for Neovim-specific setup.

**Quick Config:**
```lua
-- In your Neovim config (e.g., ~/.config/nvim/lua/plugins/avante.lua)
require('avante').setup({
  mcp = {
    servers = {
      zen = {
        command = "npx",
        args = { "-y", "@beehiveinnovations/zen-mcp-server" }
      }
    }
  }
})
```

### VSCode / Cursor / Windsurf

See [vscode/README.md](./vscode/README.md) for VSCode-family setup.

**Quick Config:**
```json
// In settings.json or mcp.json
{
  "mcpServers": {
    "zen": {
      "command": "npx",
      "args": ["-y", "@beehiveinnovations/zen-mcp-server"]
    }
  }
}
```

### VSCodium Web Apps

See [vscodium-web/README.md](./vscodium-web/README.md) for web-based setup.

**Quick Config:**
```json
// In your web app's MCP configuration
{
  "mcpServers": {
    "zen": {
      "command": "npx",
      "args": ["-y", "@beehiveinnovations/zen-mcp-server"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## AI Assistant Combinations

### Zen + Codex (GitHub Copilot)

**Sample Prompt:**
```
Using zen, start a 25-minute focus session. Then help me refactor this authentication module using best practices.
```

### Zen + Claude Code

**Sample Prompt:**
```
@zen schedule a break in 45 minutes. Now, let's review this API design for security vulnerabilities.
```

### Zen + OpenCode

**Sample Prompt:**
```
Check my zen productivity stats for today. Based on my focus patterns, suggest the best time to tackle this complex algorithm implementation.
```

### Zen + Gemini CLI

**Sample Prompt:**
```
Start a zen mindful coding session. Guide me through implementing this feature with intentional, well-documented code.
```

## Sample Workflows

### Morning Focus Session

```bash
# In your IDE's AI chat
"@zen start morning-focus --duration 90m"
"Help me prioritize today's tasks based on complexity and my typical focus patterns"
```

### Pomodoro Technique

```bash
"@zen pomodoro --work 25 --break 5 --cycles 4"
"Let's tackle these unit tests one pomodoro at a time"
```

### Mindful Code Review

```bash
"@zen mindful-review --file src/auth/login.ts"
"Review this code with a focus on clarity, maintainability, and security"
```

## Advanced Usage

### With Datadog Tracing

```json
{
  "mcpServers": {
    "zen": {
      "command": "npx",
      "args": ["-y", "@beehiveinnovations/zen-mcp-server"],
      "env": {
        "DD_AGENT_HOST": "localhost",
        "DD_TRACE_AGENT_PORT": "8126",
        "DD_ENV": "development",
        "DD_SERVICE": "mcp-zen"
      }
    }
  }
}
```

### Custom Focus Profiles

```bash
# Create a custom focus profile
"@zen create-profile deep-work --duration 120m --breaks 10m --notifications off"

# Use the profile
"@zen start deep-work"
```

## Troubleshooting

### Server Not Starting

```bash
# Check if npx can access the package
npx -y @beehiveinnovations/zen-mcp-server --version

# Clear npm cache if needed
npm cache clean --force
```

### IDE Not Detecting Server

1. Restart your IDE completely
2. Check the MCP configuration file location
3. Verify the server command is in your PATH
4. Check IDE logs for MCP-related errors

### Commands Not Working

Ensure you're using the `@zen` prefix in your prompts:
```
✓ "@zen start focus"
✗ "zen start focus"
```

## Resources

- [Zen MCP Server Repository](https://github.com/BeehiveInnovations/zen-mcp-server)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Sample Prompts](./sample-prompts/)
- [IDE-Specific Guides](./neovim/README.md)

## Contributing

Found a useful workflow or prompt? Submit a PR to add it to the sample prompts directory!
