## 🚨 CRITICAL GITHUB ISSUES FROM CODEX SALVAGE

**Date**: October 24, 2025  
**Source**: Codex Salvage Branch TODO.md (1,214 lines)  
**Priority**: IMMEDIATE ACTION REQUIRED

### 💰 **URGENT: GitHub Actions Cost Optimization ($100 Bill)**
- **Issue**: #601 - CI Pipeline Failures
- **Status**: ❌ **IMMEDIATE ACTION REQUIRED**
- **Problem**: $100/month GitHub Actions bill
- **Solution**: Release branch strategy with 70-80% cost reduction
- **Action**: Push CI fixes from `fix/ci-pipeline-failures` branch

### 🔒 **CRITICAL: Security Issues**
- **Issue**: #530 - Secure Azure Secrets
- **Status**: ❌ **CRITICAL SECURITY RISK**
- **Problem**: Plaintext API keys in `.env.azure`
- **Solution**: Migrate to Keychain immediately
- **Action**: Install pre-commit hooks with `npm run security:install-hook`

### 🧪 **HIGH-VALUE: Test Infrastructure Fixes**
- **Issue**: #532 - Deploy Validated API Routes
- **Status**: ✅ **READY FOR DEPLOYMENT**
- **Achievement**: 2 POC routes ready (`/api/chat/stream`, `/api/claude/chat`)
- **Action**: Deploy validated API routes

### 🏗️ **INFRASTRUCTURE: Kernel and eBPF**
- **Issue**: #546 - eBPF Observability Implementation
- **Status**: ✅ **COMPLETE IMPLEMENTATION EXTRACTED**
- **Achievement**: Full eBPF stack with Alpine compatibility
- **Action**: Deploy eBPF monitoring to Alpine VMs

- **Issue**: #574 - Build ARM64 Kernel
- **Status**: ⏳ **READY FOR EXECUTION**
- **Time**: 10-12 minutes on M1 Max
- **Action**: Run `./scripts/benchmarks/build-minivim-arm64-6.17.sh`

### 🔧 **MAJOR SUCCESSES COMPLETED**
- ✅ **60+ E2E test failures RESOLVED** - Complete UI infrastructure implemented
- ✅ **Real API integration setup** - No mocking, authentic service testing
- ✅ **Kubernetes Deployment Tests**: All 22 tests passing (100% success rate)
- ✅ **OpenRouter Integration Test Fixed** - 3/3 validation tests passing
- ✅ **AI Chat RAG Real Test Fixed** - Self-referential validator resolved
- ✅ **CollaborativeEditor component hang** - Infinite re-render fixed

### 📊 **TEST INFRASTRUCTURE ANALYSIS**
- **Total Tests**: 186 tests
- **Failing**: 113 tests (61% failure rate)
- **Success Rate**: 39% (significant improvement needed)
- **Real Testing Pattern**: Established with `jest.restoreAllMocks()` + real fetch

### 🎯 **IMMEDIATE ACTION ITEMS**
1. **Push CI fixes** (#601) - Merge from `fix/ci-pipeline-failures` branch
2. **Secure Azure secrets** (#530) - Migrate to Keychain immediately
3. **Install pre-commit hooks** (#530) - Team-wide secret protection
4. **Deploy validated API routes** (#532) - 2 POC routes ready
5. **Run workflow tests** (#534) - Verify 97 tests pass
6. **Build ARM64 kernel** (#574) - 10-12 min execution
7. **Test Cloud Hypervisor** (#542) - Recreate from design specs
8. **Validate eBPF programs** (#546) - Test compilation and BTF support

### 🔍 **HIGH-VALUE CONVERSION CANDIDATES**
1. **`monitoring-api.test.ts`** - ⭐ **PERFECT CANDIDATE** - ✅ **REAL VERSION CREATED**
   - Currently: Heavy mocking (NextAuth, server monitoring, metrics collection)
   - Real approach: Test actual API endpoints with real system metrics
   - Value: Real monitoring validation vs testing that mocks work

2. **`collaboration-integration.test.ts`** - ⭐ **HIGH VALUE**
   - Currently: Mocked WebSocket, IndexedDB, collaboration managers
   - Real approach: Test actual collaboration features
   - Value: Real collaboration validation

### 📈 **PERFORMANCE IMPROVEMENTS**
- **Astro build verification** - Successfully built 100 pages in 7.84s
- **TypeScript errors fixed** - Restored `npm run type-check`
- **Accessibility tests fixed** - Automated a11y testing working
- **Dependency upgrades** - Resolved security vulnerabilities

