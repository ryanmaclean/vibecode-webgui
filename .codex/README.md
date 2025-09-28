# Codex CLI + Sequential Thinking MCP

This folder holds the project-scoped configuration for running the OpenAI Codex CLI with the Sequential Thinking MCP server enabled.

## Setup

1. Install dependencies so the Sequential Thinking server is available locally:
   ```sh
   npm install
   ```
2. Point the Codex CLI at this configuration when running commands:
   ```sh
   codex --config .codex/config.toml mcp list
   ```
   The Sequential Thinking server should appear in the output.

## Notes

- The configuration uses `npx @modelcontextprotocol/server-sequential-thinking`, so it will always resolve to the version declared in `package.json`.
- Adjust the config or add additional `[mcp_servers.*]` sections here if you need more MCP integrations on this project.
