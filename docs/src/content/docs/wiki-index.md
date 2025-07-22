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

### 🏗️ Development & Operations
- **[Repository Scan Report](REPOSITORY_SCAN_REPORT_JULY_2025.md)** - Current project status
- **[Enhanced AI Features](ENHANCED_AI_FEATURES.md)** - New AI capabilities
- **[Missing AI Libraries Analysis](MISSING_AI_LIBRARIES_ANALYSIS.md)** - AI ecosystem gaps
- **[Authentication Guide](AUTHENTICATION_SUMMARY.md)** - Security implementation
- **[Testing Guide](AUTHENTICATION_TESTING_GUIDE.md)** - Authentication testing

### 🔧 Infrastructure & Deployment
- **[Azure Infrastructure](AZURE_INFRASTRUCTURE_SUMMARY.md)** - Cloud deployment
- **[Production Status](PRODUCTION_STATUS_REPORT.md)** - Current production state
- **[Comprehensive Testing](COMPREHENSIVE_TESTING_ASSESSMENT.md)** - Test coverage analysis
- **[Container Manifest](CONTAINER_MANIFEST.md)** - Container configurations

### 🤖 AI & Machine Learning
- **[GenAI Integration](GENAI_INTEGRATION_ARCHITECTURE.md)** - AI architecture
- **[GenAI Enhancement Summary](GENAI_ENHANCEMENT_SUMMARY.md)** - Recent AI improvements
- **[AI CLI Tools Implementation](AI_CLI_TOOLS_IMPLEMENTATION_SUMMARY.md)** - CLI AI features
- **[Docker Model Runner](DOCKER_MODEL_RUNNER_SETUP.md)** - AI model deployment

### 📊 Data & Integrations
- **[Prisma pgvector Tests](PRISMA_PGVECTOR_TEST_RESULTS.md)** - Vector database integration
- **[Redis/Valkey Guide](REDIS_VALKEY_INTEGRATION_GUIDE.md)** - Caching implementation
- **[Temporal Integration](TEMPORAL_INTEGRATION_SUMMARY.md)** - Workflow orchestration
- **[Datadog Compatibility](DATADOG_COMPATIBILITY_SUMMARY.md)** - Monitoring setup

### 🔌 Extensions & Tools
- **[VS Code Extension Config](VSCODE_EXTENSION_CONFIGURATION.md)** - Extension setup
- **[Mastra Integration](MASTRA_INTEGRATION_GUIDE.md)** - Framework integration
- **[Microsoft Extensions](MICROSOFT_VSCODE_EXTENSIONS_MIT_BSD.md)** - Licensed extensions
- **[Third Party Notices](THIRD_PARTY_NOTICES_EXTENSIONS.md)** - Legal compliance

### 📈 Monitoring & Optimization
- **[Test Infrastructure](TEST_INFRASTRUCTURE_SUMMARY.md)** - Testing framework
- **[Pre-commit Optimization](PRECOMMIT_OPTIMIZATION_SUMMARY.md)** - Development workflow
- **[Comprehensive Test Report](COMPREHENSIVE_TEST_REPORT.md)** - Latest test results
- **[KIND Validation](KIND_VALIDATION_REPORT.md)** - Environment validation

### 📝 Configuration & Environment
- **[Environment Variables](ENV_VARIABLES.md)** - Configuration guide
- **[Development Credentials](DEVELOPMENT_CREDENTIALS.md)** - Local development setup
- **[Documentation Plan](DOCS_CONSOLIDATION_PLAN.md)** - Documentation strategy

### 📜 Legal & Compliance
- **[License Sweep](LICENSE_SWEEP_GENAI_LIBRARIES.md)** - GenAI library licenses
- **[Contributing Guidelines](CONTRIBUTING.md)** - How to contribute
- **[Code of Conduct](CODE_OF_CONDUCT.md)** - Community standards

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
./scripts/kind-setup.sh

# Access application
kubectl port-forward -n vibecode svc/vibecode-service 3000:3000

# Generate documentation
cd docs && npm run build
```

## 📧 Support

- **Issues:** [GitHub Issues](https://github.com/vibecode/webgui/issues)
- **Documentation:** This wiki
- **Status:** [Production Status](PRODUCTION_STATUS_REPORT.md)

---

*This documentation is auto-generated and maintained by the VibeCode development team.*