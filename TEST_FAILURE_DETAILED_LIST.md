# Complete List of Failed Tests

**Total Failed Test Files:** 30

**Generated:** 2026-01-15

---


## src/lib/__tests__/auth.test.ts
**Failures:** 2

1. auth.ts Configuration › Credentials Provider Authorization › should authorize valid credentials
2. auth.ts Configuration › Credentials Provider Authorization › should authorize valid credentials

---

## tests/api/auth-csrf.test.ts
**Failures:** 2

1. CSRF Token API › GET /api/auth/csrf › should set secure HTTP-only cookie
2. CSRF Token API › GET /api/auth/csrf › should set secure HTTP-only cookie

---

## tests/integration/agents/agents-api.test.ts
**Failures:** 2

1. Agents API Integration › File Operations › uploads a file
2. Agents API Integration › File Operations › uploads a file

---

## tests/integration/datadog-real.test.ts
**Failures:** 2

1. Datadog Integration Tests › Health Check Integration › should validate health check endpoint with real Datadog API
2. Datadog Integration Tests › Health Check Integration › should validate health check endpoint with real Datadog API

---

## tests/integration/feature-flag-persistence.test.ts
**Failures:** 4

1. Feature Flag Persistence (Real Database) › API Integration with Real Database › should persist feature flags through API calls
2. Feature Flag Persistence (Real Database) › API Integration with Real Database › should handle feature flag evaluation with database lookup
3. Feature Flag Persistence (Real Database) › API Integration with Real Database › should persist feature flags through API calls
4. Feature Flag Persistence (Real Database) › API Integration with Real Database › should handle feature flag evaluation with database lookup

---

## tests/integration/litellm-integration.test.ts
**Failures:** 8

1. LiteLLM Integration Tests › API Routes Integration › GET endpoints › should return service information
2. LiteLLM Integration Tests › API Routes Integration › GET endpoints › should handle health check with auth
3. LiteLLM Integration Tests › API Routes Integration › POST endpoints › should handle chat completion requests
4. LiteLLM Integration Tests › API Routes Integration › POST endpoints › should handle embedding requests
5. LiteLLM Integration Tests › API Routes Integration › GET endpoints › should return service information
6. LiteLLM Integration Tests › API Routes Integration › GET endpoints › should handle health check with auth
7. LiteLLM Integration Tests › API Routes Integration › POST endpoints › should handle chat completion requests
8. LiteLLM Integration Tests › API Routes Integration › POST endpoints › should handle embedding requests

---

## tests/integration/real-database-operations.test.ts
**Failures:** 2

1. Database Health Check Validation › should return actual database status
2. Database Health Check Validation › should return actual database status

---

## tests/integration/real-monitoring-integration.test.ts
**Failures:** 4

1. Monitoring Integration Tests › should validate health check endpoint returns status
2. Monitoring Integration Tests › should validate monitoring metrics endpoint returns real data
3. Monitoring Integration Tests › should validate health check endpoint returns status
4. Monitoring Integration Tests › should validate monitoring metrics endpoint returns real data

---

## tests/lib/api/validation/helpers.test.ts
**Failures:** 2

1. api/validation/helpers › checkRateLimit › should use default values
2. api/validation/helpers › checkRateLimit › should use default values

---

## tests/lib/security/csrf.test.ts
**Failures:** 10

1. CSRF Protection › getCSRFToken › should set httpOnly flag on cookie
2. CSRF Protection › getCSRFToken › should set secure flag in production
3. CSRF Protection › getCSRFToken › should set sameSite to strict
4. CSRF Protection › getCSRFToken › should set cookie path to root
5. CSRF Protection › getCSRFToken › should set cookie maxAge to 24 hours
6. CSRF Protection › getCSRFToken › should set httpOnly flag on cookie
7. CSRF Protection › getCSRFToken › should set secure flag in production
8. CSRF Protection › getCSRFToken › should set sameSite to strict
9. CSRF Protection › getCSRFToken › should set cookie path to root
10. CSRF Protection › getCSRFToken › should set cookie maxAge to 24 hours

---

## tests/monitoring/alert-validation.test.ts
**Failures:** 22

1. Monitoring Alert Validation › Health Check Alerts › should have health check endpoint with proper alertable metrics
2. Monitoring Alert Validation › Health Check Alerts › should provide component-specific health status
3. Monitoring Alert Validation › Health Check Alerts › should detect unhealthy state transitions
4. Monitoring Alert Validation › Performance Metrics Alerts › should provide alertable performance metrics
5. Monitoring Alert Validation › Performance Metrics Alerts › should track request volume for traffic alerts
6. Monitoring Alert Validation › Performance Metrics Alerts › should provide metrics with proper timestamps for time-based alerts
7. Monitoring Alert Validation › Resource Exhaustion Alerts › should detect memory pressure patterns
8. Monitoring Alert Validation › Resource Exhaustion Alerts › should monitor connection pool health
9. Monitoring Alert Validation › Business Logic Alerts › should track user activity for business alerts
10. Monitoring Alert Validation › Alert Configuration Validation › should have consistent metric collection intervals
11. Monitoring Alert Validation › Alert Configuration Validation › should provide alert-friendly metric formats
12. Monitoring Alert Validation › Health Check Alerts › should have health check endpoint with proper alertable metrics
13. Monitoring Alert Validation › Health Check Alerts › should provide component-specific health status
14. Monitoring Alert Validation › Health Check Alerts › should detect unhealthy state transitions
15. Monitoring Alert Validation › Performance Metrics Alerts › should provide alertable performance metrics
16. Monitoring Alert Validation › Performance Metrics Alerts › should track request volume for traffic alerts
17. Monitoring Alert Validation › Performance Metrics Alerts › should provide metrics with proper timestamps for time-based alerts
18. Monitoring Alert Validation › Resource Exhaustion Alerts › should detect memory pressure patterns
19. Monitoring Alert Validation › Resource Exhaustion Alerts › should monitor connection pool health
20. Monitoring Alert Validation › Business Logic Alerts › should track user activity for business alerts
21. Monitoring Alert Validation › Alert Configuration Validation › should have consistent metric collection intervals
22. Monitoring Alert Validation › Alert Configuration Validation › should provide alert-friendly metric formats

---

## tests/performance/ai-project-generation-performance.test.ts
**Failures:** 2

1. AI Project Generation Performance › Progress Callback Performance › should not significantly slow down generation with progress callbacks
2. AI Project Generation Performance › Progress Callback Performance › should not significantly slow down generation with progress callbacks

---

## tests/performance/load-testing.test.ts
**Failures:** 20

1. Load Testing - Production Scenarios › Baseline Performance › should handle single request efficiently
2. Load Testing - Production Scenarios › Baseline Performance › should handle metrics request efficiently
3. Load Testing - Production Scenarios › Concurrent User Load › should handle 50 concurrent health check requests
4. Load Testing - Production Scenarios › Concurrent User Load › should handle 100 concurrent metrics requests
5. Load Testing - Production Scenarios › Concurrent User Load › should handle mixed endpoint load
6. Load Testing - Production Scenarios › Sustained Load Testing › should handle burst traffic patterns
7. Load Testing - Production Scenarios › Memory and Resource Usage › should not have memory leaks under continuous load
8. Load Testing - Production Scenarios › Real-World Traffic Patterns › should handle typical API usage pattern
9. Load Testing - Production Scenarios › Real-World Traffic Patterns › should handle API rate limiting gracefully
10. Load Testing - Production Scenarios › Database Load Testing › should handle concurrent database operations
11. Load Testing - Production Scenarios › Baseline Performance › should handle single request efficiently
12. Load Testing - Production Scenarios › Baseline Performance › should handle metrics request efficiently
13. Load Testing - Production Scenarios › Concurrent User Load › should handle 50 concurrent health check requests
14. Load Testing - Production Scenarios › Concurrent User Load › should handle 100 concurrent metrics requests
15. Load Testing - Production Scenarios › Concurrent User Load › should handle mixed endpoint load
16. Load Testing - Production Scenarios › Sustained Load Testing › should handle burst traffic patterns
17. Load Testing - Production Scenarios › Memory and Resource Usage › should not have memory leaks under continuous load
18. Load Testing - Production Scenarios › Real-World Traffic Patterns › should handle typical API usage pattern
19. Load Testing - Production Scenarios › Real-World Traffic Patterns › should handle API rate limiting gracefully
20. Load Testing - Production Scenarios › Database Load Testing › should handle concurrent database operations

---

## tests/performance/system-metrics-validation.test.ts
**Failures:** 20

1. System Metrics Performance Validation › Real Metrics Validation › should return consistent CPU measurements over time
2. System Metrics Performance Validation › Real Metrics Validation › should return realistic disk usage that doesn't change rapidly
3. System Metrics Performance Validation › Real Metrics Validation › should return real memory usage from system
4. System Metrics Performance Validation › Real Metrics Validation › should have network metrics that accumulate over time
5. System Metrics Performance Validation › Performance Under Load › should handle concurrent metric requests efficiently
6. System Metrics Performance Validation › Performance Under Load › should not have memory leaks during repeated requests
7. System Metrics Performance Validation › Health Check Performance › should respond to health checks quickly
8. System Metrics Performance Validation › Health Check Performance › should validate database health check performance
9. System Metrics Performance Validation › Resource Usage Monitoring › should track active users realistically
10. System Metrics Performance Validation › Resource Usage Monitoring › should track workspace usage appropriately
11. System Metrics Performance Validation › Real Metrics Validation › should return consistent CPU measurements over time
12. System Metrics Performance Validation › Real Metrics Validation › should return realistic disk usage that doesn't change rapidly
13. System Metrics Performance Validation › Real Metrics Validation › should return real memory usage from system
14. System Metrics Performance Validation › Real Metrics Validation › should have network metrics that accumulate over time
15. System Metrics Performance Validation › Performance Under Load › should handle concurrent metric requests efficiently
16. System Metrics Performance Validation › Performance Under Load › should not have memory leaks during repeated requests
17. System Metrics Performance Validation › Health Check Performance › should respond to health checks quickly
18. System Metrics Performance Validation › Health Check Performance › should validate database health check performance
19. System Metrics Performance Validation › Resource Usage Monitoring › should track active users realistically
20. System Metrics Performance Validation › Resource Usage Monitoring › should track workspace usage appropriately

---

## tests/security/penetration-testing.test.ts
**Failures:** 36

1. Security Penetration Testing › Input Validation & Injection Attacks › should prevent SQL injection in query parameters
2. Security Penetration Testing › Input Validation & Injection Attacks › should prevent NoSQL injection attempts
3. Security Penetration Testing › Input Validation & Injection Attacks › should prevent XSS through input sanitization
4. Security Penetration Testing › Input Validation & Injection Attacks › should validate input length limits
5. Security Penetration Testing › Authentication & Authorization › should handle missing authentication gracefully
6. Security Penetration Testing › Authentication & Authorization › should reject invalid authentication tokens
7. Security Penetration Testing › Authentication & Authorization › should prevent privilege escalation
8. Security Penetration Testing › HTTP Security Headers › should include security headers
9. Security Penetration Testing › HTTP Security Headers › should prevent MIME type sniffing
10. Security Penetration Testing › HTTP Security Headers › should have appropriate CORS settings
11. Security Penetration Testing › Information Disclosure › should not expose sensitive information in error responses
12. Security Penetration Testing › Information Disclosure › should not expose system information
13. Security Penetration Testing › Information Disclosure › should not expose debug information
14. Security Penetration Testing › Rate Limiting & DoS Protection › should handle rapid successive requests
15. Security Penetration Testing › Rate Limiting & DoS Protection › should handle large payloads appropriately
16. Security Penetration Testing › API Security › should validate Content-Type headers
17. Security Penetration Testing › API Security › should handle malformed JSON gracefully
18. Security Penetration Testing › Session & Cookie Security › should have secure cookie attributes
19. Security Penetration Testing › Input Validation & Injection Attacks › should prevent SQL injection in query parameters
20. Security Penetration Testing › Input Validation & Injection Attacks › should prevent NoSQL injection attempts
21. Security Penetration Testing › Input Validation & Injection Attacks › should prevent XSS through input sanitization
22. Security Penetration Testing › Input Validation & Injection Attacks › should validate input length limits
23. Security Penetration Testing › Authentication & Authorization › should handle missing authentication gracefully
24. Security Penetration Testing › Authentication & Authorization › should reject invalid authentication tokens
25. Security Penetration Testing › Authentication & Authorization › should prevent privilege escalation
26. Security Penetration Testing › HTTP Security Headers › should include security headers
27. Security Penetration Testing › HTTP Security Headers › should prevent MIME type sniffing
28. Security Penetration Testing › HTTP Security Headers › should have appropriate CORS settings
29. Security Penetration Testing › Information Disclosure › should not expose sensitive information in error responses
30. Security Penetration Testing › Information Disclosure › should not expose system information
31. Security Penetration Testing › Information Disclosure › should not expose debug information
32. Security Penetration Testing › Rate Limiting & DoS Protection › should handle rapid successive requests
33. Security Penetration Testing › Rate Limiting & DoS Protection › should handle large payloads appropriately
34. Security Penetration Testing › API Security › should validate Content-Type headers
35. Security Penetration Testing › API Security › should handle malformed JSON gracefully
36. Security Penetration Testing › Session & Cookie Security › should have secure cookie attributes

---

## tests/unit/ai-project-generator.test.tsx
**Failures:** 2

1. AIProjectGenerator Component › renders the component with title and description
2. AIProjectGenerator Component › renders the component with title and description

---

## tests/unit/ai/ai-code-review.test.tsx
**Failures:** 2

1. AICodeReview › shows security review content
2. AICodeReview › shows security review content

---

## tests/unit/app/api/auth/csrf/route.test.ts
**Failures:** 10

1. /api/auth/csrf › GET /api/auth/csrf › should set CSRF token cookie with httpOnly flag
2. /api/auth/csrf › GET /api/auth/csrf › should set secure flag in production
3. /api/auth/csrf › GET /api/auth/csrf › should set SameSite=Strict
4. /api/auth/csrf › GET /api/auth/csrf › should set cookie path to /
5. /api/auth/csrf › GET /api/auth/csrf › should set Max-Age to 1 hour
6. /api/auth/csrf › GET /api/auth/csrf › should set CSRF token cookie with httpOnly flag
7. /api/auth/csrf › GET /api/auth/csrf › should set secure flag in production
8. /api/auth/csrf › GET /api/auth/csrf › should set SameSite=Strict
9. /api/auth/csrf › GET /api/auth/csrf › should set cookie path to /
10. /api/auth/csrf › GET /api/auth/csrf › should set Max-Age to 1 hour

---

## tests/unit/app/api/health/route.test.ts
**Failures:** 2

1. /api/health › GET /api/health › should return healthy status with basic information
2. /api/health › GET /api/health › should return healthy status with basic information

---

## tests/unit/components/ProjectGenerator.test.tsx
**Failures:** 2

1. ProjectGenerator › shows error state when generation fails
2. ProjectGenerator › shows error state when generation fails

---

## tests/unit/hooks/useAuth.test.ts
**Failures:** 2

1. useAuth › Authentication State › should provide OAuth providers
2. useAuth › Authentication State › should provide OAuth providers

---

## tests/unit/lib/auth.test.ts
**Failures:** 40

1. auth.ts Configuration › Configuration Structure › should have required configuration properties
2. auth.ts Configuration › Configuration Structure › should have correct page configurations
3. auth.ts Configuration › Configuration Structure › should have debug enabled in development
4. auth.ts Configuration › Providers Configuration › should have three providers configured
5. auth.ts Configuration › Providers Configuration › should have GitHub provider configured
6. auth.ts Configuration › Providers Configuration › should have Google provider configured
7. auth.ts Configuration › JWT Callback › should update token with user data on first login
8. auth.ts Configuration › JWT Callback › should preserve existing token data on subsequent calls
9. auth.ts Configuration › JWT Callback › should handle Google OAuth provider
10. auth.ts Configuration › Session Callback › should update session with token data
11. auth.ts Configuration › Session Callback › should preserve session data when no token
12. auth.ts Configuration › SignIn Callback › should allow all sign-ins
13. auth.ts Configuration › Redirect Callback › should handle relative URLs
14. auth.ts Configuration › Redirect Callback › should handle same-origin URLs
15. auth.ts Configuration › Redirect Callback › should fallback to baseUrl for external URLs
16. auth.ts Configuration › Events › should have signIn event handler
17. auth.ts Configuration › Events › should have signOut event handler
18. auth.ts Configuration › Events › should log signIn events
19. auth.ts Configuration › Events › should log signOut events
20. auth.ts Configuration › Type Safety › should have correct callback types
21. auth.ts Configuration › Configuration Structure › should have required configuration properties
22. auth.ts Configuration › Configuration Structure › should have correct page configurations
23. auth.ts Configuration › Configuration Structure › should have debug enabled in development
24. auth.ts Configuration › Providers Configuration › should have three providers configured
25. auth.ts Configuration › Providers Configuration › should have GitHub provider configured
26. auth.ts Configuration › Providers Configuration › should have Google provider configured
27. auth.ts Configuration › JWT Callback › should update token with user data on first login
28. auth.ts Configuration › JWT Callback › should preserve existing token data on subsequent calls
29. auth.ts Configuration › JWT Callback › should handle Google OAuth provider
30. auth.ts Configuration › Session Callback › should update session with token data
31. auth.ts Configuration › Session Callback › should preserve session data when no token
32. auth.ts Configuration › SignIn Callback › should allow all sign-ins
33. auth.ts Configuration › Redirect Callback › should handle relative URLs
34. auth.ts Configuration › Redirect Callback › should handle same-origin URLs
35. auth.ts Configuration › Redirect Callback › should fallback to baseUrl for external URLs
36. auth.ts Configuration › Events › should have signIn event handler
37. auth.ts Configuration › Events › should have signOut event handler
38. auth.ts Configuration › Events › should log signIn events
39. auth.ts Configuration › Events › should log signOut events
40. auth.ts Configuration › Type Safety › should have correct callback types

---

## tests/unit/lib/logger.test.ts
**Failures:** 86

1. Logger Utility › Log Levels › should log info messages
2. Logger Utility › Log Levels › should log info messages with metadata
3. Logger Utility › Log Levels › should log warn messages
4. Logger Utility › Log Levels › should log warn messages with metadata
5. Logger Utility › Log Levels › should log error messages
6. Logger Utility › Log Levels › should log error messages with error object
7. Logger Utility › Log Levels › should log error messages with stack trace
8. Logger Utility › Log Levels › should log debug messages
9. Logger Utility › Log Levels › should log debug messages with metadata
10. Logger Utility › Log Levels › should log http messages
11. Logger Utility › Log Levels › should log http messages with request details
12. Logger Utility › Child Logger › should create child logger with metadata
13. Logger Utility › Child Logger › should create child logger for specific module
14. Logger Utility › Child Logger › should create child logger with multiple context fields
15. Logger Utility › Child Logger › should create child logger with nested metadata
16. Logger Utility › Helper Functions › logPerformance › should log performance metrics
17. Logger Utility › Helper Functions › logPerformance › should log performance metrics with additional metadata
18. Logger Utility › Helper Functions › logPerformance › should handle zero duration
19. Logger Utility › Helper Functions › logPerformance › should handle large durations
20. Logger Utility › Helper Functions › logPerformance › should handle fractional milliseconds
21. Logger Utility › Helper Functions › logApiRequest › should log API requests
22. Logger Utility › Helper Functions › logApiRequest › should log API requests with metadata
23. Logger Utility › Helper Functions › logApiRequest › should log failed API requests
24. Logger Utility › Helper Functions › logApiRequest › should log server error responses
25. Logger Utility › Helper Functions › logApiRequest › should handle different HTTP methods
26. Logger Utility › Helper Functions › logDatabaseOperation › should log database operations
27. Logger Utility › Helper Functions › logDatabaseOperation › should log database operations with metadata
28. Logger Utility › Helper Functions › logDatabaseOperation › should log slow database queries
29. Logger Utility › Helper Functions › logDatabaseOperation › should handle different database operations
30. Logger Utility › Helper Functions › logDatabaseOperation › should log transaction operations
31. Logger Utility › Metadata Handling › should handle empty metadata
32. Logger Utility › Metadata Handling › should handle string metadata values
33. Logger Utility › Metadata Handling › should handle number metadata values
34. Logger Utility › Metadata Handling › should handle boolean metadata values
35. Logger Utility › Metadata Handling › should handle array metadata values
36. Logger Utility › Metadata Handling › should handle nested object metadata
37. Logger Utility › Metadata Handling › should handle null and undefined metadata values
38. Logger Utility › Edge Cases › should handle extremely long messages
39. Logger Utility › Edge Cases › should handle special characters in messages
40. Logger Utility › Edge Cases › should handle unicode characters
41. Logger Utility › Edge Cases › should handle very large metadata objects
42. Logger Utility › Edge Cases › should handle rapid successive logging
43. Logger Utility › Type Safety › should handle typed metadata
44. Logger Utility › Log Levels › should log info messages
45. Logger Utility › Log Levels › should log info messages with metadata
46. Logger Utility › Log Levels › should log warn messages
47. Logger Utility › Log Levels › should log warn messages with metadata
48. Logger Utility › Log Levels › should log error messages
49. Logger Utility › Log Levels › should log error messages with error object
50. Logger Utility › Log Levels › should log error messages with stack trace
51. Logger Utility › Log Levels › should log debug messages
52. Logger Utility › Log Levels › should log debug messages with metadata
53. Logger Utility › Log Levels › should log http messages
54. Logger Utility › Log Levels › should log http messages with request details
55. Logger Utility › Child Logger › should create child logger with metadata
56. Logger Utility › Child Logger › should create child logger for specific module
57. Logger Utility › Child Logger › should create child logger with multiple context fields
58. Logger Utility › Child Logger › should create child logger with nested metadata
59. Logger Utility › Helper Functions › logPerformance › should log performance metrics
60. Logger Utility › Helper Functions › logPerformance › should log performance metrics with additional metadata
61. Logger Utility › Helper Functions › logPerformance › should handle zero duration
62. Logger Utility › Helper Functions › logPerformance › should handle large durations
63. Logger Utility › Helper Functions › logPerformance › should handle fractional milliseconds
64. Logger Utility › Helper Functions › logApiRequest › should log API requests
65. Logger Utility › Helper Functions › logApiRequest › should log API requests with metadata
66. Logger Utility › Helper Functions › logApiRequest › should log failed API requests
67. Logger Utility › Helper Functions › logApiRequest › should log server error responses
68. Logger Utility › Helper Functions › logApiRequest › should handle different HTTP methods
69. Logger Utility › Helper Functions › logDatabaseOperation › should log database operations
70. Logger Utility › Helper Functions › logDatabaseOperation › should log database operations with metadata
71. Logger Utility › Helper Functions › logDatabaseOperation › should log slow database queries
72. Logger Utility › Helper Functions › logDatabaseOperation › should handle different database operations
73. Logger Utility › Helper Functions › logDatabaseOperation › should log transaction operations
74. Logger Utility › Metadata Handling › should handle empty metadata
75. Logger Utility › Metadata Handling › should handle string metadata values
76. Logger Utility › Metadata Handling › should handle number metadata values
77. Logger Utility › Metadata Handling › should handle boolean metadata values
78. Logger Utility › Metadata Handling › should handle array metadata values
79. Logger Utility › Metadata Handling › should handle nested object metadata
80. Logger Utility › Metadata Handling › should handle null and undefined metadata values
81. Logger Utility › Edge Cases › should handle extremely long messages
82. Logger Utility › Edge Cases › should handle special characters in messages
83. Logger Utility › Edge Cases › should handle unicode characters
84. Logger Utility › Edge Cases › should handle very large metadata objects
85. Logger Utility › Edge Cases › should handle rapid successive logging
86. Logger Utility › Type Safety › should handle typed metadata

---

## tests/unit/lib/monitoring/health-monitoring.test.ts
**Failures:** 2

1. Health Monitoring Module › Module initialization › should initialize tracer when DD_API_KEY is present
2. Health Monitoring Module › Module initialization › should initialize tracer when DD_API_KEY is present

---

## tests/unit/lib/protocols/adapters/continue-adapter.test.ts
**Failures:** 4

1. ContinueAdapter › sendMessage › should handle errors gracefully
2. ContinueAdapter › autocomplete › should handle autocomplete errors
3. ContinueAdapter › sendMessage › should handle errors gracefully
4. ContinueAdapter › autocomplete › should handle autocomplete errors

---

## tests/unit/lib/rate-limiting.test.ts
**Failures:** 4

1. Rate Limiting › rateLimit › should allow requests under limit
2. Rate Limiting › rateLimit › should calculate correct remaining count
3. Rate Limiting › rateLimit › should allow requests under limit
4. Rate Limiting › rateLimit › should calculate correct remaining count

---

## tests/unit/lib/security/csrf-protection.test.ts
**Failures:** 6

1. CSRF Protection Implementation › needsCSRFProtection › should require CSRF for POST requests
2. CSRF Protection Implementation › needsCSRFProtection › should require CSRF for PUT requests
3. CSRF Protection Implementation › needsCSRFProtection › should require CSRF for DELETE requests
4. CSRF Protection Implementation › needsCSRFProtection › should require CSRF for POST requests
5. CSRF Protection Implementation › needsCSRFProtection › should require CSRF for PUT requests
6. CSRF Protection Implementation › needsCSRFProtection › should require CSRF for DELETE requests

---

## tests/unit/middleware/quota-middleware.test.ts
**Failures:** 6

1. Quota Middleware › withQuotaCheck › Quota Checking › should allow action when quota check passes
2. Quota Middleware › withQuotaCheck › Quota Checking › should pass file size option for upload_file action
3. Quota Middleware › withQuotaCheck › API Call Recording › should record API call for api_call action
4. Quota Middleware › withQuotaCheck › Quota Checking › should allow action when quota check passes
5. Quota Middleware › withQuotaCheck › Quota Checking › should pass file size option for upload_file action
6. Quota Middleware › withQuotaCheck › API Call Recording › should record API call for api_call action

---

## tests/unit/middleware/security-middleware.test.ts
**Failures:** 10

1. Security Middleware Module › apiSecurityMiddleware › should handle OPTIONS requests
2. Security Middleware Module › apiSecurityMiddleware › should validate CORS for production requests
3. Security Middleware Module › Authentication Validation › should require authentication for high security endpoints
4. Security Middleware Module › Authentication Validation › should require admin role for critical endpoints
5. Security Middleware Module › AI Endpoint Validation › should check rate limits for AI endpoints
6. Security Middleware Module › apiSecurityMiddleware › should handle OPTIONS requests
7. Security Middleware Module › apiSecurityMiddleware › should validate CORS for production requests
8. Security Middleware Module › Authentication Validation › should require authentication for high security endpoints
9. Security Middleware Module › Authentication Validation › should require admin role for critical endpoints
10. Security Middleware Module › AI Endpoint Validation › should check rate limits for AI endpoints

---

## tests/unit/websocket-streaming.test.ts
**Failures:** 22

1. WebSocketStreamingClient › Connection › should connect successfully
2. WebSocketStreamingClient › Connection › should handle connection errors
3. WebSocketStreamingClient › Streaming › should send stream request
4. WebSocketStreamingClient › Streaming › should receive chunks in order
5. WebSocketStreamingClient › Streaming › should handle stream completion
6. WebSocketStreamingClient › Streaming › should handle stream errors
7. WebSocketStreamingClient › Stream Control › should pause stream
8. WebSocketStreamingClient › Stream Control › should resume stream
9. WebSocketStreamingClient › Stream Control › should cancel stream
10. WebSocketStreamingClient › Priority Handling › should use high priority connection
11. WebSocketStreamingClient › Cleanup › should release connection on disconnect
12. WebSocketStreamingClient › Connection › should connect successfully
13. WebSocketStreamingClient › Connection › should handle connection errors
14. WebSocketStreamingClient › Streaming › should send stream request
15. WebSocketStreamingClient › Streaming › should receive chunks in order
16. WebSocketStreamingClient › Streaming › should handle stream completion
17. WebSocketStreamingClient › Streaming › should handle stream errors
18. WebSocketStreamingClient › Stream Control › should pause stream
19. WebSocketStreamingClient › Stream Control › should resume stream
20. WebSocketStreamingClient › Stream Control › should cancel stream
21. WebSocketStreamingClient › Priority Handling › should use high priority connection
22. WebSocketStreamingClient › Cleanup › should release connection on disconnect

---