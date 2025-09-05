---
title: API Reference
slug: api-reference
---

# API Reference

VibeCode provides a comprehensive REST API for various functionalities. All endpoints are documented below with their primary use cases.

## Core Endpoints

### AI CLI Tools
- `POST /api/ai-cli-tools/install` - Install AI CLI tools

### AI Endpoints
- `POST /api/ai/chat` - Standard AI chat endpoint
- `POST /api/ai/chat/enhanced` - Enhanced chat with additional features
- `POST /api/ai/chat/stream` - Streaming chat responses
- `POST /api/ai/chat/unified` - Unified chat interface
- `GET /api/ai/conversations/[workspaceId]` - Get conversation history
- `POST /api/ai/function-call` - Execute AI function calls
- `POST /api/ai/generate-project` - Generate new projects using AI
- `POST /api/ai/huggingface-chat` - Chat with Hugging Face models
- `POST /api/ai/huggingface-init` - Initialize Hugging Face integration
- `POST /api/ai/litellm` - LiteLLM integration endpoint
- `GET /api/ai/management` - AI service management
- `POST /api/ai/model-selection` - Intelligent model selection
- `GET /api/ai/provider-health` - Check AI provider health status
- `POST /api/ai/search` - AI-powered search
- `POST /api/ai/upload` - Upload files for AI processing
- `POST /api/ai/web-search` - Web search integration

### Authentication
- `GET/POST /api/auth/[...nextauth]` - NextAuth.js authentication
- `POST /api/auth/login-tracking` - Track user login events

### Chat Services
- `POST /api/chat/mongodb` - MongoDB-based chat storage
- `POST /api/chat/mongodb-simple` - Simplified MongoDB chat
- `POST /api/chat/stream` - Streaming chat interface

### Claude Integration
- `POST /api/claude/analyze` - Claude analysis endpoint
- `POST /api/claude/chat` - Claude chat interface
- `POST /api/claude/generate` - Claude content generation
- `GET /api/claude/session` - Claude session management

### Code Server
- `GET /api/code-server/session` - Get code server session
- `GET /api/code-server/session/[sessionId]` - Get specific session details

### Experiments
- `GET /api/experiments` - List available experiments

### File Management
- `GET/POST /api/files` - File operations
- `POST /api/files/sync` - File synchronization

### Gradio Integration
- `POST /api/gradio/run` - Run Gradio applications

### Health Monitoring
- `GET /api/health` - Comprehensive health check
- `GET /api/health/simple` - Simple health status

### MongoDB Testing
- `GET /api/mongodb-test` - MongoDB connection testing

### Monitoring & Observability
- `GET /api/monitoring/dashboard` - Monitoring dashboard data
- `GET /api/monitoring/metrics` - Performance metrics
- `GET /api/monitoring/otel-config` - OpenTelemetry configuration
- `GET /api/monitoring/performance` - Performance monitoring
- `GET /api/monitoring/rum` - Real User Monitoring data
- `GET /api/monitoring/security` - Security monitoring
- `GET /api/monitoring/traces` - Distributed tracing data

### Ollama Integration
- `GET /api/ollama/models` - List available Ollama models

### Project Management
- `GET /api/projects/template` - Get project templates

### Templates
- `GET /api/templates` - List available templates

### Terminal Services
- `GET /api/terminal/session` - Terminal session management
- `WebSocket /api/terminal/ws` - WebSocket terminal connection

### Workspace Management
- `POST /api/workspace/[id]/init-goose` - Initialize workspace with Goose migrations

## Authentication

Most API endpoints require authentication. Use NextAuth.js for authentication:

```javascript
// Example: Authenticated API call
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.accessToken}`
  },
  body: JSON.stringify({
    message: 'Hello, AI!',
    model: 'gpt-4'
  })
});
```

## Rate Limiting

API endpoints are rate-limited to ensure fair usage:
- **Standard endpoints**: 100 requests per minute
- **AI endpoints**: 50 requests per minute
- **File upload**: 10 requests per minute

## Error Handling

All API endpoints return standardized error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}
```

## WebSocket Endpoints

Some endpoints support WebSocket connections for real-time communication:
- `/api/terminal/ws` - Terminal sessions
- `/api/ai/chat/stream` - Streaming AI responses

## API Documentation

For detailed API documentation with request/response examples, see [docs/API.md](/docs/API.md) (auto-generated).

## Getting Started with the API

1. **Authentication**: Set up NextAuth.js authentication
2. **Environment**: Configure your API keys in `.env`
3. **Testing**: Use the health endpoints to verify connectivity
4. **Development**: Start with simple endpoints like `/api/health`

Need help? Check out our [Getting Started Guide](/wiki/getting-started) or [Development Scripts](/wiki/development-scripts).
