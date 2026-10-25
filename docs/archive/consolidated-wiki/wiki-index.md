---
title: VibeCode Documentation Wiki
description: Complete documentation index for VibeCode platform
---

# VibeCode Documentation Wiki

**Last Updated:** July 22, 2025  
**Status:** Production Ready ✅

Welcome to the comprehensive VibeCode documentation. This wiki provides complete information for developers, administrators, and users.

## 📋 Quick Navigation

### 🚀 Getting Started
- **[README](README.md)** - Project overview and quick start
- **[KIND Setup Guide](KIND_TROUBLESHOOTING_GUIDE.md)** - Local Kubernetes environment
- **[Docker Troubleshooting](DOCKER_TROUBLESHOOTING_SUMMARY.md)** - Docker Doctor TUI documentation

### 🎨 Tailwind CSS v4 Implementation
- **[Tailwind CSS v4 Migration Guide](../content/wiki/wiki)** - Complete implementation guide with three production-ready approaches
- **[Tailwind CSS v4 Success Guide](../../src/content/docs/tailwind-v4-success)** - Production-ready implementation details
- **[Tailwind CSS v4 Testing Report](../../src/content/docs/tailwind-v4-testing-report)** - Comprehensive test results across all environments
- **[x86-64 Production Test Report](../../src/content/docs/x86-production-test-report)** - Production architecture verification
- **[Comprehensive Environment Test Report](../../src/content/docs/comprehensive-environment-test-report)** - Complete validation across local dev, Docker, KIND, and Kubernetes
- **[Migration Notes](../../src/content/docs/tailwind-v4-migration-notes)** - Complete migration journey and resolution

### 🏗️ Development & Operations
- **[Project Roadmap](../../src/content/docs/project-todo)** - Technical roadmap and development tasks
- **[Repository Scan Report](../content/wiki/REPOSITORY_SCAN_REPORT_JULY_2025.md)** - Current project status
- **[Enhanced AI Features](../content/wiki/ENHANCED_AI_FEATURES.md)** - New AI capabilities
- **[Missing AI Libraries Analysis](../content/wiki/MISSING_AI_LIBRARIES_ANALYSIS.md)** - AI ecosystem gaps
- **[Authentication Guide](../content/wiki/AUTHENTICATION_SUMMARY.md)** - Security implementation
- **[Testing Guide](AUTHENTICATION_TESTING_GUIDE.md)** - Authentication testing
- **[Consolidated Documentation](../../src/content/docs/consolidated-documentation)** - Complete documentation index

### 🔧 Infrastructure & Deployment
- **[Helm Deployment Guide](./helm-deployment-guide)** - Production-ready Helm charts with environment scaling
- **[Storage Sizing Analysis](./storage-sizing-analysis)** - Right-sized storage allocation for cost optimization
- **[Helm Scaling Analysis](../../src/content/docs/helm-scaling-analysis)** - Complete resource scaling strategy
- **[Azure Infrastructure](../content/wiki/AZURE_INFRASTRUCTURE_SUMMARY.md)** - Cloud deployment
- **[Production Status](../../src/content/docs/production-status.md)** - Current production state
- **[Comprehensive Testing](../content/wiki/COMPREHENSIVE_TESTING_ASSESSMENT.md)** - Test coverage analysis
- **[Container Manifest](../content/wiki/CONTAINER_MANIFEST.md)** - Container configurations

### 🤖 AI & Machine Learning
- **[GenAI Integration](../content/wiki/GENAI_INTEGRATION_ARCHITECTURE.md)** - AI architecture
- **[GenAI Enhancement Summary](../content/wiki/GENAI_ENHANCEMENT_SUMMARY.md)** - Recent AI improvements
- **[AI CLI Tools Implementation](../content/wiki/AI_CLI_TOOLS_IMPLEMENTATION_SUMMARY.md)** - CLI AI features
- **[Docker Model Runner](../content/wiki/DOCKER_MODEL_RUNNER_SETUP.md)** - AI model deployment

### 📊 Data & Integrations
- **[Prisma pgvector Tests](PRISMA_PGVECTOR_TEST_RESULTS.md)** - Vector database integration
- **[Redis/Valkey Guide](../content/wiki/REDIS_VALKEY_INTEGRATION_GUIDE.md)** - Caching implementation
- **[Temporal Integration](../content/wiki/TEMPORAL_INTEGRATION_SUMMARY.md)** - Workflow orchestration
- **[Datadog Compatibility](DATADOG_COMPATIBILITY_SUMMARY.md)** - Monitoring setup

### 🔌 Extensions & Tools
- **[VS Code Extension Config](../content/wiki/VSCODE_EXTENSION_CONFIGURATION.md)** - Extension setup
- **[Mastra Integration](../content/wiki/MASTRA_INTEGRATION_GUIDE.md)** - Framework integration
- **[Microsoft Extensions](../content/wiki/MICROSOFT_VSCODE_EXTENSIONS_MIT_BSD.md)** - Licensed extensions
- **[Third Party Notices](../content/wiki/THIRD_PARTY_NOTICES_EXTENSIONS.md)** - Legal compliance

### 📈 Monitoring & Optimization
- **[Test Infrastructure](../content/wiki/TEST_INFRASTRUCTURE_SUMMARY.md)** - Testing framework
- **[Pre-commit Optimization](../content/wiki/PRECOMMIT_OPTIMIZATION_SUMMARY.md)** - Development workflow
- **[Comprehensive Test Report](../content/wiki/COMPREHENSIVE_TEST_REPORT.md)** - Latest test results
- **[KIND Validation](../content/wiki/KIND_VALIDATION_REPORT.md)** - Environment validation

### 📝 Configuration & Environment
- **[Environment Variables](ENV_VARIABLES.md)** - Configuration guide
- **[Development Credentials](../content/wiki/DEVELOPMENT_CREDENTIALS.md)** - Local development setup
- **[Documentation Plan](../content/wiki/DOCS_CONSOLIDATION_PLAN.md)** - Documentation strategy

### 📜 Legal & Compliance
- **[License Sweep](../content/wiki/LICENSE_SWEEP_GENAI_LIBRARIES.md)** - GenAI library licenses
- **[Contributing Guidelines](../content/wiki/CONTRIBUTING.md)** - How to contribute
- **[Code of Conduct](../content/wiki/CODE_OF_CONDUCT.md)** - Community standards

## 🔄 Recent Updates

### July 22, 2025
- ✅ **Docker Doctor TUI** - Complete interactive troubleshooting tool
- ✅ **Hypervisor Diagnostics** - Apple Silicon compatibility checks
- ✅ **CLI Automation** - Command-line flags and logging support
- ✅ **KIND Environment** - Fully operational with all services
- ✅ **Resource Management** - Memory optimization and cleanup

### July 21, 2025
- ✅ **Vector Database Abstraction** - Open-source only (pgvector, Chroma, Weaviate)
- ✅ **Unified AI Client** - LiteLLM-inspired multi-provider architecture
- ✅ **Agent Framework** - Multi-agent coordination system
- ✅ **Ollama Integration** - Local AI model support

## 🏃 Quick Commands

```bash
# Health check everything
./scripts/docker-doctor.sh diagnose

# Start KIND environment
npm run kind:setup  # wraps ./scripts/kind-setup.sh

# Access application
kubectl port-forward -n vibecode svc/vibecode-service 3000:3000

# Generate documentation
cd docs && npm run build
```

## 📧 Support

- **Issues:** [GitHub Issues](https://github.com/vibecode/webgui/issues)
- **Documentation:** This wiki
- **Status:** [Production Status](../../src/content/docs/production-status.md)

---

*This documentation is auto-generated and maintained by the VibeCode development team.*
