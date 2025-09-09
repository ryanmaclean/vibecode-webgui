# Contributing to VibeCode

Thank you for your interest in contributing to VibeCode! We welcome contributions from everyone, regardless of experience level. This document will guide you through the process of contributing to our project.

## First Time Contributors

If you're new to open source or VibeCode, check out our [Good First Issues](https://github.com/vibecode/webgui/contribute) to find a great starting point. Don't hesitate to ask questions in our [Discord community](https://discord.gg/vibecode)!

## Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Getting Started](#-getting-started)
- [Development Environment](#-development-environment)
- [Making Changes](#-making-changes)
- [Pull Request Process](#-pull-request-process)
- [Reporting Issues](#-reporting-issues)
- [Community](#-community)
- [License](#-license)

## Code of Conduct

This project adheres to our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you're expected to uphold this code. Please report any unacceptable behavior to [conduct@vibecode.dev](mailto:conduct@vibecode.dev).

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** to your local machine
   ```bash
   git clone https://github.com/your-username/vibecode-webgui.git
   cd vibecode-webgui
   ```
3. **Set up the development environment** (see below)
4. **Create a new branch** for your changes
   ```bash
   git checkout -b feat/your-feature-name  # or fix/your-bugfix
   ```

## Development Environment

### Prerequisites

- Node.js 20.x (LTS)
- pnpm 8.x
- Docker and Docker Compose
- Kubernetes (for local development, KIND is recommended)
- Git

### Quick Start

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration (use .env.local for local-only overrides)
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser

### Testing

We use a comprehensive testing strategy:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test -- path/to/test/file.test.ts

# Run end-to-end tests
pnpm test:e2e

# Run performance tests
pnpm test:perf
```

## Making Changes

### Coding Standards

- **TypeScript**: Strict mode enabled
- **React**: Functional components with TypeScript
- **Styling**: Tailwind CSS with CSS Modules
- **Formatting**: Prettier + ESLint
- **Commits**: Conventional Commits

### Development Workflow

1. **Sync with main**
   ```bash
   git fetch upstream
   git merge upstream/main
   ```

2. **Make your changes**
   - Keep changes focused and atomic
   - Write tests for new functionality
   - Update documentation

3. **Verify your changes**
   ```bash
   pnpm lint    # Check code style
   pnpm type    # Type checking
   pnpm test    # Run tests
   pnpm build   # Verify production build
   ```

## Pull Request Process

1. **Create a Draft PR** early for feedback
2. **Update CHANGELOG.md** with your changes
3. **Ensure all checks pass** (CI, tests, linting)
4. **Request reviews** from maintainers
5. **Address feedback** and update your PR
6. **Squash and merge** when approved

### PR Guidelines

- **Title**: Use conventional commit format (e.g., `feat: add dark mode`)
- **Description**: Reference related issues and describe changes
- **Size**: Keep PRs small and focused (300-500 lines max)
- **Tests**: Include unit and integration tests
- **Documentation**: Update relevant docs

## Reporting Issues

Before creating an issue, please:
1. Search existing issues
2. Check the [FAQ](https://docs.vibecode.dev/faq)
3. Try the latest version

### Issue Template

```markdown
## Description

## Steps to Reproduce
1. 
## Expected Behavior

## Actual Behavior

## Environment
- VibeCode Version: 
- Browser: 
- OS: 
- Node.js Version:

## Additional Context
```

## Community

- [Discord](https://discord.gg/vibecode) - Chat with the community
- [GitHub Discussions](https://github.com/vibecode/webgui/discussions) - Q&A and discussions
- [Twitter](https://twitter.com/vibecode) - Latest updates

## License

By contributing to VibeCode, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for contributing to VibeCode! Your help makes our project better for everyone. The versioning scheme we use is [SemVer](http://semver.org/).
