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
npm run lint         # Code quality
npm run type-check   # TypeScript check
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

## Contributing

1. Fork repository
2. Create feature branch
3. Make changes with tests: `npm test`
4. Check quality: `npm run lint && npm run type-check`
5. Submit pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.
## 🚀 GitHub Actions Cost Optimization

To control costs, we use a two-tier CI/CD strategy:

### Main Branch (Lightweight)
- Fast linting and basic unit tests only
- ~./optimize-github-actions.sh.05 per run

### Release Branches (Comprehensive)
- Full test suite (unit, integration, E2E)
- Security scans and performance testing
- Production deployment pipelines
- ~-4 per run

### Creating Release Branches
```bash
# Create release branch for full testing
./create-release-branch.sh v1.2.0
```
