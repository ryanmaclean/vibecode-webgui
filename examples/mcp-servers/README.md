# MCP Server Examples

This directory contains example MCP server configurations and usage patterns for various AI coding assistants and IDEs.

## Available Examples

### Zen MCP Server

The [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server) provides mindfulness and focus tools for AI workflows.

**Features:**
- Focus session management
- Mindful coding reminders
- Break scheduling
- Productivity tracking

**Installation:**
```bash
npx -y @beehiveinnovations/zen-mcp-server
```

## IDE Support

We provide configuration examples for:

- **Neovim** - Native MCP integration with Avante.nvim
- **VSCode/Cursor/Windsurf** - Standard MCP configuration
- **VSCodium Web Apps** - Browser-based MCP integration
- **Claude Desktop** - Standalone MCP client

## AI Assistant Combinations

Sample prompts and workflows for combining Zen with:

- **Codex** (GitHub Copilot)
- **Claude Code** (Anthropic)
- **OpenCode** (Open source models)
- **Gemini CLI** (Google)

See individual configuration files for detailed setup instructions.

## Quick Start

1. Choose your IDE configuration from the appropriate directory
2. Copy the configuration to your IDE's MCP config location
3. Restart your IDE
4. Try the sample prompts in `sample-prompts/`

## Directory Structure

```
examples/mcp-servers/
├── README.md                          # This file
├── zen-mcp-server/
│   ├── README.md                      # Zen server documentation
│   ├── neovim/                        # Neovim configuration
│   ├── vscode/                        # VSCode/Cursor/Windsurf config
│   ├── vscodium-web/                  # Web-based VSCodium config
│   └── sample-prompts/                # Example prompts
└── shared/
    └── mcp-wrapper-templates/         # Reusable wrapper scripts
```

## Contributing

To add a new MCP server example:

1. Create a new directory under `examples/mcp-servers/`
2. Include IDE-specific configurations
3. Add sample prompts demonstrating the server's capabilities
4. Update this README with the new server information
