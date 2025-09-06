# vibecode-webgui

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18.18.0 25.0.0-brightgreen.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)

A comprehensive AI-powered development platform featuring intelligent project generation, multi-model orchestration, cloud deployment automation, and GitHub integration. Transform ideas into production-ready applications with 20+ templates, automated deployments, and enterprise-grade security.

## 🚀 Quick Start

### Prerequisites
- Node.js >=18.18.0 <25.0.0
- PostgreSQL 16+ with pgvector extension
- Redis 6+ (or Upstash account)
- Docker Desktop or [Orbstack](https://orbstack.dev/) (recommended)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd vibecode-webgui

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start services (optional)
docker-compose -f docker-compose.dev.yml up -d

# Initialize database
npm run db:deploy
npm run db:generate

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 📚 Documentation

For comprehensive documentation, visit our **Wiki**:

- **[Getting Started Guide](/wiki/getting-started)** - Detailed installation and setup
- **[Features Overview](/wiki/features)** - AI capabilities and platform features
- **[API Reference](/wiki/api-reference)** - Complete REST API documentation
- **[Development Scripts](/wiki/development-scripts)** - Available npm commands
- **[Project Structure](/wiki/project-structure)** - Codebase organization

## 🎯 Key Features

- **AI-Powered Development** - 20+ templates, multi-model orchestration, intelligent project generation
- **Cloud-Native Platform** - One-click deployment, GitHub integration, Kubernetes native
- **Enterprise Security** - WCAG 2.1 AA compliance, security middleware, performance monitoring
- **Modern Stack** - Next.js 15, React 19, TypeScript, PostgreSQL + pgvector, Redis

## 🛠️ Available Scripts

### Development
```bash
npm run dev          # Start development server
npm run build        # Build production application
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checking
```

### Testing
```bash
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end tests
npm run test:integration # Run integration tests
```

### Playwright E2E (against Next.js standalone build)

To run Playwright E2E tests against the production build (standalone server):

```bash
# 1) Build the Next.js app (standalone)
npm run build

# 2) Run Playwright with the standalone server
# USE_BUILD=1 tells the test runner to start the standalone server and test against it.
# The runner sets BUILDING=true, NODE_ENV=production, and PORT=3000 for stability.
USE_BUILD=1 npm run test:e2e
```

Troubleshooting:
- If you previously had a custom Babel config, it has been removed to let Next use its built-in config.
- Ensure port 3000 is free; otherwise set `PORT` accordingly.

### Infrastructure-dependent tests (Kubernetes/KIND/Helm)

Some integration tests depend on a local KIND Kubernetes cluster, Helm, and specific charts/CRDs. These tests are automatically skipped unless all requirements are detected. The detection logic lives in `tests/utils/infrastructure-detection.js` and checks:

- Kubernetes cluster access via `kubectl`.
- KIND cluster characteristics (localhost/127.0.0.1).
- Helm availability and chart dependencies (e.g., `./helm/vibecode-docs`, `./helm/vibecode-platform`).
- Optional CRDs like the Datadog Chaos `Disruption` CRD.
- Optional custom probes (e.g., docs pods exist) before entering a suite.

Defaults in CI:
- In CI, infra tests are skipped by default. To enable, set `ENABLE_INFRASTRUCTURE_TESTS=true`.

Examples:
```bash
# Ensure Helm chart deps are present (read-only check used by tests):
helm dependency list ./helm/vibecode-docs
helm dependency list ./helm/vibecode-platform

# Enable infra tests in CI or locally
export ENABLE_INFRASTRUCTURE_TESTS=true

# Run a specific infra test (will skip if infra not present)
npx jest tests/integration/docs-kind-integration.test.ts -c jest.config.js --runInBand

# Chaos controller suite also requires the Disruption CRD
kubectl get crd disruptions.chaos.datadoghq.com -o name
npx jest tests/k8s/chaos-controller-deployment.test.ts -c jest.config.js --runInBand
```

### Database
```bash
npm run db:deploy    # Deploy database migrations
npm run db:setup     # Setup database schemas
npm run db:check     # Check database connectivity
```

## 🔧 Environment Setup

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `NEXTAUTH_SECRET` - Authentication secret
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key

Rate limiting and Redis:
- The middleware will only initialize Upstash Redis/RateLimit when both of these env vars are present:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- When not set (e.g., local dev, CI), the rate limiter is disabled to avoid runtime URL parsing errors.

## 📖 Additional Resources

- **API Documentation**: [docs/API.md](docs/API.md) (auto-generated)
- **Developer Guide**: [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)
- **Health Checks**: `npm run monitoring:health`
- **Monitoring**: `http://localhost:3000/api/monitoring/performance`

## 🚀 CI/CD Pipeline Status

### ✅ **ALL COMPONENTS WORKING**
- **Code Quality & Security** - ESLint, TypeScript checks ✅
- **Build Test** - Next.js production build ✅  
- **Root Integration Tests** - Core infrastructure tests ✅
- **Astro Docs Tests** - Documentation build tests ✅ (0 broken links)
- **Datadog CI Visibility** - Test monitoring and observability ✅

### 📊 **Test Coverage**
- **Core Application**: ✅ All tests passing
- **Infrastructure**: ✅ Database, Redis, API connectivity verified
- **Documentation**: ✅ Astro docs build and tests working (0 broken links)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes with tests: `npm run test && npm run test:e2e`
4. Check code quality: `npm run lint && npm run type-check`
5. Submit a pull request

**Note**: Complete CI pipeline is now fully stable and production-ready with all tests passing.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Need Help?** 
- Check the [Wiki](/wiki/home) for comprehensive documentation
- Review [API Documentation](docs/API.md)
- Run health checks: `npm run monitoring:health`
