---
title: Project Structure
slug: project-structure
---

# Project Structure

Understanding the VibeCode project structure is essential for effective development and contribution. This guide provides an overview of the codebase organization.

## Root Directory Structure

```
vibecode-webgui/
├── __mocks__/           # Test mocks and utilities
├── archive/             # Archived files and documentation
├── charts/              # Helm charts for Kubernetes deployment
├── code-server/         # VS Code server configuration
├── content/             # Content files (wiki, documentation)
├── coverage/            # Test coverage reports
├── data/                # Application data and uploads
├── database/            # Database schemas and migrations
├── datadog/             # Datadog monitoring configuration
├── docker/              # Docker configurations and services
├── docs/                # Documentation files
├── examples/            # Code examples and samples
├── extensions/          # VSCode extensions and tools
├── external/            # External dependencies and integrations
├── helm/                # Helm chart configurations
├── infrastructure/      # Infrastructure as Code (Terraform, ARM)
├── k8s/                 # Kubernetes deployment manifests
├── kubernetes/          # Additional Kubernetes configurations
├── litellm/             # LiteLLM configuration and setup
├── logs/                # Application logs
├── monitoring/          # Monitoring and observability configs
├── packages/            # Internal packages and libraries
├── playwright-report/   # E2E test reports
├── prisma/              # Prisma ORM schema and migrations
├── public/              # Static assets
├── scripts/             # Build and utility scripts
├── server/              # Server-side code
├── services/            # Microservices and service definitions
├── src/                 # Main source code
├── templates/           # Project templates
├── test-results/        # Test execution results
├── tests/               # Test files and configurations
├── tofu/                # OpenTofu (Terraform alternative) configs
├── venv/                # Python virtual environment
├── watermarkpodautoscaler/ # Custom Kubernetes autoscaler
├── web-dashboard/       # Web dashboard application
└── package.json         # Node.js dependencies and scripts
```

## Key Directories

### Source Code (`src/`)
The main application source code:

- **`src/app/`** - Next.js app router pages and API routes
- **`src/components/`** - Reusable React components
- **`src/lib/`** - Utility functions and shared services
- **`src/hooks/`** - Custom React hooks
- **`src/types/`** - TypeScript type definitions
- **`src/middleware/`** - Next.js middleware
- **`src/providers/`** - React context providers

### Testing (`tests/`)
Comprehensive testing structure:

- **`tests/unit/`** - Unit tests
- **`tests/integration/`** - Integration tests
- **`tests/e2e/`** - End-to-end tests
- **`tests/accessibility/`** - Accessibility tests
- **`tests/security/`** - Security tests
- **`tests/performance/`** - Performance tests

### Documentation (`docs/`)
Project documentation:

- **`docs/`** - Main documentation files
- **`content/wiki/`** - Wiki content (Astro-based)
- **`docs/API.md`** - Auto-generated API documentation

### Infrastructure (`infrastructure/`, `k8s/`, `kubernetes/`)
Infrastructure and deployment:

- **`infrastructure/`** - Terraform and ARM templates
- **`k8s/`** - Kubernetes manifests
- **`kubernetes/`** - Additional K8s configurations
- **`helm/`** - Helm charts
- **`charts/`** - Additional Helm charts

### Monitoring (`monitoring/`, `datadog/`)
Observability and monitoring:

- **`monitoring/`** - Monitoring configurations
- **`datadog/`** - Datadog-specific configurations
- **`datadog/templates/`** - Datadog dashboard templates

### Services (`services/`, `server/`)
Backend services:

- **`services/`** - Microservices definitions
- **`server/`** - Server-side application code
- **`litellm/`** - LiteLLM service configuration

### Templates (`templates/`)
Project templates for code generation:

- **`templates/python/`** - Python project templates
- **`templates/nodejs/`** - Node.js project templates
- **`templates/rust-burn/`** - Rust/Burn templates
- **`templates/semantic-kernel/`** - Semantic Kernel templates

## File Naming Conventions

### Components
- React components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities: `camelCase.ts`
- Types: `camelCase.ts`

### Tests
- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

### Configuration Files
- Environment: `.env*`
- Docker: `Dockerfile*`, `docker-compose*.yml`
- Kubernetes: `*.yaml`
- Helm: `Chart.yaml`, `values.yaml`

## Development Workflow

### Adding New Features
1. **Components**: Add to `src/components/`
2. **Pages**: Add to `src/app/`
3. **API Routes**: Add to `src/app/api/`
4. **Types**: Add to `src/types/`
5. **Tests**: Add corresponding tests in `tests/`

### Database Changes
1. **Schema**: Update `prisma/schema.prisma`
2. **Migrations**: Generate with `npm run db:migrate`
3. **Types**: Regenerate with `npm run db:generate`

### Infrastructure Changes
1. **Kubernetes**: Update manifests in `k8s/`
2. **Terraform**: Update files in `infrastructure/`
3. **Helm**: Update charts in `helm/`

## Key Configuration Files

- **`package.json`** - Dependencies and scripts
- **`next.config.js`** - Next.js configuration
- **`tsconfig.json`** - TypeScript configuration
- **`tailwind.config.js`** - Tailwind CSS configuration
- **`prisma/schema.prisma`** - Database schema
- **`.env.example`** - Environment variables template

## Getting Started

- **Setup**: Follow [Getting Started Guide](/wiki/getting-started)
- **Development**: Use [Development Scripts](/wiki/development-scripts)
- **API**: Check [API Reference](/wiki/api-reference)
- **Features**: Explore [Features Overview](/wiki/features)
