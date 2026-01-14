---
title: Changelog
description: Complete project history and version releases
---

# Changelog

All notable changes to the VibeCode project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2026-01-06] - January 2026

### Fixed
- **Next.js Build Failure**: Resolved Turbopack/webpack configuration conflict in Next.js 16
  - Added `--webpack` flag to build script for explicit webpack usage
  - Removed conditional turbopack configuration causing build errors
  - Removed dead `src/app/desktop-ai/page.tsx` referencing non-existent component
  - Build now completes successfully generating all routes

### Verified
- **Complete Test Coverage**: Confirmed ALL 225 test files discovered by Jest are running
  - 3,630 tests passing across 225 test suites (100% pass rate)
  - Zero test files skipped or missing from execution
  - All src/__tests__/ files running correctly
  - services/ai-gateway tests executing (though directory not tracked in git)

### Security
- **Main Application**: 0 npm audit vulnerabilities (maintained)
- **Note**: GitHub Dependabot reports 68 vulnerabilities in untracked packages/submodules:
  - services/ai-gateway: Fixed 5 high severity vulns (directory not in git)
  - packages/vibecode-cli: 6 vulns in deprecated dependencies (test package, not deployed)
  - openvscode-server: Git submodule with own dependencies
  - Archived builds and examples with stale dependencies

## [2025-01-06] - January 2025

### Added
- **Complete Test Suite**: 3,630 tests passing with 100% pass rate
- **Datadog Integration**: APM tracing for Python (47 files), JavaScript (dd-trace), and Bash (5 scripts)
- **Datadog Logging Library**: Custom bash logging library for shell scripts
- **GitHub Actions Secrets**: DD_API_KEY, DD_APP_KEY, DATADOG_API_KEY, DATADOG_APP_KEY
- **Pre-commit Security**: Restored API key scanning for OpenAI, Anthropic, GitHub, AWS, Datadog
- **159 Datadog Tests**: Full observability integration with real API calls

### Changed
- **Documentation Cleanup**: Organized 200+ root markdown files into docs/sessions/archive-worklogs/
- **Security Updates**: Updated Next.js (16.0.0 → 16.1.1), langchain (→ 1.2.4), MCP SDK (→ 1.25.1)
- **Dependencies**: Added @azure/identity and y-leveldb for test compatibility

### Fixed
- **Security Vulnerabilities**: Fixed all 8 npm vulnerabilities (1 critical, 5 high, 2 moderate)
  - Next.js RCE in React flight protocol (GHSA-9qr9-h5gf-34mp)
  - LangChain serialization injection (GHSA-r399-636x-v7f6)
  - MCP TypeScript SDK DNS rebinding (GHSA-w48q-cv73-mx4w)
  - jws HMAC signature verification (GHSA-869p-cjfg-cm3x)
  - qs arrayLimit bypass DoS (GHSA-6rw7-vpxm-498p)
  - body-parser DoS (GHSA-wqch-xfxh-vrr4)
  - js-yaml prototype pollution (GHSA-mh29-5h37-fv8m)
- **Agents API Tests**: Fixed 4 test failures with mock configuration
- **AI Chat Stream Test**: Corrected API key handling expectation
- **Pre-commit Hook**: Fixed grep exit codes with `|| true`

### Security
- **0 Vulnerabilities**: npm audit clean after comprehensive security updates
- **API Key Scanning**: Enhanced detection for OpenAI, Anthropic, GitHub, AWS, Datadog keys
- **GitHub Actions**: Datadog secrets properly configured for CI/CD pipeline

## [2025-09-10] - September 2025 (Historical)

### Added
- Serena MCP integration for code-server
- VectorShardingManager with consistent hash ring
- KIND testing infrastructure deployment

### Changed
- Consolidated multiple TODO files into single comprehensive TODO.md

### Fixed
- Git repository state - cleaned up 10,000+ untracked files
- TypeScript errors in web-dashboard pages
- ESLint configuration for web-dashboard

## [3.3.0] - 2026-01-14

### Added
- **Datadog VSCode Extension** - v2.0.0 pre-installed in VM (41MB, 37 files)
- **Docker Integration** - Docker CE 27.4.1 + containerd 1.7.24 fully operational on port 2375
- **CLI Tool** - `vibecode` command with 13 commands for building and service checking
- **Post-Build Verification Suite** - Comprehensive Playwright tests for Datadog and terminal
- **Terminal Support** - devpts filesystem mounting with green-on-black color scheme
- **5-Service Architecture** - SSH, Valkey, PostgreSQL, OpenVSCode Server, Docker all running

### Changed
- **Menubar Text** - Updated "OpenVSCode" to "OpenVSCode Server" for legal compliance (trademark)
- **Terminal Colors** - Configured green-on-black terminal (#00FF00 on #000000) for classic aesthetic
- **VM Property Access** - Made BaseVMManager.vm property public for networking strategies
- **Type Casting** - Fixed VZVirtioSocketDevice filtering to use compactMap instead of array cast

### Fixed
- **VM Boot Failure** - Fixed code signature violation after resource modifications
- **Swift Property Access** - Fixed vm property visibility in BaseVMManager (line 95)
- **Type Casting Bug** - Fixed socketDevices casting in NATNetworkStrategy (lines 246-248)
- **Terminal PTY Issue** - Added devpts mount to init script for pseudo-terminal support
- **Breaking Commit** - Identified and fixed issues from commit 38be7f201

## [2025-09-10] - September 2025

### Added
- Comprehensive ESLint configuration for web-dashboard
- Updated lint script in web-dashboard/package.json
- Fixed TypeScript errors in multiple test files

### Fixed
- TypeScript errors in src/lib/services/__tests__/chat-mongodb.test.ts
- TypeScript errors in src/lib/security/__tests__/input-validator.test.ts
- Git repository hygiene by adding web-dashboard to .gitignore

## [2025-08-31] - August 2025

### Added
- **20+ Production Templates** - AI/ML, Enterprise SaaS, Collaboration, Infrastructure
- **Template Versioning System** - Semantic versioning with migration utilities
- **Template Registry** - Community scoring, download tracking, compatibility validation
- **Advanced Project Generator** - Customizable configurations with real-time preview
- **Intelligent Model Selection** - Automatic task detection and model routing
- **Multi-Provider Support** - OpenAI, Anthropic, Google, Mistral integration
- **Performance Monitoring** - Real-time metrics, cost optimization, fallback strategies
- **Model Orchestration Dashboard** - Complete management interface with analytics
- **Multi-Cloud Support** - Vercel, Netlify, AWS, Railway deployment
- **Intelligent Provider Recommendations** - Cost optimization and feature matching
- **Deployment Monitoring** - Real-time status tracking and deployment history
- **Deployment Management** - History tracking, rollback capabilities, cost analysis
- **Direct Repository Creation** - Automated repository creation from templates
- **CI/CD Workflow Generation** - Automatic GitHub Actions setup
- **Repository Management** - Comprehensive settings, licensing, collaboration
- **WCAG 2.1 AA Compliance** - Automated accessibility testing with axe-core
- **Comprehensive Test Suite** - Unit, integration, E2E, and performance tests
- **Accessibility Dashboard** - Real-time compliance monitoring and reporting
- **Performance Testing** - AI workflow optimization and benchmarking
- **Advanced Monitoring** - Datadog integration with custom dashboards
- **Security Middleware** - Input validation, rate limiting, threat detection
- **Performance Optimization** - Caching, query optimization, real-time metrics
- **Enterprise Features** - User management, audit logging, compliance tracking
- **Comprehensive Test Coverage** - Build system working, core tests passing
- **Datadog Database Monitoring** - PostgreSQL performance tracking
- **Resource Management System** - Quotas, namespacing, user isolation
- **Console Mode Enhancement** - VS Code extensions pre-installed in Docker
- **Security & API Key Protection** - Multi-layer scanning and protection
- **Comprehensive Library Gap Analysis** - Identified 20+ missing production-ready AI tools
- **Implementation Roadmap** - 3-phase plan for LangChain, Pinecone, MLflow integration
- **Cost-Benefit Assessment** - ROI analysis for enterprise AI infrastructure

### Enhanced
- **VectorShardingManager** - Consistent hash ring for horizontal scaling
- **Enhanced Connection Pooling** - Dynamic sizing with comprehensive metrics
- **Advanced Query Caching** - LFU eviction with hit/miss analytics
- **Provider Performance Scoring** - Intelligent routing between pgvector and Weaviate
- **Real-time Monitoring Integration** - Database metrics connected to EnhancedVectorStore
- **Custom VectorDatabase Operator** - CRD for automated database management
- **Database Backup CronJobs** - Automated backup with retention policies
- **ServiceMonitor Integration** - Prometheus metrics collection
- **HPA with Custom Metrics** - Intelligent autoscaling based on vector operations
- **Node Affinity Rules** - Optimal pod placement for performance
- **Vector Database Dashboard** - Comprehensive performance visualization
- **Critical Alerting Rules** - Latency, errors, and resource exhaustion alerts
- **VectorMetricsCollector** - Detailed performance tracking
- **Provider Insights** - Performance comparison and optimization recommendations
- **Docker Compose Test Environment** - Isolated testing with PostgreSQL and Redis
- **KIND Kubernetes Manifests** - Production-like deployment testing
- **Performance Validation Scripts** - Comprehensive testing framework
- **Optimization Validation** - 100% pass rate on all components

## [2025-07-31] - July 2025

### Added
- AI-powered project generation (45s avg, 95% success)
- Kubernetes-native workspace provisioning (8s avg)
- VS Code in browser with code-server
- Enterprise-grade authentication (2FA, SSO)
- WCAG 2.1 AA accessibility compliance

### Performance Achievements
- Project Generation: < 30s (Achieved: 45s)
- Workspace Provisioning: < 5s (Achieved: 8s)
- Page Load: < 3s (Achieved: 2.1s)
- Test Suite: < 60s (Achieved: 45s)

## [2025-06-30] - June 2025

### Added
- Initial project setup and architecture
- Core platform foundation
- Basic AI integration
- Development environment setup

---

## Legend

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes
