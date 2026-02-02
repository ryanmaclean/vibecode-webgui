---
title: "API Reference"
description: "Complete API documentation for VibeCode Platform"
sidebar:
  order: 100
---

# VibeCode API Reference

*Last updated: 2025-08-25T18:53:28.182Z*

This comprehensive API reference provides detailed documentation for all VibeCode platform endpoints.

## Overview

The VibeCode API provides programmatic access to:
- 🤖 AI-powered code generation and analysis
- 📁 Project management and templates
- 🤝 Real-time collaboration features
- 📂 File operations and synchronization
- 📊 Monitoring and observability
- 🔒 Authentication and security

## Base URLs

```
Production:  https://vibecode.example.com/api
Development: http://localhost:3000/api
```

## Authentication

Most endpoints require authentication via one of these methods:

### JWT Bearer Token
```http
Authorization: Bearer <your_jwt_token>
```

### API Key
```http
x-api-key: <your_api_key>
```

## Rate Limits

| Endpoint Type | Requests per Minute |
|---------------|-------------------|
| Standard endpoints | 100 |
| AI endpoints | 20 |
| File upload endpoints | 10 |

## API Categories

### 🤖 AI Services
- **[/api/ai/chat](/api/ai/chat)** - AI chat completions
- **[/api/ai/generate-project](/api/ai/generate-project)** - Generate projects from prompts
- **[/api/ai/search](/api/ai/search)** - Vector search for RAG
- **[/api/claude/chat](/api/claude/chat)** - Claude-specific chat endpoint

### 🔒 Authentication
- **[/api/auth/[...nextauth]](/api/auth/[...nextauth])** - NextAuth.js endpoints
- **[/api/auth/mfa/setup](/api/auth/mfa/setup)** - Multi-factor authentication setup
- **[/api/auth/saml/sso](/api/auth/saml/sso)** - SAML SSO integration

### 📂 File Management
- **[/api/files](/api/files)** - File CRUD operations
- **[/api/files/sync](/api/files/sync)** - Real-time file synchronization

### 📊 Monitoring
- **[/api/monitoring/dashboard](/api/monitoring/dashboard)** - Monitoring dashboard data
- **[/api/monitoring/metrics](/api/monitoring/metrics)** - Performance metrics
- **[/api/monitoring/security](/api/monitoring/security)** - Security monitoring

### 🛠️ Development Tools
- **[/api/code-server/session](/api/code-server/session)** - Code server management
- **[/api/terminal/session](/api/terminal/session)** - Terminal sessions
- **[/api/terminal/ws](/api/terminal/ws)** - WebSocket terminal connection

### 💬 Chat & Communication
- **[/api/chat/stream](/api/chat/stream)** - Streaming chat
- **[/api/chat/mongodb](/api/chat/mongodb)** - Persistent chat storage

### 🎯 Project Management
- **[/api/projects/template](/api/projects/template)** - Template-based project generation
- **[/api/templates](/api/templates)** - Template management

### ⚡ Health & Diagnostics
- **[/api/health](/api/health)** - Comprehensive health check
- **[/api/health/simple](/api/health/simple)** - Simple health check

## Common Response Format

All API responses follow this standard format:

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "message": "Operation completed successfully",
  "timestamp": "2025-08-22T10:30:00Z",
  "requestId": "req_abc123"
}
```

## Error Handling

Error responses include detailed information:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "workspaceId",
      "issue": "Required field missing"
    }
  },
  "timestamp": "2025-08-22T10:30:00Z",
  "requestId": "req_abc123"
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Request parameters are invalid |
| 401 | `UNAUTHORIZED` | Authentication required or invalid |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

## Code Examples

### cURL Example
```bash
curl -X POST \
  "https://api.vibecode.com/ai/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Create a React component"}
    ]
  }'
```

### JavaScript/TypeScript Example
```typescript
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Create a React component' }
    ]
  })
});

const data = await response.json();
console.log(data);
```

### Python Example
```python
import requests

response = requests.post(
    'https://api.vibecode.com/ai/chat',
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    },
    json={
        'messages': [
            {'role': 'user', 'content': 'Create a React component'}
        ]
    }
)

data = response.json()
print(data)
```

## SDK Support

### Official SDKs
- **TypeScript/JavaScript**: `npm install @vibecode/api-client`
- **Python**: `pip install vibecode-api`
- **Go**: `go get github.com/vibecode/go-client`

For detailed endpoint documentation, see the [auto-generated API docs](./API.md).

---

*This documentation is automatically generated and kept in sync with the codebase.*
