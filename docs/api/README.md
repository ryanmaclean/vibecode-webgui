# VibeCode WebGUI API Documentation

## Overview

The VibeCode WebGUI API provides a comprehensive REST API for managing cloud-based development workspaces, AI-powered coding assistance, and collaborative development features. Built on Next.js 14 with TypeScript, the API follows RESTful conventions and returns JSON responses.

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## API Architecture

### Technology Stack

- **Framework**: Next.js 14 App Router
- **Runtime**: Node.js with Edge Runtime support
- **Validation**: Zod schemas for request/response validation
- **Authentication**: NextAuth.js (JWT-based sessions)
- **Database**: PostgreSQL with Prisma ORM
- **Vector Store**: PostgreSQL pgvector (currently disabled)
- **Monitoring**: Datadog APM and RUM
- **Observability**: OpenTelemetry integration

### API Design Principles

- RESTful resource-oriented architecture
- JSON request and response bodies
- Standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Consistent error response format
- Correlation IDs for request tracking
- Comprehensive logging with structured logs

## Authentication

### Overview

VibeCode uses NextAuth.js for authentication with support for multiple providers and multi-factor authentication.

### Authentication Methods

1. **OAuth Providers**: Google, GitHub, Azure AD
2. **SAML SSO**: Enterprise single sign-on
3. **Credentials**: Email/password authentication
4. **MFA**: TOTP, SMS, and email-based 2FA

### Session Management

Sessions are managed using JWT tokens with the following characteristics:

- **Token Type**: JWT (signed and encrypted)
- **Storage**: HTTP-only cookies
- **Duration**: 30 days (default)
- **Refresh**: Automatic on active use

### Authentication Header

For API requests, include the session cookie automatically set by the browser:

```bash
curl -X POST https://api.example.com/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

### Testing Bypass (Development Only)

For automated testing, set environment variable:

```bash
ALLOW_UNAUTHENTICATED_AI_TESTS=true
```

This bypasses authentication checks for specific endpoints during test execution.

## Authorization

### User Context

All authenticated endpoints verify the user session and extract:

- **User ID**: Unique identifier for the user
- **Email**: User's email address
- **Roles**: User permissions and roles (if applicable)

### Resource Ownership

API endpoints enforce ownership checks:

- Users can only access their own workspaces
- AI sessions are scoped to the requesting user
- Administrative endpoints require elevated permissions

### Monitoring Endpoints

Monitoring endpoints use token-based authentication:

```bash
curl -X GET https://api.example.com/api/monitoring/metrics \
  -H "Authorization: Bearer YOUR_MONITORING_TOKEN"
```

Set `MONITORING_SECRET` environment variable for monitoring authentication.

## Request Format

### Content Type

All POST, PUT, and PATCH requests must include:

```
Content-Type: application/json
```

### Request Body Validation

Request bodies are validated using Zod schemas. Invalid requests return `400 Bad Request` with details:

```json
{
  "error": "Invalid request parameters",
  "details": [
    {
      "field": "workspaceId",
      "message": "Required"
    }
  ]
}
```

### Query Parameters

GET endpoints support filtering and pagination via query parameters:

```
GET /api/projects/template?category=fullstack&complexity=intermediate&limit=20
```

## Response Format

### Success Response

Successful requests return appropriate HTTP status codes with JSON bodies:

```json
{
  "success": true,
  "data": {
    "id": "workspace-123",
    "status": "ready"
  },
  "message": "Workspace created successfully",
  "timestamp": "2025-10-01T12:00:00.000Z"
}
```

### Standard Response Fields

- **success**: Boolean indicating operation success
- **data**: Response payload (varies by endpoint)
- **message**: Human-readable success message
- **timestamp**: ISO 8601 timestamp
- **metadata**: Additional context (optional)

### Response Headers

Responses may include custom headers:

- `X-Processing-Time`: Request processing duration in milliseconds
- `X-Model`: AI model used for generation (AI endpoints)
- `X-Request-Id`: Correlation ID for request tracking

## Error Handling

### Error Response Format

All errors return consistent JSON structure:

```json
{
  "error": "Brief error description",
  "message": "Detailed error message",
  "details": "Additional error context (optional)",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "status": 400
}
```

### HTTP Status Codes

| Status Code | Description | Common Causes |
|------------|-------------|---------------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST creation |
| 400 | Bad Request | Invalid request parameters, validation errors |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Resource already exists |
| 422 | Unprocessable Entity | Business logic validation failure |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Service dependency unavailable |

### Error Categories

#### Validation Errors (400)

```json
{
  "error": "Invalid request parameters",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

#### Authentication Errors (401)

```json
{
  "error": "Unauthorized",
  "message": "Please sign in to access this resource"
}
```

#### Permission Errors (403)

```json
{
  "error": "Forbidden",
  "message": "You do not have permission to access this workspace"
}
```

#### Resource Not Found (404)

```json
{
  "error": "Workspace not found",
  "message": "No workspace exists with ID: workspace-123"
}
```

#### Server Errors (500)

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred",
  "timestamp": "2025-10-01T12:00:00.000Z"
}
```

## Rate Limiting

### Current Implementation

Rate limiting is not currently enforced at the API level. Future implementation will include:

- **Per-User Limits**: 100 requests per minute per user
- **Per-IP Limits**: 1000 requests per minute per IP
- **AI Endpoints**: Specialized limits based on token usage
- **Workspace Operations**: 10 creations per hour per user

### Rate Limit Headers (Planned)

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1633024800
```

## CORS Configuration

### Allowed Origins

CORS is configured for API endpoints with:

- **Allowed Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS
- **Allowed Headers**: Content-Type, Authorization, Cookie
- **Credentials**: Allowed (for session cookies)
- **Max Age**: 86400 seconds (24 hours)

### Preflight Requests

All endpoints support OPTIONS method for CORS preflight:

```bash
curl -X OPTIONS https://api.example.com/api/ai/chat \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST"
```

## Pagination

### Query Parameters

List endpoints support pagination:

```
GET /api/workspaces?page=1&limit=20&sort=createdAt&order=desc
```

- **page**: Page number (default: 1)
- **limit**: Items per page (default: 20, max: 100)
- **sort**: Sort field
- **order**: Sort direction (asc, desc)

### Response Format

Paginated responses include metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

## Filtering and Search

### Query Parameters

```
GET /api/projects/template?category=fullstack&language=typescript&search=react
```

### Supported Operators

- **Equality**: `field=value`
- **Multiple Values**: `field=value1,value2` (OR)
- **Text Search**: `search=query` (full-text search)
- **Range**: `min=value&max=value` (numeric ranges)

## Webhooks (Planned)

Future webhook support for event notifications:

- Workspace status changes
- AI task completion
- Deployment events
- Error notifications

## Monitoring and Observability

### Request Tracing

All requests include correlation IDs for distributed tracing:

- **Datadog Trace ID**: Automatic trace correlation
- **Span ID**: Individual operation tracking
- **Request ID**: Unique identifier per request

### Performance Metrics

API endpoints report:

- Response time percentiles (p50, p95, p99)
- Error rates by endpoint and status code
- Request volume and throughput
- Database query performance

### Logging

Structured JSON logs with:

```json
{
  "message": "[AI_CHAT] chat_request",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "service": "vibecode-webgui",
  "source": "ai-chat-api",
  "level": "info",
  "event_type": "chat_request",
  "http": {
    "url": "/api/ai/chat",
    "method": "POST",
    "user_agent": "Mozilla/5.0..."
  },
  "ai": {
    "model": "gpt-4",
    "message_count": 3
  }
}
```

## Security Considerations

### Input Validation

- All inputs validated with Zod schemas
- SQL injection prevention via Prisma ORM
- XSS protection with output encoding
- CSRF protection via NextAuth.js

### Secrets Management

- Environment variables for sensitive data
- No secrets in response bodies
- Secrets filtered from logs
- Secure session storage

### Command Injection Prevention

Terminal endpoints implement strict environment variable whitelisting:

```typescript
// Only safe variables passed to spawned processes
const allowedEnv = {
  TERM: 'xterm-256color',
  HOME: '/home/workspace',
  PATH: '/usr/local/bin:/usr/bin:/bin'
}
```

### Rate Limiting (Planned)

- DDoS protection
- Brute force prevention
- Resource exhaustion mitigation

## API Versioning

### Current Version

API is currently unversioned (`/api/*`). Future versioning will use:

```
/api/v1/*
/api/v2/*
```

### Deprecation Policy

- 6-month deprecation notice
- Version support for 12 months
- Migration guides provided

## Client Libraries

### Official SDKs (Planned)

- TypeScript/JavaScript
- Python
- Go

### Community SDKs

Community contributions welcome.

## Support and Resources

- **GitHub Issues**: https://github.com/your-org/vibecode-webgui/issues
- **Documentation**: https://docs.vibecode.dev
- **API Status**: https://status.vibecode.dev

## Changelog

### 2025-10-01

- Initial API documentation
- 74 endpoints documented
- Security hardening for terminal endpoints
- Configuration migration to central system

## Next Steps

See [ENDPOINTS.md](./ENDPOINTS.md) for detailed endpoint reference with:

- Request/response schemas
- Example requests with curl
- Authentication requirements
- Error codes and handling
