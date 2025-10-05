# Code Examples

This directory contains example code and implementations for various VibeCode features.

## MCP Servers

See [mcp-servers/](./mcp-servers/) for comprehensive MCP server integration examples:

- **Zen MCP Server** - Mindfulness and focus tools for AI workflows
  - Neovim configuration with Avante.nvim
  - VSCode/Cursor/Windsurf setup
  - VSCodium web apps deployment
  - Sample prompts for Zen + Codex, Claude, OpenCode, and Gemini of the VibeCode WebGUI platform.

## 📁 Directory Structure

```
examples/
├── api/                 # API endpoint examples
├── components/          # React component examples
├── hooks/              # Custom React hooks examples
├── integrations/       # Third-party integration examples
├── testing/           # Testing examples and patterns
├── deployment/        # Deployment configuration examples
└── workflows/         # Development workflow examples
```

## 🚀 Quick Start Examples

### Basic API Endpoint

See: [api/basic-crud.ts](./api/basic-crud.ts)

### React Component with TypeScript

See: [components/user-profile.tsx](./components/user-profile.tsx)

### Custom Hook with Caching

See: [hooks/useWorkspaces.ts](./hooks/useWorkspaces.ts)

### AI Integration

See: [integrations/ai-chat.ts](./integrations/ai-chat.ts)

### E2E Testing

See: [testing/user-journey.test.ts](./testing/user-journey.test.ts)

## 🎯 Example Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **API** | REST API endpoints with authentication | CRUD operations, AI endpoints, file handling |
| **Components** | React components with proper TypeScript | Forms, dashboards, modals, layouts |
| **Hooks** | Custom React hooks for common patterns | Data fetching, caching, real-time updates |
| **Integrations** | Third-party service integrations | OpenAI, Anthropic, Datadog, Redis |
| **Testing** | Testing patterns and examples | Unit tests, integration tests, E2E tests |
| **Deployment** | Deployment configurations | Docker, Kubernetes, CI/CD pipelines |

## 📚 Learning Path

### Beginner
1. [Basic API Endpoint](./api/basic-crud.ts) - Learn API patterns
2. [Simple Component](./components/user-profile.tsx) - React with TypeScript
3. [Basic Hook](./hooks/useWorkspaces.ts) - Custom hook patterns

### Intermediate
1. [AI Integration](./integrations/ai-chat.ts) - Working with LiteLLM
2. [Advanced Component](./components/dashboard-analytics.tsx) - Complex UI patterns
3. [Testing Patterns](./testing/user-journey.test.ts) - Comprehensive testing

### Advanced
1. [Performance Optimization](./integrations/redis-caching.ts) - Caching strategies
2. [Security Implementation](./api/secure-endpoint.ts) - Security best practices
3. [Monitoring Integration](./integrations/datadog-metrics.ts) - Observability

## 🔍 How to Use Examples

1. **Copy and Adapt**: Use examples as starting points for your own features
2. **Run Locally**: All examples are fully functional and can be tested
3. **Learn Patterns**: Study the code patterns and best practices used
4. **Extend**: Modify examples to fit your specific use cases

## 🧪 Running Examples

Most examples can be run independently:

```bash
# Run API examples
npm run dev
curl http://localhost:3000/api/examples/basic-crud

# Run component examples in Storybook (if available)
npm run storybook

# Run test examples
npm run test examples/testing/

# Run integration examples
npm run test:integration examples/integrations/
```

## 📝 Contributing Examples

When adding new examples:

1. **Follow Patterns**: Use existing examples as templates
2. **Add Documentation**: Include clear comments and README sections
3. **Test Thoroughly**: Ensure examples work correctly
4. **Keep Updated**: Update examples when core patterns change

## 🤝 Need Help?

- Check the [Onboarding Guide](../docs/ONBOARDING_GUIDE.md)
- Review [Developer Guide](../docs/DEVELOPER_GUIDE.md)
- Ask in Slack #vibecode-development
- Create an issue for complex examples