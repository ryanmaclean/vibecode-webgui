# Code Completion API Error Handling

This document describes the comprehensive error handling improvements made to the `/api/code-completion` endpoint.

## Overview

The code completion API route has been enhanced with enterprise-grade error handling, validation, rate limiting, and logging capabilities while maintaining backward compatibility with existing functionality.

## New Features

### ✅ Request Validation with Zod Schemas

- **File**: `src/lib/code-completion-validation.ts`
- **Features**:
  - Validates `text` field (1-10,000 characters)
  - Validates `position` object with positive line/column numbers
  - Supports optional fields: `language`, `filename`, `context`, `options`
  - Strict mode rejects unknown properties
  - Default values for optional fields (e.g., `language: 'typescript'`)

```typescript
// Example valid request
{
  "text": "const greeting = ",
  "position": { "lineNumber": 1, "column": 17 },
  "language": "typescript",
  "filename": "hello.ts"
}
```

### ✅ Rate Limiting

- **File**: `src/lib/code-completion-rate-limit.ts`  
- **Features**:
  - 10 requests per minute per IP address
  - Uses existing rate limiting infrastructure
  - Proper error responses with `retryAfter` values
  - Client IP detection behind proxies/load balancers

### ✅ Comprehensive Error Handling

- **File**: `src/lib/api-error-handler.ts`
- **Features**:
  - Centralized error handling with `ApiError` class
  - Structured error responses with error codes
  - Request ID generation for tracking
  - Contextual logging with IP, user agent, endpoint info
  - Timeout protection wrapper for async operations

### ✅ Error Codes and Response Format

All error responses follow this standardized format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE_ENUM",
  "timestamp": "2025-01-10T20:30:45.123Z", 
  "requestId": "req_1641844245123_abc123def",
  "details": { /* Additional context */ },
  "retryAfter": 60 /* For rate limits */
}
```

#### Supported Error Codes:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request format or parameters |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests from IP |
| `TIMEOUT_ERROR` | 408 | AI service took too long to respond |
| `AI_SERVICE_ERROR` | 502/503 | External AI service issues |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server errors |

### ✅ Timeout Protection

- 30-second timeout for AI completion requests
- Prevents hanging requests from slow AI services
- Returns `408 TIMEOUT_ERROR` with clear error message

### ✅ Enhanced Logging

All errors are logged with rich context:

```json
{
  "timestamp": "2025-01-10T20:30:45.123Z",
  "error": {
    "name": "ApiError",
    "message": "Request validation failed", 
    "code": "VALIDATION_ERROR",
    "statusCode": 400
  },
  "context": {
    "requestId": "req_123_abc",
    "ip": "192.168.1.100",
    "userAgent": "Monaco Editor",
    "endpoint": "/api/code-completion",
    "method": "POST"
  }
}
```

### ✅ Health Check Enhancements

The `GET /api/code-completion` endpoint now returns enhanced status:

```json
{
  "status": "ok",
  "provider": "openai",
  "model": "gpt-4-turbo-preview", 
  "timestamp": "2025-01-10T20:30:45.123Z",
  "version": "1.0.0",
  "rateLimits": {
    "codeCompletion": {
      "maxRequests": 10,
      "windowMs": 60000
    }
  }
}
```

## Testing

Comprehensive test suite in `tests/api/code-completion.test.ts` covers:

- ✅ Valid request handling
- ✅ Request validation edge cases
- ✅ Rate limiting enforcement  
- ✅ Timeout handling
- ✅ AI service error scenarios
- ✅ Error response format validation
- ✅ Health check functionality

## Usage Examples

### Valid Request

```bash
curl -X POST http://localhost:3000/api/code-completion \
  -H "Content-Type: application/json" \
  -d '{
    "text": "const greeting = ",
    "position": {"lineNumber": 1, "column": 17},
    "language": "typescript"
  }'
```

### Error Response Example

```bash
# Invalid request (missing text)
curl -X POST http://localhost:3000/api/code-completion \
  -H "Content-Type: application/json" \
  -d '{"position": {"lineNumber": 1, "column": 1}}'

# Response:
{
  "error": "Request validation failed",
  "code": "VALIDATION_ERROR",
  "timestamp": "2025-01-10T20:30:45.123Z",
  "requestId": "req_1641844245123_abc123def",
  "details": {
    "validationErrors": ["text: Required"]
  }
}
```

## Migration Notes

**✅ Backward Compatibility**: Existing valid requests continue to work unchanged.

**⚠️ Breaking Changes**:
- Invalid requests now return structured error responses instead of generic 400/500 errors
- Rate limiting is now enforced (10 requests/minute per IP)
- Unknown properties in request body are now rejected (strict validation)

## Monitoring and Debugging

- All errors are logged with request IDs for tracing
- Rate limit metrics are tracked per IP
- Timeout patterns can be monitored via error logs
- Health check endpoint provides service status

## Security Benefits

- **Input validation** prevents malformed requests
- **Rate limiting** prevents API abuse
- **Timeout protection** prevents resource exhaustion  
- **Error sanitization** prevents information leakage
- **Request tracking** enables audit trails

## Performance Impact

- Minimal overhead from validation (Zod is fast)
- Rate limiting uses efficient in-memory storage
- Timeout wrapper has negligible performance cost
- Structured logging provides better debugging with minimal impact