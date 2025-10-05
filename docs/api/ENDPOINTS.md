# API Endpoints Reference

Complete reference for all VibeCode WebGUI API endpoints.

## Table of Contents

- [Authentication](#authentication)
- [Workspaces](#workspaces)
- [AI Services](#ai-services)
- [Code Server](#code-server)
- [Terminal](#terminal)
- [Projects & Templates](#projects--templates)
- [Vector Store](#vector-store)
- [Health & Monitoring](#health--monitoring)
- [Files & Documents](#files--documents)
- [User Management](#user-management)
- [Experiments](#experiments)

---

## Authentication

### Login / Session Management

#### `GET/POST /api/auth/[...nextauth]`

NextAuth.js catch-all route for authentication operations.

**Authentication**: None (public endpoint)

**Supported Operations**:
- `GET /api/auth/session` - Get current session
- `GET /api/auth/providers` - List auth providers
- `GET /api/auth/signin` - Sign in page
- `POST /api/auth/signin/credentials` - Credentials login
- `POST /api/auth/signout` - Sign out

**Example: Get Session**

```bash
curl -X GET 'http://localhost:3000/api/auth/session' \
  -H 'Cookie: next-auth.session-token=...'
```

**Response**: 200 OK

```json
{
  "user": {
    "id": "1",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "expires": "2025-11-01T00:00:00.000Z"
}
```

**Errors**:
- `401 Unauthorized` - No valid session

---

### Multi-Factor Authentication

#### `POST /api/auth/mfa/setup`

Setup new MFA device for user account.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "type": "totp",
  "name": "My Authenticator App",
  "phoneNumber": "+1234567890",
  "email": "user@example.com"
}
```

**Parameters**:
- `type` (required): MFA type - `totp`, `sms`, or `email`
- `name` (required): Device name (1-50 characters)
- `phoneNumber` (optional): Required for SMS
- `email` (optional): Required for email MFA

**Example**:

```bash
curl -X POST 'http://localhost:3000/api/auth/mfa/setup' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: next-auth.session-token=...' \
  -d '{
    "type": "totp",
    "name": "Google Authenticator"
  }'
```

**Response**: 200 OK

```json
{
  "status": "success",
  "data": {
    "deviceId": "mfa_device_123",
    "qrCodeUrl": "otpauth://totp/VibeCode:user@example.com?secret=...",
    "backupCodes": ["12345678", "87654321"],
    "setupToken": "setup_token_xyz"
  },
  "message": "TOTP MFA setup initiated"
}
```

**Errors**:
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Not authenticated

---

#### `PUT /api/auth/mfa/setup`

Verify and activate MFA device.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "deviceId": "mfa_device_123",
  "token": "123456",
  "setupToken": "setup_token_xyz"
}
```

**Example**:

```bash
curl -X PUT 'http://localhost:3000/api/auth/mfa/setup' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: next-auth.session-token=...' \
  -d '{
    "deviceId": "mfa_device_123",
    "token": "123456",
    "setupToken": "setup_token_xyz"
  }'
```

**Response**: 200 OK

```json
{
  "status": "success",
  "message": "MFA device verified and activated"
}
```

**Errors**:
- `400 Bad Request` - Invalid verification code
- `401 Unauthorized` - Not authenticated

---

#### `POST /api/auth/mfa/verify`

Verify MFA token during login.

**Authentication**: Partial (pending MFA)

**Request Body**:

```json
{
  "userId": "1",
  "token": "123456",
  "deviceId": "mfa_device_123"
}
```

---

#### `GET /api/auth/login-tracking`

Retrieve login history and tracking information.

**Authentication**: Required (session)

---

### SAML SSO

#### `POST /api/auth/saml/sso`

SAML single sign-on authentication endpoint.

**Authentication**: None (SSO flow)

---

#### `GET /api/auth/saml/metadata`

Retrieve SAML metadata for identity provider configuration.

**Authentication**: None (public metadata)

**Response**: 200 OK (XML)

```xml
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://vibecode.dev">
  ...
</EntityDescriptor>
```

---

## Workspaces

### List Workspaces

#### `GET /api/workspace`

List all workspaces for authenticated user.

**Authentication**: Required (session)

**Query Parameters**:
- `status` (optional): Filter by status - `ready`, `creating`, `error`
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Example**:

```bash
curl -X GET 'http://localhost:3000/api/workspace?status=ready&limit=10' \
  -H 'Cookie: next-auth.session-token=...'
```

**Response**: 200 OK

```json
{
  "success": true,
  "workspaces": [
    {
      "id": "workspace-abc123",
      "name": "My Project",
      "status": "ready",
      "createdAt": "2025-10-01T10:00:00.000Z",
      "url": "http://localhost:8080"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5
  }
}
```

**Errors**:
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Service error

---

### Get Workspace Details

#### `GET /api/workspaces/[id]`

Get detailed information about specific workspace.

**Authentication**: Required (session, owner)

**Path Parameters**:
- `id` (required): Workspace ID

**Example**:

```bash
curl -X GET 'http://localhost:3000/api/workspaces/workspace-abc123' \
  -H 'Cookie: next-auth.session-token=...'
```

**Response**: 200 OK

```json
{
  "success": true,
  "workspace": {
    "id": "workspace-abc123",
    "name": "My Project",
    "status": "ready",
    "url": "http://localhost:8080",
    "createdAt": "2025-10-01T10:00:00.000Z",
    "lastActivity": "2025-10-01T12:30:00.000Z",
    "resources": {
      "cpu": "2 cores",
      "memory": "4GB",
      "storage": "20GB"
    }
  }
}
```

**Errors**:
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not workspace owner
- `404 Not Found` - Workspace does not exist
- `503 Service Unavailable` - Kubernetes not available

---

### Create Workspace

#### `POST /api/workspace`

Create new development workspace.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "name": "My New Project",
  "template": "nodejs",
  "resources": {
    "cpu": "2",
    "memory": "4Gi",
    "storage": "20Gi"
  }
}
```

**Example**:

```bash
curl -X POST 'http://localhost:3000/api/workspace' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: next-auth.session-token=...' \
  -d '{
    "name": "My New Project",
    "template": "nodejs"
  }'
```

**Response**: 201 Created

```json
{
  "success": true,
  "workspace": {
    "id": "workspace-xyz789",
    "name": "My New Project",
    "status": "creating",
    "estimatedReadyTime": "2m"
  },
  "message": "Workspace creation initiated"
}
```

**Errors**:
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Not authenticated
- `503 Service Unavailable` - Kubernetes unavailable

---

### Update Workspace

#### `PATCH /api/workspaces/[id]`

Update workspace configuration.

**Authentication**: Required (session, owner)

**Path Parameters**:
- `id` (required): Workspace ID

**Request Body**:

```json
{
  "name": "Updated Project Name",
  "resources": {
    "cpu": "4",
    "memory": "8Gi"
  }
}
```

**Example**:

```bash
curl -X PATCH 'http://localhost:3000/api/workspaces/workspace-abc123' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: next-auth.session-token=...' \
  -d '{
    "name": "Updated Name"
  }'
```

**Response**: 200 OK

```json
{
  "success": true,
  "workspace": {
    "id": "workspace-abc123",
    "name": "Updated Name",
    "status": "ready"
  },
  "message": "Workspace update not yet implemented"
}
```

**Errors**:
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not workspace owner
- `404 Not Found` - Workspace does not exist

---

### Delete Workspace

#### `DELETE /api/workspaces/[id]`

Delete workspace and all associated resources.

**Authentication**: Required (session, owner)

**Path Parameters**:
- `id` (required): Workspace ID

**Example**:

```bash
curl -X DELETE 'http://localhost:3000/api/workspaces/workspace-abc123' \
  -H 'Cookie: next-auth.session-token=...'
```

**Response**: 200 OK

```json
{
  "success": true,
  "message": "Workspace workspace-abc123 deleted successfully"
}
```

**Errors**:
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not workspace owner
- `404 Not Found` - Workspace does not exist
- `500 Internal Server Error` - Deletion failed

---

### Initialize Goose AI

#### `POST /api/workspace/[id]/init-goose`

Initialize Goose AI assistant in workspace.

**Authentication**: Required (session, owner)

**Path Parameters**:
- `id` (required): Workspace ID

---

### Auto-Scaling Configuration

#### `GET/POST /api/workspace/auto-scaling`

Configure workspace auto-scaling policies.

**Authentication**: Required (session, admin)

---

## AI Services

### AI Chat

#### `POST /api/ai/chat`

Send chat message to AI assistant with optional RAG context.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful coding assistant."
    },
    {
      "role": "user",
      "content": "How do I create a React component?"
    }
  ],
  "model": "gpt-4",
  "temperature": 0.7,
  "max_tokens": 2000,
  "stream": false,
  "workspaceId": "123",
  "includeRag": true
}
```

**Parameters**:
- `messages` (required): Array of chat messages
- `model` (optional): AI model to use (default: free model)
- `temperature` (optional): Sampling temperature 0.0-2.0 (default: 0.7)
- `max_tokens` (optional): Maximum response tokens
- `stream` (optional): Enable streaming (not supported on this endpoint)
- `workspaceId` (optional): Workspace for RAG context
- `includeRag` (optional): Include workspace context (default: true)

**Example**:

```bash
curl -X POST 'http://localhost:3000/api/ai/chat' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: next-auth.session-token=...' \
  -d '{
    "messages": [
      {"role": "user", "content": "Explain async/await in JavaScript"}
    ],
    "workspaceId": "123"
  }'
```

**Response**: 200 OK

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1633024800,
  "model": "gpt-4",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "async/await is syntactic sugar for promises..."
      },
      "finish_reason": "stop",
      "index": 0
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 150,
    "total_tokens": 170
  },
  "ragContext": "// File: async-utils.ts\nexport async function fetchData() {...}",
  "ragSources": [
    {
      "content": "export async function fetchData() {...}",
      "similarity": 0.92,
      "metadata": {
        "fileName": "async-utils.ts",
        "startLine": 10,
        "endLine": 20
      }
    }
  ],
  "metadata": {
    "workspaceId": "123",
    "workspaceDbId": 456,
    "processing_time_ms": 1250
  }
}
```

**Response Headers**:
- `X-Processing-Time`: 1250
- `X-Model`: gpt-4

**Errors**:
- `400 Bad Request` - Invalid messages array
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - AI service error

---

### Claude Code Chat

#### `POST /api/claude/chat`

Execute Claude Code CLI commands through web interface.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "message": "Create a REST API endpoint for user authentication",
  "workspaceId": "workspace-abc123",
  "contextFiles": ["src/auth.ts", "src/api/users.ts"]
}
```

**Parameters**:
- `message` (required): Command or question for Claude Code
- `workspaceId` (required): Target workspace ID
- `contextFiles` (optional): Files to include as context

**Example**:

```bash
curl -X POST 'http://localhost:3000/api/claude/chat' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: next-auth.session-token=...' \
  -d '{
    "message": "Refactor this component to use hooks",
    "workspaceId": "workspace-abc123",
    "contextFiles": ["src/components/UserList.tsx"]
  }'
```

**Response**: 200 OK

```json
{
  "success": true,
  "message": "I've refactored the UserList component to use React hooks...",
  "metadata": {
    "filesModified": ["src/components/UserList.tsx"],
    "executionTime": "3.2s"
  }
}
```

**Errors**:
- `400 Bad Request` - Missing required fields
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Claude CLI error

---

### Claude Code Generation

#### `POST /api/claude/generate`

Generate code using Claude AI.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "prompt": "Create a TypeScript interface for a User model",
  "workspaceId": "workspace-abc123",
  "language": "typescript"
}
```

---

### Claude Code Analysis

#### `POST /api/claude/analyze`

Analyze code for issues and improvements.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "code": "function getData() { return fetch('/api/data') }",
  "workspaceId": "workspace-abc123",
  "analysisType": "security"
}
```

---

### Claude Session Management

#### `GET/POST /api/claude/session`

Manage persistent Claude Code sessions.

**Authentication**: Required (session)

---

### AI Conversations

#### `GET /api/ai/conversations`

List AI conversation history.

**Authentication**: Required (session)

**Query Parameters**:
- `workspaceId` (optional): Filter by workspace
- `limit` (optional): Number of conversations (default: 20)

---

### AI Function Calling

#### `POST /api/ai/function-call`

Execute AI function calls with structured outputs.

**Authentication**: Required (session)

---

### AI Project Generation

#### `POST /api/ai/generate-project`

Generate complete project from description.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "description": "Create a todo app with React and Node.js",
  "features": ["authentication", "real-time updates"],
  "stack": {
    "frontend": "react",
    "backend": "nodejs",
    "database": "postgresql"
  }
}
```

---

### AI Model Selection

#### `GET /api/ai/model-selection`

Get available AI models and recommendations.

**Authentication**: Required (session)

**Response**: 200 OK

```json
{
  "models": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "capabilities": ["chat", "code"],
      "contextWindow": 8192,
      "costPer1kTokens": 0.03
    }
  ],
  "recommended": "gpt-4"
}
```

---

### AI Provider Health

#### `GET /api/ai/provider-health`

Check health status of AI providers.

**Authentication**: Required (session or monitoring token)

**Response**: 200 OK

```json
{
  "providers": [
    {
      "id": "openai",
      "status": "healthy",
      "latency": 250,
      "lastCheck": "2025-10-01T12:00:00.000Z"
    },
    {
      "id": "anthropic",
      "status": "healthy",
      "latency": 180,
      "lastCheck": "2025-10-01T12:00:00.000Z"
    }
  ]
}
```

---

### AI Document Upload

#### `POST /api/ai/upload`

Upload documents for AI processing.

**Authentication**: Required (session)

**Request**: multipart/form-data

```bash
curl -X POST 'http://localhost:3000/api/ai/upload' \
  -H 'Cookie: next-auth.session-token=...' \
  -F 'file=@document.pdf' \
  -F 'workspaceId=123'
```

---

### AI Web Search

#### `POST /api/ai/web-search`

Perform AI-powered web search.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "query": "latest React 19 features",
  "maxResults": 10
}
```

---

### AI Management

#### `GET /api/ai/management`

Administrative AI service management.

**Authentication**: Required (admin)

---

### LiteLLM Proxy

#### `POST /api/ai/litellm`

Direct LiteLLM proxy for unified AI provider access.

**Authentication**: Required (session)

---

### HuggingFace Integration

#### `POST /api/ai/huggingface-chat`

Chat using HuggingFace models.

**Authentication**: Required (session)

---

#### `POST /api/ai/huggingface-init`

Initialize HuggingFace model instance.

**Authentication**: Required (session)

---

### Chat Streaming

#### `POST /api/chat/stream`

Stream AI responses in real-time.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "messages": [
    {"role": "user", "content": "Explain microservices"}
  ],
  "stream": true
}
```

**Response**: 200 OK (text/event-stream)

```
data: {"choices":[{"delta":{"content":"Microservices"}}]}

data: {"choices":[{"delta":{"content":" are"}}]}

data: {"choices":[{"delta":{"content":" a"}}]}

data: [DONE]
```

---

### MongoDB Chat Integration

#### `POST /api/chat/mongodb`

Chat with MongoDB query assistance.

**Authentication**: Required (session)

---

#### `POST /api/chat/mongodb-simple`

Simplified MongoDB chat interface.

**Authentication**: Required (session)

---

## Code Server

### Create Code Server Session

#### `POST /api/code-server/session`

Create new code-server instance for workspace.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "workspaceId": "workspace-abc123",
  "projectPath": "/workspace",
  "userId": "1"
}
```

**Parameters**:
- `workspaceId` (required): Workspace ID (min 1 character)
- `projectPath` (optional): Project directory path (default: /workspace)
- `userId` (optional): User ID (defaults to session user)

**Example**:

```bash
curl -X POST 'http://localhost:3000/api/code-server/session' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: next-auth.session-token=...' \
  -d '{
    "workspaceId": "workspace-abc123"
  }'
```

**Response**: 200 OK

```json
{
  "id": "cs-1633024800-abc123",
  "url": "http://localhost:8080",
  "status": "starting",
  "workspaceId": "workspace-abc123",
  "userId": "1",
  "createdAt": "2025-10-01T12:00:00.000Z",
  "lastActivity": "2025-10-01T12:00:00.000Z"
}
```

**Status Values**:
- `starting`: Container initialization in progress
- `ready`: Code server accessible at URL
- `error`: Startup failed
- `stopped`: Session terminated

**Errors**:
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not workspace owner
- `500 Internal Server Error` - Container startup failed

---

### List Code Server Sessions

#### `GET /api/code-server/session`

List all active code-server sessions for user.

**Authentication**: Required (session)

**Query Parameters**:
- `workspaceId` (optional): Filter by workspace

**Example**:

```bash
curl -X GET 'http://localhost:3000/api/code-server/session?workspaceId=workspace-abc123' \
  -H 'Cookie: next-auth.session-token=...'
```

**Response**: 200 OK

```json
{
  "sessions": [
    {
      "id": "cs-1633024800-abc123",
      "url": "http://localhost:8080",
      "status": "ready",
      "workspaceId": "workspace-abc123",
      "userId": "1",
      "containerId": "code-server-workspace-abc123",
      "createdAt": "2025-10-01T12:00:00.000Z",
      "lastActivity": "2025-10-01T12:30:00.000Z"
    }
  ]
}
```

**Errors**:
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Query failed

---

## Terminal

### WebSocket Terminal Session

#### `GET /api/terminal/session`

Establish WebSocket connection for interactive terminal.

**Authentication**: Required (session)

**Query Parameters**:
- `workspaceId` (required): Workspace ID

**WebSocket Upgrade**:

```javascript
const ws = new WebSocket('ws://localhost:3000/api/terminal/session?workspaceId=workspace-abc123');

ws.onopen = () => {
  console.log('Terminal connected');
};

ws.onmessage = (event) => {
  console.log('Output:', event.data);
};

ws.send('ls -la\n');
```

**Terminal Environment**:

Secure environment with whitelisted variables only:

```
TERM=xterm-256color
COLORTERM=truecolor
HOME=/home/workspace
USER=workspace
PATH=/usr/local/bin:/usr/bin:/bin
LANG=en_US.UTF-8
LC_ALL=en_US.UTF-8
```

**Security Note**: Environment variables are strictly whitelisted. No secrets or sensitive data exposed.

**Errors**:
- `401 Unauthorized` - Not authenticated
- `426 Upgrade Required` - Not a WebSocket request
- `503 Service Unavailable` - node-pty not available

---

### Terminal WebSocket Endpoint

#### `POST /api/terminal/ws`

Alternative WebSocket terminal endpoint.

**Authentication**: Required (session)

---

## Projects & Templates

### Generate from Template

#### `POST /api/projects/template`

Generate new project from template.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "templateId": "nextjs-fullstack",
  "projectName": "my-new-app",
  "customizations": {
    "packageName": "@myorg/my-app",
    "description": "My awesome application",
    "author": "John Doe",
    "license": "MIT",
    "gitRepository": "https://github.com/myorg/my-app"
  },
  "features": ["authentication", "database", "api"],
  "envOverrides": {
    "DATABASE_URL": "postgresql://localhost/mydb"
  }
}
```

**Parameters**:
- `templateId` (required): Template identifier
- `projectName` (required): Project name (min 1 character)
- `customizations` (optional): Project metadata overrides
- `features` (optional): Additional features to include
- `envOverrides` (optional): Environment variable overrides

**Example**:

```bash
curl -X POST 'http://localhost:3000/api/projects/template' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: next-auth.session-token=...' \
  -d '{
    "templateId": "react-typescript",
    "projectName": "my-react-app",
    "features": ["routing", "state-management"]
  }'
```

**Response**: 200 OK

```json
{
  "success": true,
  "workspaceId": "template-react-typescript-1633024800-abc123",
  "workspaceUrl": "/workspace/template-react-typescript-1633024800-abc123",
  "projectStructure": {
    "name": "my-react-app",
    "description": "React application with TypeScript",
    "fileCount": 45,
    "templateId": "react-typescript",
    "templateName": "React + TypeScript",
    "language": ["TypeScript", "JavaScript"],
    "frameworks": ["React", "Vite"],
    "features": ["routing", "state-management"],
    "setupTime": "2-3 minutes"
  },
  "generationTime": 3500,
  "setupInstructions": [
    "Run npm install to install dependencies",
    "Copy .env.example to .env",
    "Run npm run dev to start development server"
  ],
  "envVars": [
    {
      "key": "VITE_API_URL",
      "value": "http://localhost:3000",
      "description": "API base URL"
    }
  ],
  "nextSteps": [
    "Navigate to /workspace/template-react-typescript-1633024800-abc123",
    "Review the generated project structure",
    "Follow the setup instructions in README.md",
    "Start development with the provided scripts"
  ]
}
```

**Errors**:
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Template not found
- `500 Internal Server Error` - Generation failed

---

### List Templates

#### `GET /api/projects/template`

Retrieve available project templates.

**Authentication**: None (public endpoint)

**Query Parameters**:
- `category` (optional): Filter by category - `fullstack`, `frontend`, `backend`, `mobile`
- `complexity` (optional): Filter by complexity - `beginner`, `intermediate`, `advanced`
- `language` (optional): Filter by programming language
- `framework` (optional): Filter by framework
- `search` (optional): Full-text search query

**Example**:

```bash
curl -X GET 'http://localhost:3000/api/projects/template?category=fullstack&complexity=intermediate&language=typescript'
```

**Response**: 200 OK

```json
{
  "templates": [
    {
      "id": "nextjs-fullstack",
      "name": "Next.js Full Stack",
      "description": "Modern full-stack application with Next.js, TypeScript, and PostgreSQL",
      "category": "fullstack",
      "complexity": "intermediate",
      "language": ["TypeScript", "JavaScript"],
      "frameworks": ["Next.js", "React", "Prisma"],
      "features": ["SSR", "API Routes", "Authentication", "Database"],
      "estimatedSetupTime": "5-10 minutes",
      "tags": ["modern", "production-ready", "typescript"],
      "dockerSupport": true,
      "kubernetesSupport": true,
      "testingSetup": true,
      "cicdTemplate": true,
      "monitoringSetup": true
    }
  ],
  "totalCount": 1,
  "filters": {
    "category": "fullstack",
    "complexity": "intermediate",
    "language": "typescript",
    "framework": null,
    "search": null
  }
}
```

**Errors**:
- `500 Internal Server Error` - Failed to retrieve templates

---

## Vector Store

**Note**: Vector store endpoints are currently disabled. All operations return unavailable status.

### Search Documents

#### `POST /api/vector-store`

Search documents using semantic similarity (currently disabled).

**Authentication**: Required (session)

**Request Body**:

```json
{
  "query": "authentication implementation",
  "workspaceId": 123,
  "fileIds": [1, 2, 3],
  "limit": 10,
  "threshold": 0.7,
  "provider": "auto",
  "searchType": "semantic",
  "generativePrompt": "Explain the authentication flow"
}
```

**Response**: 503 Service Unavailable

```json
{
  "status": "unavailable",
  "message": "Vector store temporarily unavailable"
}
```

---

### Store Documents

#### `PUT /api/vector-store`

Store documents in vector database (currently disabled).

**Authentication**: Required (session)

**Response**: 503 Service Unavailable

---

### Delete Documents

#### `DELETE /api/vector-store`

Delete documents from vector store (currently disabled).

**Authentication**: Required (session)

**Response**: 503 Service Unavailable

---

### Vector Store Health

#### `GET /api/vector-store`

Get vector store health status (currently disabled).

**Authentication**: Required (session)

**Response**: 503 Service Unavailable

---

## Health & Monitoring

### System Health

#### `GET /api/health`

Basic system health check.

**Authentication**: None (public endpoint)

**Example**:

```bash
curl -X GET 'http://localhost:3000/api/health'
```

**Response**: 200 OK

```json
{
  "status": "healthy",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "uptime": 86400,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "memory": {
      "status": "healthy",
      "details": {
        "used": 256,
        "total": 512,
        "external": 10,
        "rss": 300
      }
    },
    "disk": {
      "status": "healthy",
      "details": {
        "available": "unknown",
        "usage": "unknown"
      }
    },
    "database": {
      "status": "healthy"
    },
    "valkey": {
      "status": "healthy"
    },
    "ai": {
      "status": "healthy"
    }
  },
  "responseTime": "5ms",
  "performance": {
    "responseTime": 5,
    "memoryUsage": {
      "rss": 314572800,
      "heapTotal": 536870912,
      "heapUsed": 268435456,
      "external": 10485760
    }
  }
}
```

**Health Status Values**:
- `healthy`: All systems operational
- `warning`: Degraded performance
- `unhealthy`: Critical issues detected

**Errors**:
- `500 Internal Server Error` - Critical health check failure

---

### Database Health

#### `GET /api/health/database`

Database connection and performance health.

**Authentication**: None (public endpoint)

**Response**: 200 OK

```json
{
  "status": "healthy",
  "latency": 15,
  "connections": {
    "active": 5,
    "idle": 15,
    "total": 20
  }
}
```

---

#### `GET /api/health/database/metrics`

Detailed database metrics.

**Authentication**: Required (monitoring token)

---

### Database Connection

#### `GET /api/health/db`

Alternative database health endpoint.

**Authentication**: None (public endpoint)

---

### Vector Database Health

#### `GET /api/health/vector-db`

Vector database health status.

**Authentication**: None (public endpoint)

---

#### `GET /api/health/vector-metrics`

Vector database performance metrics.

**Authentication**: Required (monitoring token)

---

### Connection Pool Health

#### `GET /api/health/connection-pool`

Database connection pool status.

**Authentication**: Required (monitoring token)

---

### Simple Health Check

#### `GET /api/health/simple`

Minimal health check for load balancers.

**Authentication**: None (public endpoint)

**Response**: 200 OK

```json
{
  "status": "ok"
}
```

---

### Readiness Check

#### `GET /api/readyz`

Kubernetes readiness probe endpoint.

**Authentication**: None (public endpoint)

**Response**: 200 OK

```json
{
  "ready": true,
  "timestamp": "2025-10-01T12:00:00.000Z"
}
```

---

### Monitoring Metrics

#### `GET /api/monitoring/metrics`

Retrieve system and application metrics.

**Authentication**: Required (monitoring token)

**Example**:

```bash
curl -X GET 'http://localhost:3000/api/monitoring/metrics' \
  -H 'Authorization: Bearer YOUR_MONITORING_TOKEN'
```

**Response**: 200 OK

```json
{
  "cpu": {
    "usage": 45
  },
  "memory": {
    "used": 2048,
    "total": 4096,
    "percentage": 50
  },
  "diskUsage": {
    "used": 0,
    "total": 0
  },
  "networkIO": {
    "bytesIn": 1048576,
    "bytesOut": 524288
  },
  "activeUsers": 0,
  "activeWorkspaces": 0,
  "totalSessions": 0,
  "avgResponseTime": 250,
  "errorRate": 0.5,
  "uptime": 86400,
  "business": {
    "user_sessions": 342,
    "api_calls": 1523,
    "database_queries": 4201,
    "cache_hit_rate": 0.85
  }
}
```

**Errors**:
- `401 Unauthorized` - Invalid monitoring token
- `500 Internal Server Error` - Failed to fetch metrics

---

#### `POST /api/monitoring/metrics`

Submit custom metrics.

**Authentication**: Required (monitoring token)

**Request Body**:

```json
{
  "type": "response_time",
  "data": {
    "duration": 250
  }
}
```

**Metric Types**:
- `response_time`: API response time
- `error`: Error occurrence
- `user_activity`: User interaction
- `network_io`: Network traffic

**Example**:

```bash
curl -X POST 'http://localhost:3000/api/monitoring/metrics' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_MONITORING_TOKEN' \
  -d '{
    "type": "response_time",
    "data": {"duration": 250}
  }'
```

**Response**: 200 OK

```json
{
  "success": true
}
```

**Errors**:
- `400 Bad Request` - Invalid metric type or data
- `401 Unauthorized` - Invalid monitoring token
- `500 Internal Server Error` - Failed to update metrics

---

### Monitoring Dashboard

#### `GET /api/monitoring/dashboard`

Aggregated dashboard metrics.

**Authentication**: Required (monitoring token or session)

---

### Performance Monitoring

#### `GET /api/monitoring/performance`

Application performance metrics.

**Authentication**: Required (monitoring token)

---

### Cache Monitoring

#### `GET /api/monitoring/cache`

Cache performance and hit rates.

**Authentication**: Required (monitoring token)

---

### Connection Pool Monitoring

#### `GET /api/monitoring/connection-pool`

Database connection pool metrics.

**Authentication**: Required (monitoring token)

---

### Pool Alerts

#### `GET /api/monitoring/pool-alerts`

Connection pool alert status.

**Authentication**: Required (monitoring token)

---

### Embeddings Monitoring

#### `GET /api/monitoring/embeddings`

AI embeddings performance metrics.

**Authentication**: Required (monitoring token)

---

### Azure Embedding Monitoring

#### `GET /api/monitoring/azure-embedding`

Azure-specific embedding metrics.

**Authentication**: Required (monitoring token)

---

### Distributed Tracing

#### `GET /api/monitoring/traces`

Distributed trace data.

**Authentication**: Required (monitoring token)

---

### OpenTelemetry Configuration

#### `GET /api/monitoring/otel-config`

OpenTelemetry configuration details.

**Authentication**: Required (monitoring token)

---

### Real User Monitoring

#### `POST /api/monitoring/rum`

Submit real user monitoring data.

**Authentication**: None (public endpoint)

**Request Body**:

```json
{
  "pageView": "/dashboard",
  "loadTime": 1250,
  "userAgent": "Mozilla/5.0...",
  "errors": []
}
```

---

### Security Monitoring

#### `GET /api/monitoring/security`

Security event monitoring.

**Authentication**: Required (monitoring token or admin)

---

## Files & Documents

### File Sync

#### `POST /api/files/sync`

Synchronize files between workspace and storage.

**Authentication**: Required (session)

---

### Document Search

#### `GET /api/docs/search`

Search documentation and code comments.

**Authentication**: Required (session)

**Query Parameters**:
- `q` (required): Search query
- `workspaceId` (optional): Limit to workspace
- `type` (optional): Document type filter

---

### PDF Upload

#### `POST /api/uploads/pdf`

Upload and process PDF documents.

**Authentication**: Required (session)

**Request**: multipart/form-data

---

## User Management

### User Preferences

#### `GET /api/user/preferences`

Get user preferences and settings.

**Authentication**: Required (session)

**Response**: 200 OK

```json
{
  "theme": "dark",
  "language": "en",
  "notifications": {
    "email": true,
    "push": false
  },
  "editor": {
    "fontSize": 14,
    "tabSize": 2,
    "wordWrap": true
  }
}
```

---

#### `PUT /api/user/preferences`

Update user preferences.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "theme": "light",
  "editor": {
    "fontSize": 16
  }
}
```

---

## Experiments

### Feature Experiments

#### `GET /api/experiments`

List active feature experiments.

**Authentication**: Required (session)

**Response**: 200 OK

```json
{
  "experiments": [
    {
      "id": "new-editor-ui",
      "name": "New Editor UI",
      "description": "Redesigned code editor interface",
      "enabled": true,
      "percentage": 50
    }
  ]
}
```

---

#### `POST /api/experiments`

Enable/disable experiment for user.

**Authentication**: Required (session)

---

## Code Completion

### Code Suggestions

#### `POST /api/code-completion`

Get AI-powered code completions.

**Authentication**: Required (session)

**Request Body**:

```json
{
  "code": "function calculateTotal(items) {\n  ",
  "language": "javascript",
  "position": {
    "line": 1,
    "character": 2
  }
}
```

---

## Gradio Integration

### Run Gradio App

#### `POST /api/gradio/run`

Launch Gradio ML application.

**Authentication**: Required (session)

---

## Ollama Integration

### List Models

#### `GET /api/ollama/models`

List available Ollama models.

**Authentication**: Required (session)

**Response**: 200 OK

```json
{
  "models": [
    {
      "name": "llama2",
      "size": "3.8GB",
      "modified": "2025-10-01T10:00:00.000Z"
    }
  ]
}
```

---

## AI CLI Tools

### Install AI CLI Tool

#### `POST /api/ai-cli-tools/install`

Install AI-powered CLI tools in workspace.

**Authentication**: Required (session)

---

## Rate Limiting

Currently not enforced. Planned implementation:

- **Per-User**: 100 requests/minute
- **AI Endpoints**: Token-based limits
- **Workspace Operations**: 10 creations/hour

## Deprecation Policy

API endpoints follow deprecation process:

1. **Announcement**: 6 months notice
2. **Deprecation Headers**: `Sunset` header with date
3. **Migration Guide**: Alternative endpoints documented
4. **Support Period**: 12 months minimum

## Examples

### Complete Workflow Example

```bash
# 1. Authenticate (returns session cookie)
curl -X POST 'http://localhost:3000/api/auth/signin/credentials' \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com", "password": "secret"}' \
  -c cookies.txt

# 2. Create workspace
curl -X POST 'http://localhost:3000/api/workspace' \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"name": "My Project", "template": "nodejs"}'

# 3. Start code server
curl -X POST 'http://localhost:3000/api/code-server/session' \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"workspaceId": "workspace-abc123"}'

# 4. Chat with AI
curl -X POST 'http://localhost:3000/api/ai/chat' \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{
    "messages": [{"role": "user", "content": "Help me debug this error"}],
    "workspaceId": "123"
  }'

# 5. Generate code
curl -X POST 'http://localhost:3000/api/claude/generate' \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{
    "prompt": "Create a REST API handler",
    "workspaceId": "workspace-abc123"
  }'
```

## Support

For API support:
- **GitHub Issues**: https://github.com/your-org/vibecode-webgui/issues
- **Documentation**: https://docs.vibecode.dev
- **API Status**: https://status.vibecode.dev
