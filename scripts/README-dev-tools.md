# Development Tools

This directory contains scripts to help with development workflows.

## dev-tools.sh

A comprehensive development tool that simplifies common development tasks like running tests, linters, and starting the development server.

### Prerequisites

- Bash (version 4.0 or later)
- Node.js (version 14 or later)
- npm, yarn, or pnpm (for package management)

### Installation

1. Make the script executable:
   ```bash
   chmod +x scripts/dev-tools.sh
   ```

2. (Optional) Add an alias to your shell configuration:
   ```bash
   alias dev="./scripts/dev-tools.sh"
   ```

### Usage

```bash
./scripts/dev-tools.sh [command] [options]
```

### Available Commands

| Command         | Description                                | Options                      |
|-----------------|--------------------------------------------|------------------------------|
| `install`      | Install project dependencies               | -                           |
| `lint`         | Run linters                               | -                           |
| `test`         | Run tests                                 | `--watch`, `--coverage`     |
| `dev`          | Start development server                  | -                           |
| `build`        | Create production build                   | -                           |
| `migrate`      | Run database migrations                   | -                           |
| `check`        | Run all checks (lint + test + build)      | -                           |
| `help`         | Show help message                         | -                           |

### Examples

Install dependencies:
```bash
./scripts/dev-tools.sh install
```

Run tests with coverage:
```bash
./scripts/dev-tools.sh test --coverage
```

Start development server:
```bash
./scripts/dev-tools.sh dev
```

Run all checks:
```bash
./scripts/dev-tools.sh check
```

## CI/CD Integration

The enhanced CI pipeline (`.github/workflows/ci-enhancements.yml`) includes:

- Linting and testing with coverage
- Build verification
- Dependency auditing
- E2E testing with PostgreSQL
- Preview deployments for PRs
- Code coverage reporting

### Required Secrets

- `CODECOV_TOKEN`: For uploading coverage reports
- `VERCEL_TOKEN`: For Vercel deployments
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID
- `VERCEL_SCOPE`: Vercel scope

## Best Practices

1. **Before Committing**:
   ```bash
   ./scripts/dev-tools.sh check
   ```

2. **When Starting Work**:
   ```bash
   ./scripts/dev-tools.sh install
   ./scripts/dev-tools.sh migrate
   ./scripts/dev-tools.sh dev
   ```

3. **Before Creating a PR**:
   - Run all checks
   - Ensure tests pass with coverage
   - Update documentation if needed
