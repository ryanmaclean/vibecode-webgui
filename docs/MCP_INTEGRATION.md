# Model Context Protocol (MCP) Integration

VibeCode exposes its operations through the Model Context Protocol, enabling AI agents to interact with the platform programmatically.

## What is MCP?

The Model Context Protocol is a standardized way for AI models to interact with external tools and data sources. It's supported by:
- Windsurf IDE
- Claude Desktop
- Other MCP-compatible AI clients

## Available Tools

### 1. create-workspace
Create a new development workspace.

```json
{
  "name": "my-app",
  "template": "nextjs",
  "description": "My Next.js application"
}
```

**Templates:** react, nextjs, nodejs, python, go, rust

### 2. run-tests
Execute tests in a workspace.

```json
{
  "workspaceId": "ws-123",
  "testType": "unit",
  "pattern": "*.test.ts"
}
```

**Test Types:** unit, integration, e2e, all

### 3. deploy-project
Deploy a project to an environment.

```json
{
  "workspaceId": "ws-123",
  "environment": "production",
  "buildCommand": "npm run build"
}
```

**Environments:** development, staging, production

### 4. search-code
Semantic code search using vector embeddings.

```json
{
  "query": "authentication middleware",
  "workspaceId": "ws-123",
  "language": "typescript"
}
```

### 5. analyze-code
Analyze code for issues.

```json
{
  "workspaceId": "ws-123",
  "filePath": "src/app.ts",
  "checks": ["security", "performance", "quality"]
}
```

### 6. generate-code
AI-powered code generation.

```json
{
  "prompt": "Create a React component for a user profile card",
  "language": "typescript",
  "context": "Using Tailwind CSS"
}
```

## Available Resources

### vibecode://templates
List of available project templates.

### vibecode://workspaces
Active development workspaces.

### vibecode://docs
VibeCode documentation.

## Setup

### For Windsurf

1. Add to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "vibecode": {
      "command": "node",
      "args": ["--loader", "ts-node/esm", "/path/to/vibecode-webgui/src/mcp/server.ts"]
    }
  }
}
```

2. Restart Windsurf

3. The VibeCode tools will be available to Cascade

### For Claude Desktop

1. Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vibecode": {
      "command": "node",
      "args": ["--loader", "ts-node/esm", "/path/to/vibecode-webgui/src/mcp/server.ts"]
    }
  }
}
```

2. Restart Claude Desktop

3. Ask Claude to use VibeCode tools

## Usage Examples

### Create a Workspace

**Prompt:** "Create a new Next.js workspace called 'my-blog'"

**AI will call:**
```json
{
  "tool": "create-workspace",
  "arguments": {
    "name": "my-blog",
    "template": "nextjs",
    "description": "A blog built with Next.js"
  }
}
```

### Run Tests

**Prompt:** "Run all tests in workspace ws-123"

**AI will call:**
```json
{
  "tool": "run-tests",
  "arguments": {
    "workspaceId": "ws-123",
    "testType": "all"
  }
}
```

### Search Code

**Prompt:** "Find all authentication-related code"

**AI will call:**
```json
{
  "tool": "search-code",
  "arguments": {
    "query": "authentication middleware and login handlers"
  }
}
```

## Development

### Running the Server

```bash
# Development
npm run mcp:dev

# Production
npm run mcp:start
```

### Testing

```bash
# Test MCP server
npm run test:mcp
```

### Adding New Tools

1. Create tool implementation in `src/mcp/tools/`
2. Add tool definition to `src/mcp/server.ts`
3. Update this documentation
4. Add tests

## Troubleshooting

### Server not starting

Check that all dependencies are installed:
```bash
npm install
```

### Tools not appearing

1. Restart your MCP client (Windsurf/Claude)
2. Check server logs
3. Verify mcp.json configuration

### Permission errors

Ensure the server script is executable:
```bash
chmod +x src/mcp/server.ts
```

## References

- [MCP Specification](https://modelcontextprotocol.io/)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- [Example Servers](https://github.com/modelcontextprotocol/servers)
- [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server) - Mindfulness and focus tools for AI workflows
