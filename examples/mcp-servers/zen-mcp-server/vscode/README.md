# Zen MCP Server - VSCode/Cursor/Windsurf Configuration

Integration guide for using Zen MCP Server with VSCode, Cursor, Windsurf, and other VSCode-based editors.

## Supported Editors

- **VSCode** - Microsoft Visual Studio Code
- **Cursor** - AI-first code editor
- **Windsurf** - Codeium's AI IDE
- **VSCodium** - Open source VSCode build
- **Code - OSS** - Open source VSCode

## Installation

### 1. Install Node.js

Ensure Node.js >= 18.0.0 is installed:
```bash
node --version
```

### 2. Configure MCP Server

#### For Windsurf/Cursor

Create or edit `~/.codeium/windsurf/mcp.json` (Windsurf) or `~/.cursor/mcp.json` (Cursor):

```json
{
  "mcpServers": {
    "zen": {
      "command": "npx",
      "args": ["-y", "@beehiveinnovations/zen-mcp-server"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

#### For VSCode with MCP Extension

1. Install an MCP-compatible extension (e.g., "MCP Client" or "Claude Dev")
2. Add to your `settings.json`:

```json
{
  "mcp.servers": {
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

### 3. Restart Your Editor

Completely quit and restart your editor to load the MCP configuration.

## Usage

### In Windsurf/Cursor

Open the AI chat panel and use `@zen` commands:

```
@zen start focus --duration 25m
```

```
@zen schedule break --in 45m
```

```
@zen stats today
```

### Sample Workflows

#### 1. Morning Focus Session

```
@zen start morning-focus --duration 90m

Help me plan today's development tasks based on priority and complexity.
```

#### 2. Pomodoro Technique

```
@zen pomodoro --work 25 --break 5 --cycles 4

Let's implement these unit tests one pomodoro at a time. Start with authentication tests.
```

#### 3. Mindful Code Review

```
@zen mindful-review --file src/auth/login.ts

Review this authentication code for security vulnerabilities and code quality.
```

#### 4. Deep Work Session

```
@zen start deep-work --duration 120m --breaks-disabled

I need to refactor this entire module. Let's work methodically through each component.
```

## AI Assistant Combinations

### Zen + Cursor AI

```
@zen start focus --duration 30m

@cursor refactor this component to use React hooks and improve performance
```

### Zen + Windsurf Cascade

```
@zen check-focus

@cascade analyze this codebase for architectural improvements
```

### Zen + GitHub Copilot

```
@zen pomodoro --cycles 3

// Use Copilot suggestions while Zen manages your focus
// Zen will remind you to take breaks between cycles
```

### Zen + Claude (via extension)

```
@zen mindful-review

@claude provide a comprehensive security audit of this API endpoint
```

## Configuration Examples

### Basic Configuration

```json
{
  "mcpServers": {
    "zen": {
      "command": "npx",
      "args": ["-y", "@beehiveinnovations/zen-mcp-server"]
    }
  }
}
```

### With Custom Environment

```json
{
  "mcpServers": {
    "zen": {
      "command": "npx",
      "args": ["-y", "@beehiveinnovations/zen-mcp-server"],
      "env": {
        "NODE_ENV": "production",
        "ZEN_CONFIG_PATH": "/Users/yourname/.config/zen-mcp",
        "ZEN_DATA_PATH": "/Users/yourname/.local/share/zen-mcp"
      }
    }
  }
}
```

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
        "DD_SERVICE": "mcp-zen-vscode",
        "DD_VERSION": "1.0.0"
      }
    }
  }
}
```

### Multiple MCP Servers

```json
{
  "mcpServers": {
    "zen": {
      "command": "npx",
      "args": ["-y", "@beehiveinnovations/zen-mcp-server"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/yourname/projects"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${env:GITHUB_TOKEN}"
      }
    }
  }
}
```

## Keyboard Shortcuts

### Recommended VSCode Keybindings

Add to `keybindings.json`:

```json
[
  {
    "key": "ctrl+shift+z f",
    "command": "workbench.action.chat.open",
    "args": "@zen start focus --duration 25m"
  },
  {
    "key": "ctrl+shift+z b",
    "command": "workbench.action.chat.open",
    "args": "@zen schedule break --in 30m"
  },
  {
    "key": "ctrl+shift+z s",
    "command": "workbench.action.chat.open",
    "args": "@zen stats today"
  },
  {
    "key": "ctrl+shift+z p",
    "command": "workbench.action.chat.open",
    "args": "@zen pomodoro --cycles 4"
  }
]
```

## Troubleshooting

### MCP Server Not Starting

1. Check the Output panel (View → Output → select "MCP" or your AI extension)
2. Verify npx is in PATH:
   ```bash
   which npx
   npx -y @beehiveinnovations/zen-mcp-server --version
   ```
3. Try running the command manually in terminal

### Commands Not Recognized

Ensure you're using the `@zen` prefix:
```
✓ @zen start focus
✗ zen start focus
```

### Configuration File Location

**Windsurf:**
- macOS: `~/.codeium/windsurf/mcp.json`
- Linux: `~/.codeium/windsurf/mcp.json`
- Windows: `%USERPROFILE%\.codeium\windsurf\mcp.json`

**Cursor:**
- macOS: `~/.cursor/mcp.json`
- Linux: `~/.cursor/mcp.json`
- Windows: `%USERPROFILE%\.cursor\mcp.json`

**VSCode:**
- Settings → Extensions → MCP Client → Edit in settings.json

### Performance Issues

If the editor feels slow:

1. Reduce the number of active MCP servers
2. Use `lazy` loading if supported:
   ```json
   {
     "zen": {
       "command": "npx",
       "args": ["-y", "@beehiveinnovations/zen-mcp-server"],
       "lazy": true
     }
   }
   ```

## Advanced Usage

### Custom Focus Profiles

```
@zen create-profile deep-work --duration 120m --breaks 10m --notifications off

@zen start deep-work
```

### Productivity Analytics

```
@zen stats --period week --export json

@zen productivity-report --format markdown
```

### Integration with Task Tracking

```
@zen start focus --task "Implement authentication module" --project "vibecode"

@zen task-complete --time-spent 45m
```

## Resources

- [Zen MCP Server Repository](https://github.com/BeehiveInnovations/zen-mcp-server)
- [Sample Prompts](../sample-prompts/)
- [Configuration Templates](./mcp-config-templates/)
- [Windsurf Documentation](https://docs.codeium.com/windsurf)
- [Cursor Documentation](https://cursor.sh/docs)

## Example Files

- [mcp.json template](./mcp-config-templates/mcp.json)
- [settings.json template](./mcp-config-templates/settings.json)
- [keybindings.json template](./mcp-config-templates/keybindings.json)
