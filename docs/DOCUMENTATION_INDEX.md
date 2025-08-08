# VibeCode Documentation Index

This document serves as the central navigation hub for all VibeCode platform documentation.

## 📖 Core Documentation

### Getting Started
- **[README.md](../README.md)** - Main project overview, quick start, and installation
- **[Quick Start Guide](./guides/quick-start.md)** - Step-by-step setup instructions
- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment options

### Architecture & Development
- **[Architecture Overview](../IMPLEMENTATION_COMPLETE.md)** - System architecture and design decisions
- **[Development Setup](./guides/development-setup.md)** - Local development environment
- **[Contributing Guidelines](../CONTRIBUTING.md)** - How to contribute to the project
- **[Code of Conduct](../CODE_OF_CONDUCT.md)** - Community guidelines

## 🛠️ Technical Documentation

### Monitoring & Observability
- **[Datadog Monitoring](./DATADOG_MONITORING.md)** - Comprehensive monitoring setup
- **[OpenTelemetry Integration](./OPENTELEMETRY_INTEGRATION.md)** - Vendor-neutral observability
- **[Performance Testing](../tests/performance/README.md)** - Load testing and performance monitoring
- **[Database Monitoring](./database-monitoring.md)** - PostgreSQL performance tracking

### AI & Integration
- **[AI Features Overview](./NEW_FEATURES.md)** - AI capabilities and integrations
- **[LiteLLM Integration](./LITELLM_INTEGRATION_SUMMARY.md)** - Multi-provider AI gateway
- **[App Generator](./app-generator.md)** - AI-powered project generation
- **[OSS Tools Integration](./oss-tools-integration.md)** - Open source tool integrations

### Infrastructure & Deployment
- **[Kubernetes Deployment](../k8s/README.md)** - Kubernetes manifests and setup
- **[Docker Configuration](../docker/README.md)** - Container setup and optimization
- **[Azure Infrastructure](../infrastructure/terraform/azure/README.md)** - Azure deployment guide
- **[Helm Charts](../helm/README.md)** - Kubernetes package management

## 🧪 Testing & Quality Assurance

### Testing Guides
- **[Test Coverage Report](./test-coverage.md)** - Testing strategy and coverage
- **[Comprehensive Testing Guide](./src/content/docs/COMPREHENSIVE_TESTING_GUIDE.md)** - Complete testing methodology
- **[Performance Testing](../scripts/run-performance-tests.js)** - Load testing and benchmarks

### Security & Compliance
- **[Security Guidelines](../SECURITY.md)** - Security best practices
- **[API Key Protection](../scripts/security-scan.sh)** - Secret management and scanning
- **[Compliance Documentation](./src/content/docs/COMPONENT_ONBOARDING_CHECKLIST.md)** - WCAG 2.1 AA compliance

## 📊 Operations & Maintenance

### Monitoring & Analytics
- **[Health Monitoring](./monitoring/overview.md)** - System health and alerting
- **[Performance Metrics](../PERFORMANCE_METRICS.md)** - Key performance indicators
- **[Troubleshooting Guide](./TROUBLESHOOTING.md)** - Common issues and solutions

### Data & Storage
- **[Database Schema](../prisma/schema.prisma)** - Database structure and relationships
- **[Environment Variables](./src/content/docs/ENV_VARIABLES.md)** - Configuration reference
- **[Backup & Recovery](./operations/backup-recovery.md)** - Data protection strategies

## 🌐 User Documentation

### User Guides
- **[User Manual](./user-guide/README.md)** - End-user documentation
- **[API Reference](./api/README.md)** - REST API documentation
- **[SDK Documentation](./sdk/README.md)** - Client library guides

### Features & Capabilities
- **[AI Assistant Features](./features/ai-assistant.md)** - AI capabilities and usage
- **[Workspace Management](./features/workspaces.md)** - Development environment management
- **[Authentication & Authorization](./features/auth.md)** - User management and security

## 🔧 Development Resources

### Development Tools
- **[VS Code Integration](../extensions/vibecode-ai-assistant/README.md)** - Editor integration
- **[CLI Tools](./tools/cli.md)** - Command-line utilities
- **[API Testing](./development/api-testing.md)** - Testing and debugging APIs

### Extension Development
- **[Extension Guide](./development/extensions.md)** - Building custom extensions
- **[Plugin Architecture](./development/plugins.md)** - Plugin system documentation
- **[Custom Integrations](./development/integrations.md)** - Third-party integration guide

## 📚 Specialized Topics

### AI & Machine Learning
- **[Model Integration](./ai/model-integration.md)** - Adding new AI models
- **[Vector Search](./ai/vector-search.md)** - Semantic search implementation
- **[RAG Implementation](./ai/rag.md)** - Retrieval-Augmented Generation

### Performance & Scaling
- **[Performance Optimization](./performance/optimization.md)** - Performance tuning guide
- **[Scaling Strategy](./performance/scaling.md)** - Horizontal and vertical scaling
- **[Caching Strategy](./performance/caching.md)** - Redis and application caching

### Cloud & Infrastructure
- **[Multi-Cloud Deployment](./cloud/multi-cloud.md)** - AWS, Azure, GCP deployment
- **[CDN Configuration](./cloud/cdn.md)** - Content delivery network setup
- **[Load Balancing](./cloud/load-balancing.md)** - Traffic distribution strategies

## 📋 Reference Materials

### Configuration References
- **[Environment Variables](./reference/environment-variables.md)** - Complete configuration reference
- **[Dockerfile Reference](./reference/dockerfile.md)** - Container configuration options
- **[Kubernetes Manifests](./reference/kubernetes.md)** - K8s resource specifications

### API References
- **[REST API](./api/rest-api.md)** - HTTP API endpoints and schemas
- **[WebSocket API](./api/websocket-api.md)** - Real-time communication API
- **[GraphQL API](./api/graphql-api.md)** - GraphQL schema and operations

## 🚀 Migration & Upgrade Guides

### Version Migrations
- **[Migration Guide](./migrations/README.md)** - Version upgrade instructions
- **[Breaking Changes](./migrations/breaking-changes.md)** - API and configuration changes
- **[Legacy Support](./migrations/legacy-support.md)** - Backward compatibility

### Technology Upgrades
- **[Tailwind v4 Migration](../TAILWIND_V4_MIGRATION_NOTES.md)** - CSS framework upgrade
- **[Node.js Upgrades](./migrations/nodejs-upgrades.md)** - Runtime version updates
- **[Database Migrations](./migrations/database-migrations.md)** - Schema evolution

## 🎯 Quick Links

### Most Frequently Accessed
1. [Getting Started](../README.md#quick-start)
2. [API Documentation](./api/README.md)
3. [Deployment Guide](./DEPLOYMENT.md)
4. [Troubleshooting](./TROUBLESHOOTING.md)
5. [Environment Setup](./guides/development-setup.md)

### Developer Resources
1. [Contributing Guide](../CONTRIBUTING.md)
2. [Architecture Overview](../IMPLEMENTATION_COMPLETE.md)
3. [Testing Guide](./test-coverage.md)
4. [Performance Monitoring](./DATADOG_MONITORING.md)
5. [Security Guidelines](../SECURITY.md)

### Operations
1. [Health Monitoring](./monitoring/overview.md)
2. [Backup Procedures](./operations/backup-recovery.md)
3. [Incident Response](./operations/incident-response.md)
4. [Capacity Planning](./operations/capacity-planning.md)
5. [Maintenance Windows](./operations/maintenance.md)

---

## 📝 Documentation Maintenance

This index is maintained as part of the documentation consolidation effort (Issue #86). 

### Contributing to Documentation
- Follow the [Documentation Style Guide](./style-guide.md)
- Use consistent formatting and structure
- Include code examples and practical guidance
- Update this index when adding new documentation
- Ensure all links are functional and up-to-date

### Documentation Standards
- **Markdown Format**: All documentation should be in Markdown (.md) format
- **Clear Structure**: Use consistent heading hierarchy and navigation
- **Code Examples**: Include practical, working code examples
- **Cross-References**: Link to related documentation sections
- **Regular Updates**: Keep documentation synchronized with code changes

Last updated: August 8, 2025