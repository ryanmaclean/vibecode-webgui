# Phase 2: Chat Endpoint Consolidation Plan

**Issue**: #499
**Status**: Implementation Planning
**Priority**: HIGH - Critical Path
**Created**: 2025-10-01
**Phase**: 2 of 5 (API Consolidation Project)

## Executive Summary

This document provides a detailed implementation plan for consolidating 9 fragmented chat endpoints into 2 canonical endpoints. The consolidation will reduce complexity, improve maintainability, ensure feature parity, and establish clear API boundaries while maintaining backwards compatibility during a 6-month deprecation period.

### Consolidation Goals

**Before**: 9 endpoints across 3 domains (AI, Chat, Claude)
**After**: 2 canonical endpoints in unified AI domain
**Timeline**: 6 months (3 months implementation + 3 months deprecation)
**Breaking Changes**: None during deprecation period

## Current State: Endpoint Inventory

### 9 Endpoints to Consolidate

#### AI Domain (4 endpoints)
1. **`/api/ai/chat`** - Primary chat endpoint with RAG, Datadog observability, LiteLLM integration
2. **`/api/ai/chat/stream`** - OpenRouter streaming with RAG context
3. **`/api/ai/chat/unified`** - Multi-provider with advanced RAG strategies
4. **`/api/ai/chat/enhanced`** - Enhanced features with multi-model support

#### Chat Domain (3 endpoints)
5. **`/api/chat/stream`** - MongoDB persistence with enhanced RAG
6. **`/api/chat/mongodb`** - Full MongoDB service with conversation management
7. **`/api/chat/mongodb-simple`** - Direct MongoDB operations without service layer

#### Claude Domain (2 endpoints)
8. **`/api/claude/chat`** - Claude CLI integration for terminal-based commands
9. **`/api/claude/chat/secure-route.ts`** - (Note: Listed in issue, actual existence unclear)

### Feature Analysis Matrix

| Feature | ai/chat | ai/chat/stream | ai/chat/unified | ai/chat/enhanced | chat/stream | chat/mongodb | chat/mongodb-simple | claude/chat |
|---------|---------|----------------|-----------------|------------------|-------------|--------------|---------------------|-------------|
| **Authentication** | NextAuth | NextAuth | NextAuth | NextAuth | JWT Token | JWT Token | Test Header | NextAuth |
| **Streaming** | No | Yes (SSE) | No | No | Yes (SSE) | No | No | No |
| **RAG Context** | Yes (basic) | Yes (basic) | Yes (advanced) | Yes (multi-threshold) | Yes (enhanced) | No | No | No |
| **MongoDB Persistence** | Optional | No | No | No | Yes | Yes | Yes | No |
| **Multi-Provider** | LiteLLM | OpenRouter | Multi (fallback) | OpenRouter | OpenRouter | No | No | Claude only |
| **Model Selection** | Dynamic | Fixed set | Dynamic | Fixed set | Fixed set | Any | Any | Claude only |
| **Datadog Tracing** | Yes | No | No | No | Yes | No | No | No |
| **Tool Support** | No | No | Simulated | Simulated | No | No | No | No |
| **Workspace Context** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Conversation Management** | Basic | No | No | No | Yes | Yes | Yes | No |
| **Web Search** | No | No | No | No | Optional | No | No | No |
| **File Attachments** | No | No | No | No | Yes | Yes | Yes | Yes |
| **Session Tracking** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| **Error Recovery** | Basic | Basic | Fallback chains | Basic | Basic | Basic | Basic | Basic |

## Proposed Target Architecture

### 2 Canonical Endpoints

#### 1. `/api/ai/chat` (Primary Unified Endpoint)

**Purpose**: Single comprehensive chat endpoint for all standard AI interactions

**Capabilities**:
- Multi-provider support (OpenRouter, LiteLLM, direct providers)
- Streaming (SSE) and non-streaming modes
- Advanced RAG with multiple strategies
- Optional MongoDB persistence
- Datadog observability and tracing
- Conversation management
- File attachments and context
- Web search integration
- Fallback chains for reliability
- Tool calling support (simulated and native)

**Request Schema**:
```typescript
interface UnifiedChatRequest {
  // Message content
  message: string
  messages?: ChatMessage[]  // Full conversation history

  // Model configuration
  model?: string  // Default: auto-select
  provider?: 'openrouter' | 'litellm' | 'anthropic' | 'openai'

  // Feature flags
  stream?: boolean  // Enable streaming responses
  persistToMongoDB?: boolean  // Enable MongoDB persistence
  enableRAG?: boolean  // Enable RAG context (default: true)
  enableWebSearch?: boolean  // Enable web search augmentation
  enableTools?: boolean  // Enable tool calling

  // Context
  workspaceId: string
  conversationId?: string  // For MongoDB persistence
  files?: string[]  // File paths for context

  // Generation parameters
  temperature?: number  // 0.0 - 1.0
  max_tokens?: number
  top_p?: number

  // User preferences
  userApiKeys?: {
    openai?: string
    anthropic?: string
    google?: string
  }
}
```

**Response Schema**:
```typescript
// Non-streaming
interface ChatResponse {
  success: boolean
  message: {
    role: 'assistant'
    content: string
    model: string
    provider: string
  }
  metadata: {
    conversationId?: string  // If MongoDB enabled
    messageId?: string
    ragContext?: {
      sources: number
      relevanceScore: number
      strategiesUsed: number
    }
    webResults?: {
      count: number
      sources: string[]
    }
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
    latency: number
  }
  error?: string
}

// Streaming (SSE)
data: {"type": "start", "model": "anthropic/claude-3.5-sonnet"}
data: {"type": "content", "delta": "Hello"}
data: {"type": "content", "delta": " world"}
data: {"type": "metadata", "usage": {...}, "latency": 1234}
data: {"type": "done"}
```

#### 2. `/api/ai/chat/cli` (CLI Integration Endpoint)

**Purpose**: Specialized endpoint for Claude CLI terminal integration

**Capabilities**:
- Claude CLI command execution
- Terminal context awareness
- File operation support
- Workspace-scoped operations
- Simplified authentication for CLI tools

**Request Schema**:
```typescript
interface CLIChatRequest {
  message: string
  workspaceId: string
  contextFiles?: string[]
  timeout?: number  // Default: 60000
  workingDirectory?: string
}
```

**Rationale for Separation**:
- Different authentication model (API key vs session)
- Different execution context (shell commands vs chat)
- Different timeout requirements
- Specialized for developer tools integration

## Feature Migration Plan

### Phase 2.1: Core Consolidation (Weeks 1-4)

#### Week 1: Foundation & Architecture

**Tasks**:
1. Create `/api/ai/chat/v2` development endpoint (shadow production)
2. Implement unified request/response schemas with Zod validation
3. Set up feature flag system for gradual rollout
4. Implement multi-provider routing logic
5. Create comprehensive test suite (unit + integration)

**Deliverables**:
- `src/lib/ai/unified-chat-handler.ts` - Core chat logic
- `src/lib/ai/provider-router.ts` - Provider selection and fallback
- `src/schemas/chat-request.schema.ts` - Zod validation schemas
- `tests/integration/api/ai/chat-consolidation.test.ts` - Test suite

**Success Criteria**:
- All schemas validated with Zod
- Feature flags operational
- Test coverage >80%

#### Week 2: RAG Consolidation

**Tasks**:
1. Merge RAG strategies from all 4 implementations:
   - Basic single-threshold (from `/api/ai/chat`)
   - Multi-strategy (from `/api/ai/chat/unified`)
   - Multi-threshold (from `/api/ai/chat/enhanced`)
   - Enhanced with web search (from `/api/chat/stream`)
2. Implement adaptive RAG strategy selection
3. Add RAG performance metrics
4. Create RAG configuration API

**RAG Strategy Selection**:
```typescript
function selectRAGStrategy(request: ChatRequest): RAGStrategy {
  if (request.enableWebSearch) return 'enhanced-with-web'
  if (request.workspaceSize > 10000) return 'multi-strategy'
  if (request.requireHighPrecision) return 'multi-threshold'
  return 'basic-optimized'
}
```

**Deliverables**:
- `src/lib/rag/unified-rag-service.ts` - Consolidated RAG logic
- `src/lib/rag/strategy-selector.ts` - Adaptive strategy selection
- RAG benchmarks and performance comparison

**Success Criteria**:
- All 4 RAG strategies available
- Strategy selection automatic based on context
- Performance within 10% of best current implementation

#### Week 3: Streaming & Persistence

**Tasks**:
1. Implement SSE streaming with graceful fallback
2. Integrate MongoDB persistence as optional feature
3. Add conversation management (create, retrieve, search, stats)
4. Implement streaming error recovery
5. Add connection pooling for MongoDB

**Streaming Implementation**:
```typescript
async function* streamChatResponse(
  provider: AIProvider,
  messages: ChatMessage[],
  options: StreamOptions
): AsyncGenerator<StreamChunk> {
  try {
    for await (const chunk of provider.stream(messages, options)) {
      yield { type: 'content', delta: chunk.text }

      // Checkpoint for MongoDB persistence
      if (options.persistToMongoDB && shouldCheckpoint(chunk)) {
        await saveCheckpoint(chunk)
      }
    }

    yield { type: 'metadata', usage: finalUsage, latency }
    yield { type: 'done' }
  } catch (error) {
    yield { type: 'error', error: formatError(error) }
    // Attempt recovery with fallback provider
    if (options.enableFallback) {
      yield* streamWithFallback(messages, options)
    }
  }
}
```

**Deliverables**:
- SSE streaming with error recovery
- MongoDB integration with connection pooling
- Conversation management API
- Stream checkpoint persistence

**Success Criteria**:
- Streaming latency <100ms first token
- MongoDB persistence optional and reliable
- Graceful error recovery with fallbacks

#### Week 4: Observability & Testing

**Tasks**:
1. Integrate Datadog tracing for all operations
2. Add custom metrics for RAG, streaming, persistence
3. Implement structured logging
4. Create comprehensive integration test suite
5. Performance benchmarking against existing endpoints

**Observability Stack**:
```typescript
// Datadog tracing spans
span('ai.chat.request')
  span('ai.chat.auth')
  span('ai.chat.rag')
    span('ai.chat.rag.vector_search')
    span('ai.chat.rag.web_search')
  span('ai.chat.provider')
    span('ai.chat.provider.litellm')
  span('ai.chat.stream')
  span('ai.chat.mongodb')

// Custom metrics
datadogMetrics.recordChatRequest(duration, model, provider)
datadogMetrics.recordRAGContext(duration, sources, relevance)
datadogMetrics.recordStreamingLatency(firstToken, totalDuration)
datadogMetrics.recordPersistenceOperation(duration, success)
```

**Deliverables**:
- Complete Datadog integration
- Custom metrics dashboard
- Integration test suite (30+ test cases)
- Performance benchmark report

**Success Criteria**:
- All operations traced in Datadog
- Metrics available in dashboard
- Test coverage >85%
- Performance within 5% of best current implementation

### Phase 2.2: CLI Integration (Week 5)

#### Tasks:
1. Move `/api/claude/chat` → `/api/ai/chat/cli`
2. Preserve all CLI-specific features
3. Update authentication for CLI usage
4. Add CLI-specific metrics
5. Update CLI client libraries

**Deliverables**:
- `/api/ai/chat/cli/route.ts` - CLI endpoint
- Updated authentication flow
- CLI client library updates
- Documentation for CLI users

**Success Criteria**:
- CLI functionality preserved 100%
- No breaking changes for existing CLI users
- Authentication smooth for CLI tools

### Phase 2.3: Migration & Deprecation (Weeks 6-12)

#### Week 6-8: Soft Deprecation (3 months remaining)

**Tasks**:
1. Add deprecation headers to old endpoints:
   ```
   Deprecation: true
   Sunset: 2026-04-01
   Link: </api/ai/chat>; rel="successor-version"
   ```
2. Add console warnings in responses
3. Update documentation with migration guides
4. Create migration helper tool
5. Monitor adoption metrics

**Deprecation Response Example**:
```json
{
  "success": true,
  "message": {...},
  "_deprecation": {
    "deprecated": true,
    "sunset_date": "2026-04-01",
    "replacement_endpoint": "/api/ai/chat",
    "migration_guide": "https://docs.vibecode.com/api/chat-migration",
    "breaking_changes": []
  }
}
```

**Migration Tool**:
```bash
# CLI tool to update client code
npx vibecode-migrate-chat --from=/api/ai/chat/stream --to=/api/ai/chat

# Output:
# ✓ Found 15 usages of /api/ai/chat/stream
# ✓ Updated 15 files
# ✓ Added 'stream: true' flag to requests
# → Run tests: npm test
```

**Deliverables**:
- Deprecation headers on all old endpoints
- Migration guides for each endpoint
- Migration helper tool
- Adoption metrics dashboard

**Success Criteria**:
- 100% of old endpoints show deprecation notices
- Migration guides published
- >50% traffic on new endpoint

#### Week 9-10: Hard Deprecation (2 months remaining)

**Tasks**:
1. Add warning banners to API responses
2. Send email notifications to active API users
3. Increase log verbosity for old endpoints
4. Monitor error rates during migration
5. Provide migration assistance

**Hard Deprecation Notice**:
```json
{
  "success": true,
  "message": {...},
  "_deprecation": {
    "deprecated": true,
    "sunset_date": "2026-04-01",
    "days_until_removal": 60,
    "severity": "high",
    "action_required": true,
    "migration_guide": "https://docs.vibecode.com/api/chat-migration",
    "support_email": "api-support@vibecode.com"
  }
}
```

**Deliverables**:
- Enhanced deprecation warnings
- User notification campaign
- Migration support documentation
- Error monitoring dashboard

**Success Criteria**:
- All active users notified
- >80% traffic on new endpoint
- Zero critical bugs reported

#### Week 11-12: Sunset Warning (1 month remaining)

**Tasks**:
1. Final warning period with countdown
2. Rate limit old endpoints (soft limits)
3. Redirect remaining traffic where possible
4. Final migration support push
5. Prepare removal PR

**Sunset Warning**:
```json
{
  "success": true,
  "message": {...},
  "_deprecation": {
    "deprecated": true,
    "sunset_date": "2026-04-01",
    "days_until_removal": 30,
    "severity": "critical",
    "action_required": true,
    "automatic_redirect_enabled": false,
    "migration_guide": "https://docs.vibecode.com/api/chat-migration"
  }
}
```

**Deliverables**:
- Countdown notices in responses
- Soft rate limiting enabled
- Final migration report
- Removal PR prepared

**Success Criteria**:
- >95% traffic on new endpoint
- <5% users on old endpoints
- All migrations tracked

### Phase 2.4: Removal (Week 13+)

#### Final Cleanup

**Tasks**:
1. Remove old endpoint files
2. Add permanent redirects (301) to new endpoint
3. Update all documentation
4. Archive old endpoint code for reference
5. Cleanup unused dependencies

**Permanent Redirects**:
```typescript
// In old endpoint files, replace with:
export async function POST(request: NextRequest) {
  return NextResponse.redirect(
    new URL('/api/ai/chat', request.url),
    { status: 301 }
  )
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    error: 'Endpoint removed',
    successor: '/api/ai/chat',
    removal_date: '2026-04-01',
    documentation: 'https://docs.vibecode.com/api/chat'
  }, { status: 410 }) // 410 Gone
}
```

**Deliverables**:
- Old endpoints removed
- Redirects in place
- Documentation updated
- Archive created
- Dependencies cleaned

**Success Criteria**:
- Zero code paths to old implementations
- 100% traffic on new endpoint
- Documentation accurate

## Backwards Compatibility Strategy

### Automatic Request Migration

**Approach**: Detect old request formats and auto-migrate

```typescript
function migrateRequest(request: any, sourceEndpoint: string): UnifiedChatRequest {
  // Detect source endpoint from path or headers
  switch (sourceEndpoint) {
    case '/api/ai/chat/stream':
      return {
        message: request.message,
        model: request.model,
        stream: true, // Force streaming
        workspaceId: request.context.workspaceId,
        files: request.context.files,
        messages: request.context.previousMessages?.map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
      }

    case '/api/chat/stream':
      return {
        message: request.message,
        model: request.model,
        stream: true,
        persistToMongoDB: true, // Enable MongoDB
        enableRAG: request.enableRAG ?? true,
        enableWebSearch: request.enableWebSearch ?? false,
        workspaceId: request.workspaceId,
        conversationId: request.conversationId,
        files: request.files
      }

    case '/api/chat/mongodb':
      // Handle action-based API
      if (request.action) {
        return convertMongoDBAction(request)
      }
      return migrateStandardRequest(request)

    case '/api/claude/chat':
      return {
        message: request.message,
        model: 'anthropic/claude-3-5-sonnet-20241022',
        workspaceId: request.workspaceId,
        files: request.contextFiles,
        provider: 'anthropic'
      }

    default:
      return request // Already in unified format
  }
}
```

### Response Format Compatibility

**Approach**: Detect client expectations and format response accordingly

```typescript
function formatResponse(
  response: UnifiedChatResponse,
  targetFormat: string
): any {
  switch (targetFormat) {
    case 'mongodb-action':
      return {
        success: response.success,
        message: response.message.content,
        conversation: response.metadata.conversationId
      }

    case 'cli':
      return {
        success: response.success,
        message: response.message.content,
        error: response.error,
        metadata: response.metadata
      }

    default:
      return response // Unified format
  }
}
```

## Testing Strategy

### Test Coverage Requirements

**Target**: >85% code coverage for all new code

#### Unit Tests (200+ test cases)

**Categories**:
1. **Request Validation** (30 tests)
   - Schema validation for all fields
   - Required vs optional fields
   - Type checking
   - Range validation

2. **Provider Routing** (25 tests)
   - Provider selection logic
   - Fallback chain execution
   - Error handling per provider
   - Custom API key handling

3. **RAG Strategies** (40 tests)
   - Strategy selection logic
   - Each strategy implementation
   - Context building and ranking
   - Web search integration

4. **Streaming** (30 tests)
   - SSE format validation
   - Chunk generation
   - Error recovery in streams
   - Stream cancellation

5. **MongoDB Persistence** (35 tests)
   - Conversation CRUD operations
   - Message persistence
   - Search functionality
   - Stats calculation

6. **Request Migration** (20 tests)
   - Each endpoint migration path
   - Edge cases and invalid formats
   - Backwards compatibility

7. **Response Formatting** (20 tests)
   - Unified format
   - Legacy format compatibility
   - Error response formats

#### Integration Tests (50+ test cases)

**Categories**:
1. **End-to-End Chat** (15 tests)
   - Complete chat flow with RAG
   - Streaming chat flow
   - MongoDB persistence flow
   - Multi-turn conversations

2. **Provider Integration** (10 tests)
   - OpenRouter integration
   - LiteLLM integration
   - Anthropic direct integration
   - Fallback chain execution

3. **Authentication** (8 tests)
   - NextAuth flow
   - JWT token validation
   - API key authentication
   - Unauthorized access handling

4. **Migration Scenarios** (10 tests)
   - Each old endpoint → new endpoint
   - Request format migration
   - Response format compatibility

5. **Error Scenarios** (7 tests)
   - Provider failures
   - RAG failures
   - MongoDB failures
   - Network timeouts

#### Load Testing (Performance)

**Scenarios**:
1. **Baseline Load**
   - 100 concurrent users
   - 1000 requests/minute
   - Mix of streaming and non-streaming

2. **Peak Load**
   - 500 concurrent users
   - 5000 requests/minute
   - Sustained for 10 minutes

3. **Stress Test**
   - 1000 concurrent users
   - 10000 requests/minute
   - Identify breaking point

**Performance Targets**:
- P50 latency: <200ms (non-streaming)
- P95 latency: <500ms (non-streaming)
- P99 latency: <1000ms (non-streaming)
- First token latency: <100ms (streaming)
- Throughput: >5000 req/min
- Error rate: <0.1%

#### Monitoring & Alerts

**Metrics to Monitor**:
1. Request rate per endpoint
2. Error rate per endpoint
3. Latency percentiles (P50, P95, P99)
4. Provider usage distribution
5. RAG strategy usage
6. MongoDB operation latency
7. Streaming connection duration
8. Migration traffic split

**Alerts**:
- Error rate >1% for 5 minutes
- P95 latency >1000ms for 5 minutes
- Provider failure rate >5%
- MongoDB connection pool exhaustion
- Old endpoint traffic >10% after Week 8

## Rollout Timeline

### 6-Month Timeline Overview

```
Month 1: Implementation
├─ Week 1-2: Core consolidation
├─ Week 3-4: Features and testing
└─ Week 5: CLI migration

Month 2: Soft Launch
├─ Week 6-7: Beta testing with feature flags
├─ Week 8: Soft deprecation begins
└─ Week 9: Migration guides published

Month 3: Gradual Migration
├─ Week 10-11: Encourage migration (50% target)
└─ Week 12-13: Active migration support (80% target)

Month 4-6: Deprecation Period
├─ Month 4: Hard deprecation (2 months warning)
├─ Month 5: Sunset warning (1 month warning)
└─ Month 6: Removal and cleanup
```

### Feature Flag Rollout

**Progressive Enablement**:

```typescript
const featureFlags = {
  // Week 6: Internal testing only
  unified_chat_internal: {
    enabled: true,
    userIds: ['internal-team']
  },

  // Week 7: Beta users (10%)
  unified_chat_beta: {
    enabled: true,
    percentage: 10,
    userIds: ['beta-testers']
  },

  // Week 8: Gradual rollout (25%)
  unified_chat_gradual: {
    enabled: true,
    percentage: 25
  },

  // Week 9: Majority rollout (50%)
  unified_chat_majority: {
    enabled: true,
    percentage: 50
  },

  // Week 10: Full rollout (100%)
  unified_chat_full: {
    enabled: true,
    percentage: 100
  }
}
```

## Risk Assessment & Mitigation

### High-Risk Areas

#### 1. Feature Parity Gaps

**Risk**: Missing features from consolidated endpoints causes user impact
**Probability**: Medium
**Impact**: High

**Mitigation**:
- Comprehensive feature matrix audit (completed above)
- Integration tests covering all features
- Beta testing period with real users
- Feature flag rollback capability
- Parallel operation during deprecation

#### 2. Performance Regression

**Risk**: Unified endpoint slower than specialized endpoints
**Probability**: Medium
**Impact**: High

**Mitigation**:
- Extensive load testing before rollout
- Performance benchmarks vs current endpoints
- Adaptive strategy selection for optimization
- Caching layer for RAG results
- Connection pooling for MongoDB
- Monitoring and alerts on P95/P99 latency

#### 3. Data Loss (MongoDB)

**Risk**: Migration causes conversation or message loss
**Probability**: Low
**Impact**: Critical

**Mitigation**:
- MongoDB backup before migration
- Transaction support for all DB operations
- Idempotent message persistence
- Data validation after migration
- Rollback plan with data restore

#### 4. Breaking Changes

**Risk**: Auto-migration doesn't cover all edge cases
**Probability**: Medium
**Impact**: Medium

**Mitigation**:
- 6-month deprecation period
- Auto-migration for known formats
- Clear migration guides
- Migration helper tool
- Support team prepared for issues
- Feature flags for instant rollback

#### 5. Provider Failures

**Risk**: Provider outages impact all users (no fallback)
**Probability**: Low
**Impact**: High

**Mitigation**:
- Multi-provider fallback chains
- Provider health monitoring
- Automatic failover logic
- Rate limiting per provider
- Circuit breaker pattern
- Degraded mode operation

### Rollback Plan

**Trigger Conditions**:
- Error rate >5% sustained for 10 minutes
- P95 latency >2000ms sustained for 10 minutes
- Data loss or corruption detected
- Critical feature regression
- Provider cascade failure

**Rollback Procedure**:
1. Disable feature flag (instant)
2. Revert traffic to old endpoints
3. Investigate issue in isolated environment
4. Fix and re-test
5. Re-enable gradually

**Rollback Time**: <5 minutes (feature flag toggle)

## Success Metrics

### Quantitative Metrics

#### Adoption Metrics
- **Week 8**: >50% traffic on new endpoint
- **Week 10**: >80% traffic on new endpoint
- **Week 12**: >95% traffic on new endpoint
- **Month 6**: 100% traffic on new endpoint

#### Performance Metrics
- **Latency**: P95 <500ms (within 5% of best current)
- **Throughput**: >5000 req/min
- **Error Rate**: <0.1%
- **Availability**: >99.95%

#### Quality Metrics
- **Test Coverage**: >85%
- **Bug Severity**: Zero P0/P1 bugs after Week 10
- **Customer Complaints**: <10 migration-related issues
- **Regression Rate**: <2% of features

#### Efficiency Metrics
- **Code Reduction**: 9 endpoints → 2 (78% reduction)
- **Maintenance Time**: 50% reduction in chat-related bugs
- **Documentation**: Single unified API doc vs 9 separate docs
- **Onboarding Time**: 60% faster for new developers

### Qualitative Metrics

#### Developer Experience
- Unified API reduces cognitive load
- Single source of truth for chat features
- Clear upgrade path for future features
- Consistent error handling and logging

#### User Experience
- Consistent behavior across all chat interfaces
- Better reliability with fallback chains
- Improved performance with optimized RAG
- Seamless migration experience

#### Operational Excellence
- Simplified monitoring and alerting
- Reduced operational overhead
- Faster incident response
- Better observability with unified tracing

## Implementation Checklist

### Phase 2.1: Core Consolidation ✓ Weeks 1-4

#### Week 1: Foundation
- [ ] Create `/api/ai/chat/v2` development endpoint
- [ ] Implement Zod schemas for request/response validation
- [ ] Set up feature flag system (LaunchDarkly or similar)
- [ ] Create provider routing logic with fallback chains
- [ ] Implement basic unit test suite (>50 tests)
- [ ] Set up integration test framework
- [ ] Create development environment for testing

#### Week 2: RAG Consolidation
- [ ] Audit and document all 4 RAG implementations
- [ ] Create `UnifiedRAGService` with all strategies
- [ ] Implement adaptive strategy selection logic
- [ ] Add web search integration
- [ ] Create RAG performance benchmarks
- [ ] Add RAG-specific unit tests (40+ tests)
- [ ] Document RAG strategy selection criteria

#### Week 3: Streaming & Persistence
- [ ] Implement SSE streaming with error recovery
- [ ] Add MongoDB integration with connection pooling
- [ ] Create conversation management API (CRUD + search)
- [ ] Implement streaming checkpoints for persistence
- [ ] Add streaming-specific tests (30+ tests)
- [ ] Add MongoDB integration tests (35+ tests)
- [ ] Document streaming and persistence features

#### Week 4: Observability & Testing
- [ ] Integrate Datadog tracing for all operations
- [ ] Add custom metrics for RAG, streaming, persistence
- [ ] Implement structured logging
- [ ] Complete integration test suite (50+ tests)
- [ ] Run load testing and performance benchmarks
- [ ] Create Datadog dashboard for monitoring
- [ ] Document observability setup

### Phase 2.2: CLI Integration ✓ Week 5

- [ ] Move `/api/claude/chat` to `/api/ai/chat/cli`
- [ ] Preserve CLI-specific authentication
- [ ] Update CLI client libraries
- [ ] Add CLI-specific tests (15+ tests)
- [ ] Update CLI documentation
- [ ] Deploy to staging for CLI testing

### Phase 2.3: Migration & Deprecation ✓ Weeks 6-12

#### Week 6-8: Soft Deprecation
- [ ] Add deprecation headers to all old endpoints
- [ ] Create migration guides for each endpoint
- [ ] Build migration helper tool
- [ ] Set up adoption metrics dashboard
- [ ] Begin beta testing with 10% traffic
- [ ] Monitor error rates and performance
- [ ] Gather user feedback

#### Week 9-10: Hard Deprecation
- [ ] Increase deprecation warning severity
- [ ] Send email notifications to active API users
- [ ] Increase traffic to 50% on new endpoint
- [ ] Provide migration support to high-volume users
- [ ] Monitor and address migration issues
- [ ] Update documentation with FAQ

#### Week 11-12: Sunset Warning
- [ ] Final warning period with countdown
- [ ] Soft rate limiting on old endpoints
- [ ] Increase traffic to 95% on new endpoint
- [ ] Final migration support push
- [ ] Prepare removal PR
- [ ] Schedule removal date

### Phase 2.4: Removal ✓ Week 13+

- [ ] Remove old endpoint implementation files
- [ ] Add permanent redirects (301/410)
- [ ] Update all documentation
- [ ] Archive old endpoint code for reference
- [ ] Cleanup unused dependencies
- [ ] Verify 100% traffic on new endpoint
- [ ] Post-mortem and lessons learned
- [ ] Update TODO.md with completion

## Documentation Requirements

### API Documentation

1. **API Reference** (`docs/api/chat-unified-reference.md`)
   - Request/response schemas with examples
   - All parameters and flags
   - Error codes and handling
   - Rate limits and quotas

2. **Migration Guides** (`docs/api/migration/`)
   - `ai-chat-stream-migration.md`
   - `ai-chat-unified-migration.md`
   - `ai-chat-enhanced-migration.md`
   - `chat-stream-migration.md`
   - `chat-mongodb-migration.md`
   - `claude-chat-migration.md`

3. **Integration Guide** (`docs/api/chat-integration-guide.md`)
   - Quick start examples
   - Authentication setup
   - Streaming implementation
   - MongoDB persistence usage
   - RAG context configuration
   - Error handling best practices

4. **Architecture Doc** (`docs/architecture/unified-chat-architecture.md`)
   - System design overview
   - Component interactions
   - Data flow diagrams
   - Scaling considerations

### Internal Documentation

1. **Implementation Guide** (`docs/internal/chat-consolidation-implementation.md`)
   - Detailed technical implementation
   - Code organization
   - Testing procedures
   - Deployment steps

2. **Runbook** (`docs/runbooks/unified-chat-operations.md`)
   - Common operations
   - Troubleshooting guide
   - Incident response
   - Rollback procedures

3. **Performance Benchmarks** (`docs/benchmarks/chat-performance.md`)
   - Baseline measurements
   - Comparison with old endpoints
   - Optimization recommendations

## Dependencies & Prerequisites

### Technical Dependencies

- **Next.js 15+**: App Router support for route handlers
- **Zod 3.x**: Request/response validation
- **Prisma**: Database ORM for PostgreSQL
- **MongoDB Node Driver 6.x**: MongoDB persistence
- **OpenAI SDK**: Provider integrations
- **dd-trace**: Datadog tracing
- **Server-Sent Events**: Native Next.js streaming

### Service Dependencies

- **PostgreSQL**: User data, workspaces, sessions
- **MongoDB**: Chat conversations and messages
- **Pinecone/Weaviate**: Vector store for RAG
- **OpenRouter API**: Multi-provider chat access
- **LiteLLM**: Provider abstraction
- **Datadog**: Observability and monitoring

### Team Dependencies

- **Backend Team**: Primary implementation (2 engineers)
- **Frontend Team**: Client updates for new endpoint (1 engineer)
- **DevOps Team**: Monitoring setup and deployment (1 engineer)
- **QA Team**: Testing and validation (1 engineer)
- **Documentation Team**: Migration guides (1 technical writer)
- **Support Team**: User migration assistance (2 support engineers)

## Communication Plan

### Stakeholder Updates

**Weekly Updates** (Weeks 1-12):
- Progress summary
- Blockers and risks
- Upcoming milestones
- Help needed

**Milestone Reviews** (Weeks 4, 8, 12):
- Demo of completed functionality
- Performance metrics
- Adoption metrics
- Adjustment recommendations

### User Communication

**Week 6** (Soft Deprecation):
- Blog post announcing consolidation
- Email to API users
- Deprecation notices in API responses
- Migration guide publication

**Week 9** (Hard Deprecation):
- Email with 2-month warning
- In-app notifications
- Office hours for migration support

**Week 11** (Sunset Warning):
- Final email with 1-month countdown
- Increased notice severity
- Direct outreach to remaining users

**Week 13** (Removal):
- Announcement of successful completion
- Final migration statistics
- Thank you to community

## Post-Launch Activities

### Monitoring Period (Weeks 13-16)

- Daily error rate monitoring
- Weekly performance reviews
- User feedback collection
- Issue triage and prioritization

### Optimization Phase (Weeks 17-20)

- Performance optimization based on real data
- RAG strategy tuning
- Cost optimization (provider selection)
- Documentation improvements

### Lessons Learned (Week 21)

- Post-mortem meeting
- Document what went well
- Document what could improve
- Apply learnings to future phases

## Next Steps

1. **Review this plan** with backend team and stakeholders
2. **Approve timeline** and resource allocation
3. **Create feature branch** `feature/chat-consolidation`
4. **Begin Phase 2.1 Week 1** implementation
5. **Post update** to issue #499

---

**Document Version**: 1.0
**Last Updated**: 2025-10-01
**Author**: Harper (Backend Architect Agent)
**Reviewers**: TBD
**Status**: Ready for Review
