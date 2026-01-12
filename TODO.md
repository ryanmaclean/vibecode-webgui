# TODO

Project priorities and action items organized by urgency.

## Priority 1: Critical (1-2 days)

- [ ] **Fix 12 failing database health tests** (AGENT 91)
  - File: `tests/unit/api/health/database/route.test.ts`
  - Issue: Zod validation mismatches in test assertions
  - Impact: Blocks CI green status
  - Effort: 1-2 hours
  - Agent: AGENT 91 (CoverageExpander)

- [ ] **Commit AGENT 92 monitoring dashboard work**
  - Files: `src/app/api/dashboard/*`, `src/components/dashboard/*`
  - Status: 48 tests passing locally, not yet committed
  - Effort: 15 minutes (code review + commit)
  - Impact: Unblocks Phase 1 feature delivery

- [ ] **Verify CI green status**
  - After fixing database tests
  - Run full test suite
  - Effort: 30 minutes

## Priority 2: High (Week 1)

- [ ] **Reach 25% test coverage** (currently 23.5%)
  - [ ] Test prompt manager (+0.3% - 2-3 hours)
  - [ ] Test vector search (+0.4% - 3-4 hours)
  - [ ] Test remaining health routes (+0.3% - 2-3 hours)
  - [ ] Test AI providers (+0.5% - 4-5 hours)
  - **Total Effort**: 11-15 hours
  - **Target**: 25% line coverage

- [ ] **Test remaining AI endpoints**
  - `/api/ai/function-call` (function calling, tool use)
  - `/api/ai/upload` (file upload handling)
  - `/api/ai/generate-project` (project scaffolding)
  - **Effort**: 6-8 hours
  - **Impact**: Complete AI infrastructure testing

- [ ] **Expand monitoring dashboard features**
  - Add performance graph widget
  - Add AI usage widget
  - Implement real-time WebSocket updates
  - **Effort**: 4-6 hours

## Priority 3: Medium (Month 1)

- [ ] **Add authentication to monitoring dashboard**
  - Protect dashboard endpoints with JWT/session
  - Role-based access control (admin only)
  - **Effort**: 3-4 hours

- [ ] **Implement circuit breaker for AI provider health**
  - Automatic failover when provider is down
  - Exponential backoff for retries
  - **Effort**: 4-6 hours

- [ ] **Load testing on AI endpoints**
  - Test with 100+ concurrent requests
  - Identify bottlenecks
  - Optimize response times
  - **Effort**: 6-8 hours

- [ ] **Create E2E tests for dashboard**
  - Playwright tests for dashboard UI
  - Test all widgets and interactions
  - **Effort**: 4-6 hours

- [ ] **Deliver 2-3 Phase 1 quick win features**
  - Choose from: Chat History, File Upload, Batch Operations, API Documentation Portal
  - **Effort**: 2-3 days per feature

## Phase 1 Features (Ready for Development)

**Status**: Foundation in place, ready to build

1. [x] **Enhanced Monitoring Dashboards** (AGENT 92 - foundation complete)
   - ✅ 3 API endpoints (overview, performance, status)
   - ✅ SystemHealthWidget component
   - ✅ Demo page at `/dashboard/demo`
   - ✅ 48 tests (100% passing)
   - Next: Add auth, expand widgets, implement real-time updates

2. [ ] **Chat History & Search**
   - Store conversation history in database
   - Full-text search across conversations
   - Export conversations
   - **Effort**: 3-4 days
   - **Blocked By**: Database schema design

3. [ ] **File Upload Support**
   - Support for images, PDFs, documents
   - File validation and security scanning
   - Integration with AI endpoints
   - **Effort**: 2-3 days
   - **Blocked By**: Storage solution (S3 vs local)

4. [ ] **Batch Operations**
   - Process multiple AI requests in parallel
   - Progress tracking and cancellation
   - **Effort**: 2-3 days
   - **Blocked By**: Queue infrastructure

5. [ ] **API Documentation Portal**
   - Interactive API explorer (Swagger/OpenAPI)
   - Code examples in multiple languages
   - **Effort**: 1-2 days
   - **Blocked By**: OpenAPI spec completion

## Phase 2 Features (2-8 weeks)

**Status**: Foundation needed before implementation

1. **Multi-Provider AI Routing**
   - Intelligent routing based on model capabilities
   - Automatic fallback on provider failure
   - **Foundation Needed**: Circuit breaker, health monitoring

2. **Real-time Collaboration Tools**
   - Shared workspaces
   - Live cursors and presence
   - **Foundation Needed**: WebSocket infrastructure

3. **A/B Testing Framework**
   - Test prompts and models
   - Track performance metrics
   - **Foundation Needed**: Analytics pipeline

4. **Data Export Features**
   - Export conversations, analytics, logs
   - Multiple formats (JSON, CSV, PDF)
   - **Foundation Needed**: Export queue system

5. **Notification System**
   - Email, Slack, webhook notifications
   - Customizable triggers
   - **Foundation Needed**: Message queue

## Phase 3 Features (3-6 months)

**Status**: Future planning

1. **Auto-scaling Infrastructure**
2. **Multi-tenancy Support**
3. **GraphQL API**
4. **Mobile Application**

## Backlog

### Technical Debt
- [ ] Refactor prompt manager for better testability
- [ ] Consolidate duplicate health check logic
- [ ] Improve error handling consistency across API routes
- [ ] Document AI provider configuration options

### Documentation
- [x] Consolidate Wave 9-10 documentation (AGENT 94 - complete)
- [ ] Create API usage examples
- [ ] Write deployment guide for production
- [ ] Document monitoring dashboard setup

### DevOps
- [ ] Set up staging environment
- [ ] Implement blue-green deployment
- [ ] Add performance monitoring alerts
- [ ] Configure log aggregation

## Completed Recently

- [x] **Wave 10: Validation & Foundation** (AGENTS 90, 91, 92, 93)
  - 224 new tests added
  - 23.5% coverage reached
  - AI endpoints comprehensively tested
  - Monitoring dashboard foundation established

- [x] **Wave 9: Comprehensive System Hardening** (AGENTS 85, 86, 87, 88)
  - 8 security alerts fixed
  - 87 new tests added
  - -6.3% test time improvement
  - 15-feature roadmap established

---

## Quick Reference

**CI Status**: 🟡 Yellow (12 tests failing)
**Coverage**: 23.5% (target: 25%)
**Security**: ✅ Green (0 production vulnerabilities)
**Features**: Phase 1 ready (after P1 fixes)

**Next Agent Mission**: Fix P1 issues, expand coverage to 25%, implement Phase 1 features

---

*Last Updated: Wave 10 (AGENT 94) - 2026-01-12*
*See also: [FRICTION_LOG.md](./FRICTION_LOG.md) for active blockers*
