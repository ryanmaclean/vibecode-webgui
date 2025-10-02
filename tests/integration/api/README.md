# API Integration Tests

This directory contains integration tests for REST API endpoints.

## Directory Structure

```
tests/integration/api/
├── README.md                           # This file
├── health-endpoints.test.ts            # Health check endpoints (/api/health, /api/healthz, /api/readyz)
├── health-error-scenarios.test.ts      # Error handling and edge cases for health endpoints
└── health-response-formats.test.ts     # Response format validation for health endpoints
```

## Test Files

### health-endpoints.test.ts
Tests for the three health check endpoints:
- `/api/health` - Comprehensive health status with system metrics
- `/api/healthz` - Simple liveness check for Kubernetes
- `/api/readyz` - Readiness check for Kubernetes

**Coverage:**
- Response structure and data types
- Memory metrics validation
- Timestamp format validation (ISO 8601)
- Performance benchmarking
- Concurrent request handling
- Response time requirements (< 100ms for Kubernetes probes)

**Tests:** 27 tests covering all endpoints

### health-error-scenarios.test.ts
Tests error handling and edge cases for health check endpoints.

**Coverage:**
- Memory pressure detection and warnings
- Timestamp collision prevention
- Missing environment variables
- Process lifecycle consistency
- Concurrent load testing (burst traffic)
- JSON serialization validation
- Kubernetes probe compatibility
- Memory leak detection

**Tests:** Comprehensive error scenario coverage

### health-response-formats.test.ts
Validates the response format and API contract compliance.

**Coverage:**
- Schema structure validation
- RFC 3339 / ISO 8601 timestamp compliance
- Numeric field validation (non-negative, reasonable ranges)
- String field validation (non-empty, no whitespace-only)
- API contract consistency
- Content-type headers
- Semantic versioning format
- Memory metrics unit consistency

**Tests:** Full response format validation

## Running Tests

### Run all API integration tests
```bash
npm run test:integration -- --testPathPatterns="tests/integration/api"
```

### Run specific test file
```bash
npx jest tests/integration/api/health-endpoints.test.ts
```

### Run with coverage
```bash
npm run test:coverage -- --testPathPatterns="tests/integration/api"
```

### Run with verbose output
```bash
npx jest tests/integration/api/health-endpoints.test.ts --verbose
```

## Test Coverage Summary

| Endpoint | Tests | Coverage |
|----------|-------|----------|
| /api/health | 10 | Response structure, metrics, performance |
| /api/healthz | 6 | Liveness probe requirements |
| /api/readyz | 6 | Readiness probe requirements |
| Error Handling | 1 | Graceful degradation |
| Performance | 1 | Benchmarking all endpoints |
| Comparison | 3 | Cross-endpoint validation |

**Total: 27 tests**

## Next Endpoints to Test

### High Priority
1. `/api/auth/*` - Authentication endpoints
   - Login, logout, session management
   - Token validation
   - Error scenarios

2. `/api/workspace/*` - Workspace management
   - Create, read, update, delete operations
   - Permission validation
   - Concurrent access handling

3. `/api/ai/*` - AI service endpoints
   - Chat completions
   - Streaming responses
   - Model selection
   - Error handling

### Medium Priority
4. `/api/monitoring/*` - Monitoring and metrics endpoints
   - Dashboard data
   - Metrics collection
   - Performance data

5. `/api/files/*` - File operations
   - Upload, download, list
   - Permission checks
   - Large file handling

### Lower Priority
6. `/api/collaboration/*` - Collaboration features
   - Real-time updates
   - Conflict resolution
   - User presence

## Test Quality Standards

### All tests should:
- Be deterministic (no flaky tests)
- Clean up after themselves
- Not depend on external services (mock when needed)
- Include clear assertions with descriptive error messages
- Test both success and failure scenarios
- Validate response structure and data types
- Check edge cases and boundary conditions
- Include performance expectations where relevant

### Performance Standards
- Health endpoints: < 100ms response time
- API endpoints: < 500ms for standard operations
- Concurrent requests: Handle 50+ simultaneous requests
- No memory leaks over 100 iterations

## Known Issues

### Response Consumption
Note: In Jest tests, `response.json()` can only be called once per Response object. The body stream is consumed after the first call. Tests should store the parsed data if it needs to be used multiple times.

**Bad:**
```typescript
const response = await healthHandler();
const data1 = await response.json(); // Works
const data2 = await response.json(); // Returns undefined
```

**Good:**
```typescript
const response = await healthHandler();
const data = await response.json();
// Use `data` multiple times
expect(data.status).toBe('healthy');
expect(data.timestamp).toBeDefined();
```

## Contributing

When adding new API integration tests:

1. Create test file in `tests/integration/api/`
2. Follow naming convention: `{feature}-{type}.test.ts`
3. Add comprehensive test coverage
4. Update this README with test counts and coverage
5. Ensure tests pass: `npm run test:integration`
6. Add to CI/CD pipeline if needed

## Contact

For questions or issues with these tests, please create a GitHub issue with the label `testing`.
