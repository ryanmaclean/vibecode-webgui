# vibecode-webgui

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Node](https://img.shields.io/badge/node-18.18.0+-brightgreen.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)

AI-powered development platform with intelligent project generation, multi-model orchestration, and automated deployment.

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd vibecode-webgui
npm install --legacy-peer-deps

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Setup database (optional)
npm run db:deploy

# Start development
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Prerequisites
- Node.js >=18.18.0
- PostgreSQL 16+ with pgvector (optional)
- Valkey 7+ (Redis-compatible, BSD licensed)

## Key Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Code quality (3717 issues tracked)
npm run type-check   # TypeScript check
```

## Infrastructure Hygiene

The project maintains high code quality standards with systematic issue tracking:

- **Current Status**: 77 ESLint errors, 3640 warnings (down from 85 errors)
- **Backup Files**: `.backup/**` directories excluded from linting via `eslint.config.mjs`
- **Quality Target**: Auto-fix applied where safe, remaining issues represent real code to address

### Checking Code Quality

```bash
# Get current lint status
npm run lint 2>&1 | tail -1

# Auto-fix safe issues
npm run lint -- --fix

# Verify TypeScript compilation
npm run type-check
```

## Documentation

- **Architecture & Development**: See [wiki/](./wiki/) directory
- **API Documentation**: Available in docs/ after `npm run docs:build`
- **Testing Strategy**: [wiki/TEST_INFRASTRUCTURE_SUCCESS_REPORT.md](./wiki/TEST_INFRASTRUCTURE_SUCCESS_REPORT.md)

## Key Features

- **AI Development**: 20+ templates, multi-model orchestration
- **Cloud Deployment**: One-click deployment, GitHub integration
- **Security**: WCAG 2.1 AA compliance, security middleware
- **Modern Stack**: Next.js 15, React 19, TypeScript
- **Observability**: Datadog integration with optional tracing

## Vector Database Error Handling

The project uses a standardized error taxonomy for vector operations:

```typescript
// All vector DB errors use unique enum values
VectorDBErrorType.CONNECTION_FAILED    // Network issues
VectorDBErrorType.AUTHORIZATION_ERROR  // Auth failures
VectorDBErrorType.QUERY_FAILED         // Search operations
VectorDBErrorType.TIMEOUT              // Performance issues
```

**Guidelines**: When extending error handling, ensure enum values remain unique and descriptive.

## Observability Stack

### Datadog Metrics & Tracing (Optional)

```bash
# Required environment variables
export DD_API_KEY="your-datadog-api-key"
export DD_APP_KEY="your-datadog-app-key"
export DD_SITE="us1.datadoghq.com"

# Enable OpenTelemetry tracing
export ENABLE_TRACING=true
export OTEL_EXPORTER_OTLP_ENDPOINT="https://api.datadoghq.com"
```

Services automatically emit metrics when configured. See `services/ai-gateway/` for implementation details.

## Contributing

1. Fork repository
2. Create feature branch
3. Make changes with tests: `npm test`
4. Check quality: `npm run lint && npm run type-check`
5. Submit pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.
## 🚀 GitHub Actions Cost Optimization

**Status**: ✅ **DEPLOYED** - 70-80% cost reduction achieved ($100 → $20-30/month)

We use a two-tier CI/CD strategy to control costs:

### Main Branch (Lightweight)
- Fast linting and basic unit tests only
- Skips expensive E2E and integration tests
- No deployment pipelines
- ~$0.05 per run

### Release Branches (Comprehensive)
- Full test suite (unit, integration, E2E)
- Security scans and performance testing
- Production deployment pipelines
- ~$4 per run

### Helper Scripts
```bash
# Create release branch for full testing
./create-release-branch.sh v1.2.0

# Apply cost optimizations (already applied)
./optimize-github-actions.sh
```

**Workflow Files**:
- `.github/workflows/main-branch-ci.yml` - Lightweight CI for main
- `.github/workflows/release-branch-ci.yml` - Comprehensive CI for releases
- `ci.yml` - Now only runs on release/* branches
