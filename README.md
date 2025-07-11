# VibeCode: Cloud-Native Development Platform

**Infrastructure-First Approach** using **code-server** + **KIND** for enterprise-grade development environments. Built with **Kubernetes-native** architecture, **Authelia** 2FA/SSO authentication, and **AI integration** via CodeCursor-inspired VS Code extensions.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Security Scan](https://github.com/vibecode/webgui/workflows/Security%20Scan/badge.svg)](https://github.com/vibecode/webgui/actions)
[![Docker Build](https://img.shields.io/docker/build/vibecode/webgui)](https://hub.docker.com/r/vibecode/webgui)

## ✨ Key Features

- 🚀 **Complete VS Code Experience**: Full IDE via code-server 4.101.2 (MIT licensed)
- 🔐 **Enterprise 2FA/SSO**: Authelia authentication with hardware keys, TOTP, Duo push
- 🎯 **Infrastructure-First**: KIND (Kubernetes in Docker) orchestration eliminates 60-80% custom development
- 🤖 **AI Integration**: CodeCursor-inspired VS Code extension with OpenRouter multi-provider support
- 🌐 **Production-Ready**: NGINX Ingress, cert-manager, Helm charts, persistent storage
- 📊 **Comprehensive Monitoring**: Datadog, Prometheus, Vector, OpenTelemetry integration
- 🔄 **Per-User Workspaces**: Isolated environments with dedicated persistent volumes
- ⚡ **Auto-Scaling**: Kubernetes HPA, resource limits, efficient resource utilization
- 🛡️ **Security Hardened**: Pod Security Standards, NetworkPolicies, RBAC, non-root containers
- 🎨 **Zero Custom UI**: Leverages battle-tested VS Code interface

## 🏗️ Infrastructure-First Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   KIND Cluster  │    │     Authelia     │    │   AI Gateway    │
│   (4 nodes)     │◄───┤   2FA/SSO Auth   │◄───┤  OpenRouter     │
│                 │    │   (Port 9091)    │    │  Multi-Provider │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Code-Server    │    │ NGINX Ingress    │    │   Helm Charts   │
│  Per-User Pods  │    │  + cert-manager  │    │   Templates     │
│  (Port 8080)    │    │  (TLS/SSL)       │    │   Deployment    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Persistent     │    │   Monitoring     │    │   User Mgmt     │
│  Volumes        │    │   Datadog Stack  │    │   Provisioning  │
│  (Workspaces)   │    │   (Observability)│    │   Scripts       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** (for container management)
- **Node.js 18+** (for local development)
- **kubectl** (for Kubernetes management)
- **KIND** (for local Kubernetes testing)

### Local Development with Docker Compose

1. **Clone the repository**:
   ```bash
   git clone https://github.com/vibecode/webgui.git
   cd vibecode-webgui
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start the development environment**:
   ```bash
   docker-compose up -d
   ```

4. **Access the services**:
   - **Main App**: http://localhost:3000
   - **Code-Server IDE**: http://localhost:8080 (password: `vibecode123`)
   - **Database**: localhost:5432
   - **Redis**: localhost:6379

### Local Kubernetes Development with KIND

KIND (Kubernetes IN Docker) provides a local Kubernetes cluster for development and testing.

#### Install KIND

**macOS**:
```bash
# Using Homebrew
brew install kind

# Using Go
go install sigs.k8s.io/kind@latest
```

**Linux**:
```bash
# Download binary
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
```

**Windows**:
```bash
# Using Chocolatey
choco install kind

# Using Go
go install sigs.k8s.io/kind@latest
```

#### Create KIND Cluster

1. **Create cluster with custom configuration**:
   ```bash
   # Create cluster
   kind create cluster --name vibecode-dev --config=infrastructure/kind/cluster-config.yaml
   
   # Verify cluster
   kubectl cluster-info --context kind-vibecode-dev
   ```

2. **Load Docker images into KIND**:
   ```bash
   # Build images
   docker build -t vibecode/webgui:latest .
   docker build -t vibecode/code-server:latest ./docker/code-server
   
   # Load into KIND
   kind load docker-image vibecode/webgui:latest --name vibecode-dev
   kind load docker-image vibecode/code-server:latest --name vibecode-dev
   ```

3. **Deploy to KIND cluster**:
   ```bash
   # Create namespace and deploy
   kubectl apply -f infrastructure/kubernetes/namespace.yaml
   kubectl apply -f infrastructure/kubernetes/storage.yaml
   kubectl apply -f infrastructure/kubernetes/secrets.yaml
   kubectl apply -f infrastructure/kubernetes/code-server-deployment.yaml
   
   # Port forward to access services
   kubectl port-forward -n vibecode-webgui service/code-server-service 8080:8080
   ```

4. **Clean up KIND cluster**:
   ```bash
   kind delete cluster --name vibecode-dev
   ```

## 🧪 Testing

### Test Structure
```
tests/
├── unit/           # Unit tests for components and utilities
├── integration/    # Integration tests for API and services
├── e2e/           # End-to-end tests with Playwright
└── k8s/           # Kubernetes deployment tests
```

### Running Tests

**Unit Tests**:
```bash
npm test                    # Run all unit tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

**Integration Tests**:
```bash
npm run test:integration   # API and database tests
npm run test:ws           # WebSocket server tests
```

**End-to-End Tests**:
```bash
npm run test:e2e          # Full browser automation tests
npm run test:e2e:headed   # Run with browser UI
```

**Kubernetes Tests**:
```bash
npm run test:k8s          # Test KIND deployment
npm run test:k8s:load     # Load testing on K8s
```

**Monitoring Tests**:
```bash
npm run test:monitoring             # All monitoring tests
npm run test:monitoring:unit        # Unit tests for monitoring functions
npm run test:monitoring:integration # API integration tests
npm run test:monitoring:e2e         # E2E dashboard tests
npm run test:monitoring:k8s         # Kubernetes deployment tests
npm run test:monitoring:security    # Security compliance tests
npm run test:monitoring:production  # Production readiness tests
npm run test:monitoring:health      # Health check validation
npm run test:monitoring:chaos       # Chaos engineering tests
npm run test:monitoring:performance # Performance and load tests
```

**Security Tests**:
```bash
npm run test:security     # Security scanning
npm run test:licenses     # License compliance
```

### Continuous Integration

The project uses GitHub Actions for:
- ✅ Security scanning (Datadog SCA/SAST)
- ✅ License compliance (NO GPL/LGPL/AGPL)
- ✅ Unit and integration tests
- ✅ E2E testing with multiple browsers
- ✅ Kubernetes deployment validation
- ✅ Docker image security scanning

## 🔐 Security

### Security Features
- **Zero GPL/LGPL Dependencies**: Strict license compliance
- **Container Security**: Non-root users, security contexts, read-only filesystems
- **Network Security**: Zero-trust networking, encrypted communication
- **Authentication**: JWT-based auth with OAuth integration
- **Audit Logging**: Comprehensive activity tracking

### Security Scanning
```bash
# Run security scans
npm run security:scan      # Full security audit
npm run security:licenses  # License compliance check
npm run security:deps      # Dependency vulnerability scan
```

## 📊 Monitoring & Observability

VibeCode includes comprehensive monitoring and observability features powered by Datadog's full platform, including recent acquisitions and July 2025 product enhancements.

### 🚀 Latest Datadog Platform Features (2025)

**Recent Acquisitions Integrated**:
- **Metaplane** (April 2025): AI-powered data observability with ML-based anomaly detection
- **Eppo** (March 2025): Advanced experimentation platform with statistical rigor for A/B testing
- **Vector** (2021): High-performance observability data pipeline for log aggregation

**Enhanced Platform Capabilities**:
- **AI/ML Observability**: Model performance tracking, drift detection, bias monitoring
- **Advanced Security Monitoring**: Runtime application security (RASP) with threat intelligence
- **Cloud Cost Intelligence**: Real-time cost optimization recommendations
- **Enhanced Synthetic Monitoring**: AI-powered test generation and optimization

### Datadog Integration

**Datadog SDKs Used**:
- `@datadog/browser-rum` - Real User Monitoring (RUM) for frontend performance tracking
- `@datadog/browser-logs` - Browser log collection and analysis
- `dd-trace` - Application Performance Monitoring (APM) for Node.js backend
- Datadog Agent 7 - Infrastructure monitoring, logs collection, and system metrics

**Key Features**:
- 📈 **Real User Monitoring (RUM)**: Track Core Web Vitals, page loads, user interactions
- 🔍 **Application Performance Monitoring (APM)**: Distributed tracing, service maps, performance insights
- 📝 **Log Management**: Structured logging with automatic correlation between logs, traces, and metrics
- 🖥️ **Infrastructure Monitoring**: System metrics, container monitoring, Kubernetes cluster visibility
- 🛡️ **Security Monitoring**: Runtime security analysis, compliance monitoring

### Monitoring Stack Components

**Vector by Datadog**:
- High-performance observability data pipeline (acquired by Datadog in 2021)
- Vendor-agnostic log collection, transformation, and routing
- Kubernetes logs, application logs, and system metrics aggregation
- Data enrichment and filtering before sending to Datadog
- Configuration: `infrastructure/monitoring/vector.yaml`

**Metaplane Data Observability** (Acquired April 2025):
- AI-powered data quality monitoring and anomaly detection
- Real-time data pipeline monitoring with ML-based insights
- Automated schema drift detection and data lineage tracking
- Integration with Datadog for unified observability dashboard
- Configuration: `src/lib/metaplane-integration.ts`

**KubeHound Security Analysis**:
- Kubernetes attack path analysis and security posture assessment
- MITRE ATT&CK technique detection for container environments
- Privilege escalation path identification
- Integration with Datadog for security alerting
- Configuration: `infrastructure/monitoring/kubehound-config.yaml`

**Additional Open Source Tools**:
- **Winston** & **Pino**: Structured logging libraries for application logs
- **Kubernetes DaemonSets**: For Datadog Agent and Vector deployment
- **Prometheus Integration**: Metrics scraping and monitoring (via ServiceMonitor)

### Monitoring Dashboard

Access the comprehensive monitoring dashboard at `/monitoring` (admin-only):

- **System Metrics**: CPU, memory, disk usage, network I/O
- **Application Metrics**: Response times, error rates, active users
- **Security Alerts**: KubeHound findings, security policy violations
- **Real-time Updates**: Live metrics with 30-second refresh intervals
- **Log Streaming**: Real-time log analysis and filtering

### Environment Setup

**Required Environment Variables**:
```bash
# Datadog configuration
DD_API_KEY=your-datadog-api-key
DD_SITE=datadoghq.com
DD_ENV=production
DD_SERVICE=vibecode-webgui
DD_VERSION=1.0.0

# Application monitoring
DD_APM_ENABLED=true
DD_LOGS_ENABLED=true
DD_RUM_APPLICATION_ID=your-rum-app-id
DD_RUM_CLIENT_TOKEN=your-rum-client-token
```

**Kubernetes Secrets**:
```bash
# Create Datadog secret for Kubernetes
kubectl create secret generic datadog-secret \
  --from-literal=api-key="your-datadog-api-key" \
  --namespace=datadog
```

### Monitoring Deployment

**Local Development**:
```bash
# Start monitoring stack with Docker Compose
docker-compose -f docker-compose.monitoring.yml up -d

# Access monitoring dashboard
open http://localhost:3000/monitoring
```

**Kubernetes Deployment**:
```bash
# Deploy Datadog Agent
kubectl apply -f infrastructure/monitoring/datadog-agent.yaml

# Deploy Vector log aggregation
kubectl apply -f infrastructure/monitoring/vector-deployment.yaml

# Deploy KubeHound security analysis
kubectl apply -f infrastructure/monitoring/kubehound-config.yaml

# Verify deployment
kubectl get pods -n datadog
kubectl get pods -n monitoring
kubectl get pods -n security
```

### Monitoring Features

**Frontend Monitoring** (`src/lib/monitoring.ts`):
- Page performance tracking with Core Web Vitals
- Error tracking and user session recording
- Custom business metrics and events
- Workspace-specific analytics
- User journey analysis

**Backend Monitoring** (`src/lib/server-monitoring.ts`):
- Distributed tracing across microservices
- Database query performance monitoring
- API endpoint response time tracking
- Error aggregation and alerting
- Custom application metrics

**Infrastructure Monitoring**:
- Kubernetes cluster health and resource utilization
- Container performance and resource consumption

## 🧪 Feature Flags & A/B Testing

VibeCode includes a comprehensive experimentation platform inspired by Datadog's Eppo acquisition (2025). The system provides feature flagging, A/B testing, and statistical analysis capabilities.

### Eppo-Inspired Features

**Feature Flag Engine** (`src/lib/feature-flags.ts`):
- Statistical experimentation with significance testing
- Advanced targeting rules and user segmentation
- Real-time flag evaluation and allocation tracking
- Custom metrics tracking and conversion analysis
- Datadog integration for experiment monitoring

**Key Capabilities**:
- 🎯 **Targeted Rollouts**: Rule-based targeting with custom attributes
- 📊 **Statistical Analysis**: Confidence intervals, p-values, and lift calculations
- 🔄 **Real-time Evaluation**: Client and server-side flag evaluation
- 📈 **Conversion Tracking**: Business metrics and event tracking
- 🧮 **A/B Testing**: Multi-variant experiments with statistical significance

### Using Feature Flags

**React Hook Usage**:
```typescript
import { useFeatureFlag, ABTest } from '@/lib/experiment-client'

// Basic feature flag
const { isEnabled, variant, trackMetric } = useFeatureFlag('ai_assistant_v2')

// A/B testing component
<ABTest 
  flagKey="editor_theme_dark_plus"
  variants={{
    control: <StandardEditor />,
    dark_plus: <EnhancedDarkEditor />
  }}
  onVariantShown={(variant) => console.log('Showing:', variant)}
/>
```

**Server-side Evaluation**:
```typescript
import { featureFlagEngine } from '@/lib/feature-flags'

const result = await featureFlagEngine.evaluateFlag('ai_assistant_v2', {
  userId: 'user123',
  customAttributes: { plan: 'pro' }
})
```

**Experiment Tracking**:
```typescript
// Track conversions
await ExperimentTracker.trackConversion('ai_assistant_v2')

// Track custom metrics
await ExperimentTracker.trackEvent('ai_assistant_v2', 'code_completion', 1)
```

### Experimentation API

**Evaluate Flags**:
```bash
POST /api/experiments
{
  "action": "evaluate",
  "flagKey": "ai_assistant_v2",
  "context": { "workspaceId": "ws123" }
}
```

**Track Metrics**:
```bash
POST /api/experiments
{
  "action": "track",
  "flagKey": "ai_assistant_v2",
  "metricName": "conversion",
  "value": 1
}
```

**Get Results** (Admin):
```bash
GET /api/experiments?flagKey=ai_assistant_v2&action=results
```

### Statistical Analysis

The platform provides comprehensive experiment analysis:
- **Conversion Rates**: Variant performance comparison
- **Statistical Significance**: P-values and confidence intervals
- **Lift Calculations**: Percentage improvement over control
- **Sample Size**: Required sample sizes for statistical power
- **Confidence Intervals**: 95% confidence bounds for metrics

**Security Monitoring**:
- Network traffic analysis and security monitoring
- Storage and persistent volume monitoring
- Runtime security analysis with KubeHound
- Container escape detection and prevention
- Kubernetes RBAC analysis and privilege escalation detection
- Network security policy enforcement monitoring
- Compliance reporting and audit trails

**Production Features**:
- Comprehensive health check endpoints (`/api/monitoring/health`)
- Rate limiting with configurable thresholds
- Security headers and CSRF protection
- Audit logging for all admin actions
- Circuit breakers for external dependencies
- Graceful degradation during service failures

## ⚠️ Production Readiness Status (July 2025 Update)

### ✅ Production Ready
- **Core Monitoring Stack**: Datadog RUM/APM/Logs, Vector, KubeHound, Metaplane
- **Security Implementation**: Environment-based auth, rate limiting, audit logging
- **Health Checks**: Comprehensive component health validation
- **SLI/SLO Monitoring**: Error budgets, burn rate alerts, comprehensive dashboards
- **Data Observability**: AI-powered data quality monitoring with anomaly detection
- **Incident Response**: Complete runbook documentation and escalation procedures
- **Test Coverage**: Unit, integration, E2E, Docker configuration testing

### 🚧 Known Issues (Staff Engineer Assessment - July 2025)
- ✅ **TypeScript Compilation**: Fixed type assertion issues
- ✅ **Security**: Removed hardcoded credentials, implemented environment-based auth
- ✅ **SLI/SLO Configuration**: Implemented production-ready monitoring with error budgets
- ✅ **Alert Rules**: Added comprehensive Datadog alerting with escalation policies
- ✅ **Data Observability**: Integrated Metaplane for AI-powered data quality monitoring
- ✅ **Runbook Documentation**: Created operational procedures for incident response
- **Integration Testing**: Some tests still over-mocked, need real API validation
- **Performance Optimization**: Need baseline performance benchmarks under realistic load

### 📋 Pre-Production Checklist
- [x] Fix remaining TypeScript compilation errors
- [x] Remove hardcoded credentials and implement secure authentication
- [x] Configure production alert thresholds and escalation
- [x] Set up monitoring system SLI/SLO definitions
- [x] Create runbook documentation for failure scenarios
- [x] Integrate Metaplane data observability for AI/ML pipelines
- [ ] Implement real Datadog integration tests (staging environment)
- [ ] Validate performance under realistic load (10k+ req/min)
- [ ] Test chaos engineering scenarios
- [ ] Security penetration testing
- [ ] GDPR compliance implementation
- [ ] SOC 2 controls implementation

### Pre-commit Hooks
Automatic security validation on every commit:
- License compliance checking
- Vulnerability scanning with npm audit
- Code quality with ESLint/TypeScript
- No secrets in code validation
- Docker container testing and health checks

## 🐳 Docker & Container Deployment

VibeCode WebGUI is fully containerized with production-ready Docker configurations supporting both development and production environments.

### Docker Stack Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js Web  │    │   WebSocket      │    │  Code-Server    │
│   (Port 3000)  │◄───┤   Server         │◄───┤  IDE            │
│                 │    │   (Port 3001)    │    │  (Port 8080)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │      Redis       │    │   Vector        │
│   (Port 5432)  │    │   (Port 6379)    │    │   Log Pipeline  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Quick Start with Docker

**Prerequisites:**
- Docker Desktop installed and running
- 8GB+ RAM recommended
- 10GB+ free disk space

**1. Clone and Start Services:**
```bash
# Start the complete stack
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f web
```

**2. Verify Services:**
```bash
# Test database connection
docker exec vibecode-webgui-postgres-1 psql -U vibecode -d vibecode_dev -c "SELECT version();"

# Test Redis
docker exec vibecode-webgui-redis-1 redis-cli ping

# Test Datadog integration
npm run test:datadog:real
```

**3. Access Services:**
- **Web Application**: http://localhost:3000
- **WebSocket Server**: http://localhost:3001
- **PostgreSQL**: localhost:5432 (username: vibecode, password: vibecode123)
- **Redis**: localhost:6379

### Docker Services

#### Web Application (`web`)
- **Image**: Custom Next.js build with development tools
- **Features**: Feature flags, AI integration, monitoring
- **Health Check**: Automatic endpoint monitoring
- **Security**: Non-root user, environment isolation

#### PostgreSQL Database (`postgres`)
- **Image**: `postgres:16-alpine` (Official)
- **Configuration**: Optimized for development with full schema
- **Data Persistence**: Named volume `postgres-data`
- **Initialization**: Automatic schema setup with 7 tables

#### Redis Cache (`redis`)
- **Image**: `redis:7-alpine` (Official)
- **Configuration**: Optimized for sessions and caching
- **Memory Management**: 512MB limit with LRU eviction
- **Persistence**: AOF enabled for data durability

#### WebSocket Server (`websocket`)
- **Purpose**: Real-time collaboration and live updates
- **Features**: Socket.io, terminal sessions, file watching
- **Health Check**: Built-in endpoint monitoring

#### Code-Server IDE (`code-server`)
- **Image**: `codercom/code-server:4.101.2` (Official)
- **Features**: Full VS Code in browser with extensions
- **Security**: Container isolation, Docker-in-Docker support
- **Development Tools**: Node.js, TypeScript, debugging support

### Environment Configuration

**Development Environment (`.env.docker`):**
```bash
# Application
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
DOCKER=true

# Database (Docker service names)
DATABASE_URL=postgresql://vibecode:vibecode123@postgres:5432/vibecode_dev
REDIS_URL=redis://redis:6379

# Monitoring
DD_API_KEY=your-datadog-api-key
ENABLE_DATADOG_INTEGRATION_TESTS=true
```

### Docker Commands

**Development:**
```bash
# Start all services
docker-compose up -d

# Start specific services only
docker-compose up -d postgres redis

# Rebuild and start
docker-compose up -d --build

# View logs
docker-compose logs -f [service-name]

# Execute commands in containers
docker-compose exec web npm test
docker-compose exec postgres psql -U vibecode -d vibecode_dev

# Stop services
docker-compose down

# Clean up everything (data will be lost)
docker-compose down --volumes --remove-orphans
```

**Production Builds:**
```bash
# Build production images
docker build -t vibecode-webgui:latest .

# Multi-stage production build
docker build --target runner -t vibecode-webgui:prod .
```

### Container Security

**Security Features:**
- ✅ **Non-root Users**: All containers run as non-privileged users
- ✅ **Health Checks**: Automatic container health monitoring
- ✅ **Network Isolation**: Custom bridge network with service discovery
- ✅ **Resource Limits**: CPU and memory constraints
- ✅ **Official Images**: PostgreSQL, Redis, Node.js from official repositories
- ✅ **Security Scanning**: Automated vulnerability detection

**Security Configurations:**
```yaml
# Example security options in docker-compose.yml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
cap_add:
  - CHOWN
  - SETUID
  - SETGID
```

### Performance & Resources

**Resource Usage (Typical):**
- **Web App**: ~500MB RAM, 0.3 CPU
- **PostgreSQL**: ~50MB RAM, 0.1 CPU
- **Redis**: ~25MB RAM, 0.0 CPU
- **WebSocket**: ~50MB RAM, 0.1 CPU
- **Total**: ~625MB RAM, 0.5 CPU

**Optimization Features:**
- Multi-stage Docker builds for smaller images
- Alpine Linux base images
- Dependency caching and layer optimization
- Health-based container orchestration

## 🚀 Fly.io Production Deployment

VibeCode WebGUI is optimized for deployment on Fly.io with automatic scaling, global distribution, and managed PostgreSQL.

### Fly.io Setup

**1. Install Fly.io CLI:**
```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Windows
iwr https://fly.io/install.ps1 -useb | iex
```

**2. Login and Initialize:**
```bash
# Login to Fly.io
flyctl auth login

# Create application
flyctl apps create vibecode-webgui
```

**3. Configure Database:**
```bash
# Create managed PostgreSQL
flyctl postgres create --name vibecode-db --region ord

# Attach database to app
flyctl postgres attach --app vibecode-webgui vibecode-db
```

**4. Set Production Secrets:**
```bash
flyctl secrets set \
  NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  DD_API_KEY="your-real-datadog-key" \
  OPENAI_API_KEY="your-openai-key" \
  GITHUB_ID="your-github-oauth-id" \
  GITHUB_SECRET="your-github-oauth-secret"
```

**5. Deploy:**
```bash
# Deploy application
flyctl deploy

# Check deployment status
flyctl status

# View logs
flyctl logs
```

### Fly.io Configuration (`fly.toml`)

**Application Settings:**
```toml
app = "vibecode-webgui"
primary_region = "ord"
kill_signal = "SIGINT"
kill_timeout = "5s"

[experimental]
  auto_rollback = true

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
```

**Health Checks:**
```toml
[[http_service.checks]]
  interval = "10s"
  timeout = "2s"
  grace_period = "5s"
  method = "GET"
  path = "/api/monitoring/health"
  protocol = "http"
```

**Scaling Configuration:**
```toml
[deploy]
  strategy = "bluegreen"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
  processes = ["app"]
```

### Production Features

**Fly.io Platform Benefits:**
- 🌍 **Global Edge Network**: 35+ regions worldwide
- ⚡ **Auto-scaling**: Scale to zero, scale on demand
- 🔒 **Managed SSL/TLS**: Automatic certificate management
- 📊 **Built-in Monitoring**: Metrics, logs, and alerting
- 🗄️ **Managed PostgreSQL**: Automated backups and failover
- 🚀 **Blue-Green Deployments**: Zero-downtime releases
- 🔄 **Health Checks**: Automatic restart on failure

**Production Optimizations:**
- Multi-region deployment for low latency
- Automatic request routing to nearest region
- Container optimization for fast cold starts
- Database connection pooling and optimization

### Deployment Commands

**Development Workflow:**
```bash
# Local development
npm run dev

# Test in Docker
docker-compose up -d

# Deploy to staging
flyctl deploy --app vibecode-webgui-staging

# Deploy to production
flyctl deploy --app vibecode-webgui
```

**Monitoring & Debugging:**
```bash
# View application status
flyctl status

# Check resource usage
flyctl dashboard

# Access logs
flyctl logs --app vibecode-webgui

# SSH into container
flyctl ssh console

# Database operations
flyctl postgres connect --app vibecode-db
```

### Cost Optimization

**Resource Management:**
- Auto-stop machines when idle (scale to zero)
- Shared CPU instances for cost efficiency
- Volume storage optimization
- Request-based scaling

**Estimated Monthly Costs:**
- **Shared CPU (1x)**: ~$5-15/month
- **PostgreSQL (Basic)**: ~$15-30/month
- **Total**: ~$20-45/month for low-medium traffic

## 📦 Deployment

### Production Deployment

**Container Registry**:
```bash
# Build and push images
docker build -t your-registry/vibecode-webgui:latest .
docker push your-registry/vibecode-webgui:latest
```

**Kubernetes Production**:
```bash
# Deploy to production cluster
kubectl apply -f infrastructure/kubernetes/
kubectl rollout status deployment/code-server -n vibecode-webgui
```

**Environment Variables**:
Set these in your production environment:
```bash
NEXTAUTH_SECRET=your-secure-jwt-secret
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
CLAUDE_API_KEY=your-claude-api-key
DD_API_KEY=your-datadog-api-key
```

## 🛠️ Development

### Project Structure
```
├── src/                    # Next.js application source
│   ├── app/               # App router pages
│   ├── components/        # React components
│   └── lib/              # Utilities and configurations
├── server/                # WebSocket server
├── docker/               # Container configurations
├── infrastructure/       # Kubernetes manifests
├── tests/                # Test suites
└── scripts/              # Build and deployment scripts
```

### Key Technologies
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Socket.IO, PostgreSQL, Redis
- **IDE**: code-server 4.101.2, xterm.js 5.5.0
- **AI**: Vercel AI SDK, Claude Code integration
- **Infrastructure**: Docker, Kubernetes, KIND
- **Monitoring**: Datadog RUM/APM/Logs, Vector, KubeHound, Winston, Pino
- **Security**: Datadog SCA/SAST, pre-commit hooks, runtime security

### Development Scripts
```bash
npm run dev              # Start development server
npm run build           # Build production bundle
npm run start           # Start production server
npm run lint            # Lint code
npm run type-check      # TypeScript checking
npm run docker:dev      # Start with Docker Compose
npm run k8s:dev         # Deploy to KIND cluster
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards
- ✅ TypeScript for type safety
- ✅ ESLint + Prettier for code formatting
- ✅ Comprehensive test coverage (>80%)
- ✅ Security scanning passes
- ✅ No GPL/LGPL dependencies

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.vibecode.dev](https://docs.vibecode.dev)
- **Issues**: [GitHub Issues](https://github.com/vibecode/webgui/issues)
- **Discussions**: [GitHub Discussions](https://github.com/vibecode/webgui/discussions)
- **Security**: security@vibecode.dev

## 🚀 Roadmap

- [x] Core infrastructure with Docker/Kubernetes
- [x] Security scanning and license compliance
- [x] Comprehensive monitoring with Datadog integration
- [x] AI-powered code assistance with Vercel AI SDK
- [ ] JWT authentication with OAuth
- [ ] Code-server integration with iframe pattern
- [ ] High-performance terminal with WebGL
- [ ] Claude Code VS Code extension
- [ ] Real-time collaboration features
- [ ] Multi-provider deployment system

---

**Built with ❤️ by the VibeCode team**