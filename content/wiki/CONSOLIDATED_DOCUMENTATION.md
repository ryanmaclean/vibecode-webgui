# VibeCode Platform - Consolidated Documentation

This document consolidates key information from various documentation sources across the VibeCode platform, providing a unified reference for developers, operators, and users.

## 📋 Table of Contents

1. [Platform Overview](#platform-overview)
2. [Architecture & Components](#architecture--components)
3. [Monitoring & Observability](#monitoring--observability)
4. [AI Integration & Features](#ai-integration--features)
5. [Development & Deployment](#development--deployment)
6. [Performance & Scaling](#performance--scaling)
7. [Security & Compliance](#security--compliance)
8. [Troubleshooting & Support](#troubleshooting--support)

---

## Platform Overview

VibeCode is a cloud-native development platform that combines VS Code in the browser with comprehensive AI assistance, monitoring, and enterprise features.

### Key Features

**Core Platform:**
- **VS Code in Browser** - Full-featured IDE with zero setup via code-server
- **AI Project Generation** - Natural language to complete projects with Claude-3.5-Sonnet
- **Multi-AI Model Support** - 321+ AI models via OpenRouter integration
- **Kubernetes-Native** - Built for enterprise scale with KIND local development
- **Enterprise Security** - NextAuth with PostgreSQL sessions, rate limiting, API key protection

**AI & Integration:**
- **Unified AI Client** - Multi-provider access with automatic fallbacks
- **Agent Framework** - Multi-agent coordination for complex development
- **Local AI Models** - Ollama integration for privacy-first inference
- **Vector Databases** - pgvector, Chroma, Weaviate support
- **LiteLLM Proxy** - Production-ready multi-provider AI management

**Monitoring & Observability:**
- **Datadog Integration** - Real-time APM monitoring with comprehensive dashboards
- **OpenTelemetry** - Vendor-neutral observability alongside Datadog
- **Performance Testing** - K6 load testing and Lighthouse performance auditing
- **Database Monitoring** - Real-time PostgreSQL performance monitoring
- **LLM Observability** - Comprehensive AI operation tracking

### Platform Status (August 2025)

**✅ Production Ready:**
- AI project generation with Claude-3.5-Sonnet
- VS Code workspace provisioning
- Authentication and user management
- Comprehensive monitoring and alerting
- Performance testing and optimization
- Database monitoring with Datadog
- OpenTelemetry integration

**📊 Performance Metrics:**
- **Project Generation**: ~45s (95% success rate)
- **Workspace Provisioning**: ~8s
- **API Response Times**: 50% < 285ms, 90% < 828ms
- **Build Time**: 13.0s production build
- **Throughput**: 6.82 requests/sec sustained

---

## Architecture & Components

### Infrastructure Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client-Side   │───▶│   VibeCode API   │───▶│   Backend       │
│  (React/Next.js) │    │   (Next.js)      │    │   Services      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Monitoring    │    │   AI Gateway     │    │   Data Layer    │
│   (Datadog +    │    │   (OpenRouter +  │    │   (PostgreSQL + │
│   OpenTelemetry)│    │   LiteLLM)       │    │   Redis + Vector│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Core Components

**Frontend Layer:**
- **Next.js 15.4.4** - React framework with App Router
- **Tailwind CSS v4** - Utility-first CSS framework
- **TypeScript** - Type-safe development
- **Real-time UI** - WebSocket connections for live updates

**API Layer:**
- **Next.js API Routes** - RESTful and streaming endpoints
- **Authentication** - NextAuth with multi-provider support
- **Rate Limiting** - Redis-based protection (60 req/min)
- **Input Validation** - Zod schemas for request validation

**AI Integration:**
- **OpenRouter** - 321+ AI models with automatic failover
- **LiteLLM Proxy** - Unified API for multiple AI providers
- **Claude-3.5-Sonnet** - Primary model for code generation
- **Vector Search** - Semantic code search with pgvector

**Data Layer:**
- **PostgreSQL 15** - Primary database with pgvector extension
- **Redis 7** - Caching and session management
- **Prisma ORM** - Type-safe database access
- **File Storage** - Local filesystem with planned cloud storage

**Infrastructure:**
- **Kubernetes** - Container orchestration with KIND for local development
- **Docker** - Containerization with multi-stage builds
- **NGINX Ingress** - Load balancing and SSL termination
- **Helm Charts** - Package management for Kubernetes

### Service Architecture

**Monitoring Services:**
- **Datadog Agent + Cluster Agent** - Full observability platform
- **OpenTelemetry Collector** - Vendor-neutral telemetry
- **Prometheus** - Open source metrics collection
- **Vector** - High-performance log/metrics router

**AI Services:**
- **OpenRouter API** - Multi-model AI access
- **Local Ollama** - Privacy-first local inference
- **Embedding Service** - Vector generation for search
- **Claude Code CLI** - AI-powered development assistance

---

## Monitoring & Observability

### Datadog Integration

**Core Features:**
- **APM Tracing** - Request flow tracking across services
- **Custom Metrics** - Business and technical metrics via StatsD
- **Real-time Dashboards** - Three specialized dashboards
- **Critical Alerts** - Automated monitoring with escalation
- **Database Monitoring** - PostgreSQL performance tracking

**Dashboard Setup:**
```bash
# Initialize Datadog monitoring
npm run monitoring:setup

# Check monitoring health
npm run monitoring:health

# View metrics configuration
npm run monitoring:metrics
```

**Key Dashboards:**

1. **AI Features Monitoring**
   - AI requests by provider and model
   - Response times and success rates
   - Token usage and costs
   - Terminal session tracking

2. **User Experience Dashboard**
   - Page load times by route
   - User action tracking
   - Session analytics
   - Error rate monitoring

3. **Infrastructure Health**
   - Service health checks
   - Database and Redis performance
   - System resource utilization
   - Network and storage metrics

### OpenTelemetry Integration

**Architecture:**
- **Server-side Instrumentation** - HTTP, Express, database operations
- **Client-side Tracing** - Browser performance and user interactions
- **Vendor-neutral Exporters** - OTLP and Prometheus compatibility
- **Trace Collection API** - Custom trace processing endpoint

**Configuration:**
```bash
# Enable OpenTelemetry
export OTEL_ENABLED=true
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces

# Setup OpenTelemetry
npm run otel:setup

# Check configuration
npm run otel:config
```

**Key Features:**
- Auto-instrumentation for HTTP requests and database queries
- Custom span creation for business logic
- Browser performance tracking
- Datadog correlation for unified observability

### Performance Testing

**K6 Load Testing:**
- Baseline testing (5 concurrent users)
- Spike testing (25 concurrent users)
- Stress testing (sustained load)
- Custom metrics for API endpoints

**Lighthouse Performance:**
- Core Web Vitals tracking
- Performance budget validation
- Automated auditing in CI/CD
- Mobile and desktop testing

**Monitoring Integration:**
```bash
# Run comprehensive performance tests
npm run test:performance

# Run specific test types
npm run test:performance:k6
npm run test:performance:lighthouse
```

---

## AI Integration & Features

### Multi-Provider AI Gateway

**OpenRouter Integration:**
- **321+ Models** - Access to latest AI models from multiple providers
- **Automatic Failover** - Seamless switching between providers
- **Cost Optimization** - Provider selection based on cost and performance
- **Rate Limiting** - Built-in quota management

**LiteLLM Proxy:**
- **Unified API** - Single interface for all AI providers
- **Load Balancing** - Request distribution across endpoints
- **Caching** - Semantic caching for improved performance
- **Monitoring** - Request tracking and usage analytics

**Supported Providers:**
- **Anthropic** - Claude models for reasoning and code
- **OpenAI** - GPT models for general tasks
- **Google** - Gemini models for multimodal tasks
- **Local Ollama** - Privacy-first local inference
- **Azure OpenAI** - Enterprise AI services
- **AWS Bedrock** - Cloud-native AI platform

### AI Project Generation

**Workflow:**
1. **Natural Language Input** - User describes desired project
2. **Context Analysis** - Extract requirements and constraints
3. **Architecture Planning** - Generate project structure
4. **Code Generation** - Create complete file tree with content
5. **Workspace Provisioning** - Set up development environment
6. **Quality Validation** - Ensure generated code quality

**Example Usage:**
```bash
curl -X POST /api/ai/generate-project \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a React todo app with authentication and database",
    "projectName": "my-todo-app",
    "language": "typescript",
    "framework": "react"
  }'
```

**Features:**
- **Complete Projects** - Generate entire application scaffolds
- **Multiple Languages** - Support for JavaScript, TypeScript, Python, Rust
- **Framework Integration** - React, Next.js, Vue, Svelte templates
- **Database Integration** - Automatic database schema generation
- **Authentication** - Built-in auth system setup

### Vector Search & RAG

**pgvector Integration:**
- **Semantic Search** - Vector similarity search for code
- **Embedding Generation** - OpenAI embeddings for content
- **Similarity Queries** - Find related code snippets
- **Performance Optimization** - Indexed vector operations

**RAG Implementation:**
```sql
-- Vector similarity search
SELECT file_path, content 
FROM code_embeddings 
ORDER BY embedding <-> '[0.1, 0.2, ...]'::vector 
LIMIT 10;
```

**Use Cases:**
- **Code Search** - Find similar functions or patterns
- **Documentation** - Context-aware help and examples  
- **Code Completion** - Intelligent suggestions based on context
- **Knowledge Base** - Semantic search across project documentation

---

## Development & Deployment

### Local Development

**Prerequisites:**
- Node.js 18.17+ (20.11.0 recommended)
- Docker Desktop for containerization
- Git for version control
- Optional: kubectl and KIND for Kubernetes testing

**Quick Start:**
```bash
# Clone and setup
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui

# Install dependencies
npm install --legacy-peer-deps

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your API keys

# Start development server
npm run dev:cdn  # CDN mode (fastest startup)
# or
npm run dev      # Standard mode
```

**Development Modes:**

1. **CDN Mode** (Recommended for Development)
   ```bash
   npm run dev:cdn
   # ✓ Fastest startup (< 2s)
   # ✓ No native module compilation
   # ✓ Perfect for ARM64 macOS
   ```

2. **Docker Mode** (Production Testing)
   ```bash
   npm run dev:docker
   # ✓ Container-based environment
   # ✓ Tests production Docker build
   ```

3. **Standard Mode**
   ```bash
   npm run dev
   # ✓ Full PostCSS integration
   # ⚠ May require native module rebuilds
   ```

### Production Deployment

**Deployment Options:**

1. **Kubernetes with Helm**
   ```bash
   # Deploy with Helm
   helm install vibecode ./helm/vibecode-platform \
     --namespace vibecode \
     --set ingress.host=your-domain.com
   ```

2. **KIND Local Cluster**
   ```bash
   # Create cluster
   kind create cluster --name=vibecode-test --config=kind-config.yaml
   
   # Deploy application
   kubectl apply -f k8s/
   ```

3. **Azure Kubernetes Service**
   ```bash
   # One-click deployment
   # See infrastructure/terraform/azure/ for details
   terraform apply
   ```

**Environment Configuration:**
```bash
# Core application
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
NEXTAUTH_URL=https://vibecode.yourdomain.com
NEXTAUTH_SECRET=your-secure-secret

# AI Integration
OPENROUTER_API_KEY=sk-or-v1-your-key

# Monitoring
DATADOG_API_KEY=your-datadog-key
OTEL_ENABLED=true
```

### CI/CD Pipeline

**GitHub Actions Workflow:**
- **Code Quality** - ESLint, TypeScript checking, security scans
- **Testing** - Unit, integration, and E2E tests
- **Performance Testing** - K6 load tests and Lighthouse audits
- **Monitoring Validation** - Health checks and configuration validation
- **Multi-platform Builds** - Docker images for AMD64 and ARM64

**Pipeline Stages:**
1. **Code Quality & Security** - Parallel validation jobs
2. **Test Suite** - Matrix testing with PostgreSQL and Redis services
3. **E2E Testing** - Playwright tests with full application stack
4. **Monitoring Validation** - Datadog and OpenTelemetry endpoint testing
5. **Build & Performance** - Production builds with performance validation
6. **Final Validation** - Complete CI/CD status verification

---

## Performance & Scaling

### Performance Optimization

**Application Performance:**
- **Response Times**: 50% of requests < 285ms, 90% < 828ms  
- **Build Optimization**: 13.0s production build time
- **Memory Efficiency**: Optimized for 1-2GB memory usage
- **Database Optimization**: Connection pooling and query optimization

**Caching Strategy:**
- **Redis Caching** - Session data and frequently accessed content
- **Application Caching** - In-memory caching for API responses
- **CDN Integration** - Static asset delivery optimization
- **Database Query Caching** - Prisma query result caching

**Performance Testing:**
```bash
# Comprehensive performance testing
npm run test:performance:ci

# Specific test types
npm run performance:baseline  # Baseline load testing
npm run performance:stress    # Stress testing
```

### Scaling Architecture

**Horizontal Scaling:**
- **Kubernetes Auto-scaling** - Pod horizontal scaling based on CPU/memory
- **Database Read Replicas** - PostgreSQL read scaling
- **Redis Clustering** - Cache layer scaling
- **CDN Distribution** - Global content delivery

**Resource Requirements:**

**Development (Minimum):**
```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

**Production (Recommended):**
```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"  
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

### Load Balancing & High Availability

**Load Balancing:**
- **NGINX Ingress** - Layer 7 load balancing with SSL termination
- **Kubernetes Services** - Internal service discovery and load balancing
- **Database Connection Pooling** - PgBouncer for PostgreSQL connections
- **Redis Sentinel** - High availability for cache layer

**High Availability:**
- **Multi-zone Deployment** - Cross-AZ resource distribution
- **Database Backup** - Automated PostgreSQL backups with point-in-time recovery
- **Health Checks** - Comprehensive health monitoring with automatic failover
- **Disaster Recovery** - Backup and restore procedures

---

## Security & Compliance

### Authentication & Authorization

**Authentication System:**
- **NextAuth.js** - Multi-provider authentication
- **PostgreSQL Sessions** - Secure session storage
- **JWT Tokens** - Stateless authentication for APIs
- **Password Hashing** - bcrypt for secure password storage

**Supported Providers:**
- **GitHub OAuth** - Developer-focused authentication
- **Google OAuth** - Enterprise SSO integration
- **Credentials** - Traditional username/password
- **Magic Links** - Passwordless authentication

### API Security

**Protection Mechanisms:**
- **Rate Limiting** - Redis-based request limiting (60 req/min)
- **Input Validation** - Zod schemas for all API endpoints
- **CORS Configuration** - Cross-origin request protection
- **API Key Management** - Secure key storage and rotation

**Security Scanning:**
```bash
# Comprehensive security scan
./scripts/security-scan.sh

# Pre-commit security checks
git commit  # Automatically runs security validation
```

### API Key Protection

**Multi-layer Security:**
- **Pre-commit Hooks** - Automatic API key detection before commits
- **Pattern Matching** - Detection of OpenAI, Anthropic, Datadog, GitHub keys
- **BFG Integration** - Git history scanning with Docker
- **Environment Isolation** - Secure key storage in environment variables

**Protected Patterns:**
- **OpenAI/OpenRouter**: `sk-*` (40+ characters)
- **Anthropic**: `sk-ant-*` (40+ characters)
- **Datadog**: 32 hex character keys
- **GitHub**: `ghp_*`, `gho_*`, `ghu_*` tokens
- **AWS**: `AKIA*` access keys
- **Stripe**: `sk_*` secret keys

### Compliance & Standards

**WCAG 2.1 AA Compliance:**
- **Automated Testing** - jest-axe integration for accessibility
- **Contrast Validation** - Automated color contrast checking
- **Screen Reader Support** - ARIA labels and semantic HTML
- **Keyboard Navigation** - Full keyboard accessibility
- **ESLint Accessibility** - Development-time accessibility linting

**Data Protection:**
- **Encryption at Rest** - Database and file system encryption
- **TLS/SSL** - All data in transit encrypted
- **Data Retention** - Configurable retention policies
- **GDPR Compliance** - User data management and deletion

---

## Troubleshooting & Support

### Common Issues

**1. Installation & Setup Issues**

*Node.js version not supported:*
```bash
# Install correct Node.js version
nvm install 20.11.0 && nvm use 20.11.0
# Or use npx for one-time usage
npx -p node@20.11.0 npm run dev:cdn
```

*Build fails with native module errors:*
```bash
# Use CDN mode to avoid native module compilation
npm run dev:cdn
```

*Docker build failures:*
```bash
# Use simplified Docker configuration
docker build -f Dockerfile.simple -t vibecode .
```

**2. Database Connection Issues**

*PostgreSQL connection failures:*
```bash
# Check PostgreSQL service
kubectl get pods -l app=postgres -n vibecode
kubectl logs -l app=postgres -n vibecode

# Test connection
kubectl exec -it deployment/postgres -n vibecode -- \
  psql -U vibecode -d vibecode -c "SELECT 1;"
```

*Redis connection issues:*
```bash
# Verify Redis connectivity
redis-cli ping  # Should return PONG
kubectl logs -l app=redis -n vibecode
```

**3. AI Integration Problems**

*OpenRouter API failures:*
```bash
# Verify API key
curl -H "Authorization: Bearer YOUR_KEY" \
  https://openrouter.ai/api/v1/models

# Check API key format (should start with sk-or-v1-)
echo $OPENROUTER_API_KEY
```

*AI response timeouts:*
```bash
# Check API endpoint health
curl -f http://localhost:3000/api/ai/chat/enhanced
```

**4. Monitoring & Observability Issues**

*Datadog metrics not appearing:*
```bash
# Verify Datadog configuration
npm run monitoring:health

# Test metric submission
curl -X POST http://localhost:3000/api/monitoring/metrics \
  -H "Content-Type: application/json" \
  -d '{"type": "gauge", "name": "test.metric", "value": 42}'
```

*OpenTelemetry traces missing:*
```bash
# Check OpenTelemetry configuration
npm run otel:config

# Verify trace collection
curl -s http://localhost:3000/api/monitoring/traces
```

### Debugging Commands

**Health Checks:**
```bash
# Application health
curl http://localhost:3000/api/health

# Monitoring dashboard
curl http://localhost:3000/api/monitoring/dashboard | jq

# OpenTelemetry status
curl http://localhost:3000/api/monitoring/otel-config?action=health | jq
```

**Kubernetes Debugging:**
```bash
# Pod status
kubectl get pods -n vibecode

# Pod logs
kubectl logs <pod-name> -n vibecode

# Service connectivity
kubectl run curl --image=curlimages/curl --rm -it -- \
  curl http://vibecode-service.vibecode.svc.cluster.local:3000/api/health
```

**Performance Testing:**
```bash
# Comprehensive performance test
npm run test:performance

# Individual test components
npm run test:performance:k6
npm run test:performance:lighthouse
```

### Support Resources

**Documentation:**
- **Main Documentation**: [VibeCode Documentation](https://ryanmaclean.github.io/vibecode-webgui/)
- **API Reference**: Auto-generated from OpenAPI specs
- **Architecture Guide**: See `IMPLEMENTATION_COMPLETE.md`

**Community Support:**
- **GitHub Issues**: [Project Issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
- **GitHub Discussions**: [Community Forum](https://github.com/ryanmaclean/vibecode-webgui/discussions)
- **Discord**: Community chat and support

**Development Resources:**
- **Contributing Guide**: `CONTRIBUTING.md`
- **Code of Conduct**: `CODE_OF_CONDUCT.md`
- **Security Policy**: `SECURITY.md`

---

## Appendix

### Version Information
- **Platform Version**: 1.0.0
- **Next.js**: 15.4.4
- **Node.js**: 18.17+ (20.11.0 recommended)
- **TypeScript**: 5.8.3
- **Tailwind CSS**: v4.0.0
- **PostgreSQL**: 15+ with pgvector
- **Redis**: 7+
- **Kubernetes**: 1.28+

### Related Documentation
- **[Documentation Index](./DOCUMENTATION_INDEX.md)** - Complete documentation navigation
- **[Datadog Monitoring](./DATADOG_MONITORING.md)** - Detailed monitoring setup
- **[OpenTelemetry Integration](./OPENTELEMETRY_INTEGRATION.md)** - Observability configuration
- **[README.md](../README.md)** - Project overview and quick start

### Last Updated
This document was last updated on August 8, 2025, as part of the documentation consolidation effort (Issue #86).

---

*This consolidated documentation provides a comprehensive overview of the VibeCode platform. For specific implementation details, refer to the individual documentation files linked throughout this document.*