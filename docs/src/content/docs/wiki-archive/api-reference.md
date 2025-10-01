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
- **[/api/ai/chat](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/chat/route.ts)** - AI chat completions
- **[/api/ai/generate-project](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/generate-project/route.ts)** - Generate projects from prompts
- **[/api/ai/search](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/ai/search/route.ts)** - Vector search for RAG
- **[/api/claude/chat](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/claude/chat/route.ts)** - Claude-specific chat endpoint

### 🔒 Authentication
- **[/api/auth/[...nextauth]](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/[...nextauth]/route.ts)** - NextAuth.js endpoints
- **[/api/auth/mfa/setup](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/mfa/setup/route.ts)** - Multi-factor authentication setup
- **[/api/auth/saml/sso](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/auth/saml/sso/route.ts)** - SAML SSO integration

### 📂 File Management
- **[/api/files](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/files/route.ts)** - File CRUD operations
- **[/api/files/sync](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/files/sync/route.ts)** - Real-time file synchronization

### 📊 Monitoring
- **[/api/monitoring/overview/dashboard](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/dashboard/route.ts)** - Monitoring dashboard data
- **[/api/monitoring/overview/metrics](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/metrics/route.ts)** - Performance metrics
- **[/api/monitoring/overview/security](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/monitoring/overview/security/route.ts)** - Security monitoring

### 🛠️ Development Tools
- **[/api/code-server/session](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/code-server/session/route.ts)** - Code server management
- **[/api/terminal/session](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/terminal/session/route.ts)** - Terminal sessions
- **[/api/terminal/ws](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/terminal/ws/route.ts)** - WebSocket terminal connection

### 💬 Chat & Communication
- **[/api/chat/stream](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/chat/stream/route.ts)** - Streaming chat
- **[/api/chat/mongodb](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/chat/mongodb/route.ts)** - Persistent chat storage

### 🎯 Project Management
- **[/api/projects/template](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/projects/template/route.ts)** - Template-based project generation
- **[/api/templates](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/templates/route.ts)** - Template management

### ⚡ Health & Diagnostics
- **[/api/health](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/health/route.ts)** - Comprehensive health check
- **[/api/health/simple](https://github.com/ryanmaclean/vibecode-webgui/blob/main/src/app/api/health/simple/route.ts)** - Simple health check

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

For detailed endpoint documentation, see the [auto-generated API docs](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/src/content/docs/wiki-archive/API.md).

---

*This documentation is automatically generated and kept in sync with the codebase.*
