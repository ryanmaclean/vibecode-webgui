# MCP Server Examples

VibeCode's MCP server configuration lives in `config/`:

- `config/mcp-servers.example.json`: the server catalog template.
- `config/mcp.json` and `config/mcp_config.json`: the configs the IDE integrations load.

See [docs/MCP_INTEGRATION.md](../../docs/MCP_INTEGRATION.md) and [docs/MCP_QUICK_START.md](../../docs/MCP_QUICK_START.md).

The old `zen-mcp-server/` example tree was removed on 2026-10-24 (WS8 cleanup, #2125). Its README described
features that the upstream [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server) does not have.
Use the upstream README for current setup steps.

## Contributing

To add a new MCP server example, create a directory under `examples/mcp-servers/` with IDE-specific
configurations and sample prompts, and list it here.
