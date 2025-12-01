# Codex CLI + Sequential Thinking MCP

This folder contains the OpenAI Codex IDE/CLI configuration needed to expose the Sequential Thinking MCP server over the Codex `/mcp` integration point. Use this when following the internal Codex setup guide together with the Sequential Thinking reference (`MCP_Sequential.md` in the repo root).

## Install local MCP dependencies

```sh
npm install --prefix .codex
```

The scoped `package.json` pins `@modelcontextprotocol/server-sequential-thinking` so Codex resolves the same version that our Sequential Thinking documentation validates.

## Codex MCP configuration

`.codex/config.toml` registers the Sequential Thinking server for Codex:

```toml
[mcp_servers."sequential-thinking"]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-sequential-thinking"]
working_directory = "."
timeout = 60
transport = "stdio"

[features]
rmcp_client = true
```

Codex automatically reads this file when `CODEX_HOME` points at `.codex/`.

## Verifying in OpenAI Codex

1. Launch Codex with the project wrapper:
   ```sh
   npm run codex -- mcp list
   ```
2. You should see `sequential-thinking` listed. Inside Codex, run:
   ```
   /mcp sequential-thinking status
   ```
   to confirm the IDE can reach the server over the `/mcp` command channel.

## Adding more MCP servers

Append additional `[mcp_servers."<name>"]` sections to `config.toml` as needed. Keep large binaries out of the repo and follow the Sequential Thinking implementation guidance when extending the workflow.
