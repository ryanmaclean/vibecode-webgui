# VibeCode CLI Integration

> Unified command-line toolkit for the complete VibeCode platform

## Overview

The VibeCode CLI provides a comprehensive command-line interface for managing all aspects of the VibeCode platform, from development and testing to deployment and monitoring.

**Version**: 1.0.0  
**Last Updated**: October 24, 2025  
**License**: MIT

---

## Quick Start

### Installation

```bash
# Install globally
npm install -g @vibecode/cli

# Or use npx
npx @vibecode/cli

# Or use the local version
npm run cli
```

### First Run

```bash
# Interactive menu
vibecode-cli

# Or use specific commands
vibecode-cli dev:start
vibecode-cli db:migrate
vibecode-cli deploy:prod
```

---

## Main Menu Categories

### 1. 🚀 Development & Testing

Manage development workflows, testing, and code quality.

**Commands**:
```bash
# Local development
vibecode-cli dev:start              # Start development server
vibecode-cli dev:build              # Build for production
vibecode-cli dev:clean              # Clean build artifacts

# Testing
vibecode-cli test:unit              # Run unit tests
vibecode-cli test:integration       # Run integration tests
vibecode-cli test:e2e               # Run end-to-end tests
vibecode-cli test:all               # Run all tests

# Code quality
vibecode-cli lint                   # Run ESLint
vibecode-cli format                 # Format with Prettier
vibecode-cli type-check             # TypeScript type checking
```

**Features**:
- Hot reload for development
- Parallel test execution
- Coverage reporting
- Watch mode support

### 2. 🔒 Security & Compliance

Security scanning, vulnerability assessment, and compliance validation.

**Commands**:
```bash
# Security scanning
vibecode-cli security:scan          # Full security audit
vibecode-cli security:deps          # Dependency vulnerability scan
vibecode-cli security:secrets       # Secret detection
vibecode-cli security:compliance    # Compliance validation

# Continuous monitoring
vibecode-cli security:monitor       # Start security monitoring
vibecode-cli security:report        # Generate security report
```

**Features**:
- Automated vulnerability scanning
- Secret detection in code and configs
- OWASP compliance checks
- Datadog security monitoring integration

### 3. 🗄️ Database Operations

Database management and operations for PostgreSQL + pgvector.

**Commands**:
```bash
# Migrations
vibecode-cli db:migrate             # Run pending migrations
vibecode-cli db:migrate:create      # Create new migration
vibecode-cli db:migrate:rollback    # Rollback last migration
vibecode-cli db:migrate:status      # Check migration status

# Data management
vibecode-cli db:seed                # Seed database
vibecode-cli db:reset               # Reset database
vibecode-cli db:backup              # Create backup
vibecode-cli db:restore             # Restore from backup

# Maintenance
vibecode-cli db:vacuum              # Vacuum database
vibecode-cli db:analyze             # Analyze tables
vibecode-cli db:reindex             # Rebuild indexes
```

**Features**:
- Prisma migration support
- pgvector extension management
- Automated backups
- Performance optimization

### 4. 🚢 Deployment Automation

Deploy to various platforms and environments.

**Commands**:
```bash
# Environment deployment
vibecode-cli deploy:dev             # Deploy to development
vibecode-cli deploy:staging         # Deploy to staging
vibecode-cli deploy:prod            # Deploy to production

# Platform-specific
vibecode-cli deploy:aks             # Deploy to Azure AKS
vibecode-cli deploy:fly             # Deploy to Fly.io
vibecode-cli deploy:docker          # Build and push Docker image

# Rollback
vibecode-cli deploy:rollback        # Rollback last deployment
vibecode-cli deploy:status          # Check deployment status
```

**Features**:
- Multi-environment support
- Blue/green deployments
- Automated rollback
- Health checks

### 5. 🖥️ VM Management

Manage Alpine ARM64 VMs for development and testing.

**Commands**:
```bash
# VM lifecycle
vibecode-cli vm:create              # Create new VM
vibecode-cli vm:start               # Start VM
vibecode-cli vm:stop                # Stop VM
vibecode-cli vm:destroy             # Destroy VM

# VM operations
vibecode-cli vm:ssh                 # SSH into VM
vibecode-cli vm:snapshot            # Create snapshot
vibecode-cli vm:restore             # Restore from snapshot
vibecode-cli vm:list                # List all VMs

# Resource management
vibecode-cli vm:stats               # Show VM statistics
vibecode-cli vm:resize              # Resize VM resources
```

**Features**:
- vfkit integration for M-Series
- Alpine ARM64 templates
- Snapshot management
- Resource monitoring

### 6. 📊 Monitoring & Observability

Comprehensive monitoring with Datadog integration.

**Commands**:
```bash
# Datadog setup
vibecode-cli monitor:setup          # Setup Datadog integration
vibecode-cli monitor:apm            # Configure APM
vibecode-cli monitor:dbm            # Configure Database Monitoring
vibecode-cli monitor:llm            # Configure LLM Observability

# Performance
vibecode-cli monitor:baseline       # Record performance baseline
vibecode-cli monitor:compare        # Compare against baseline
vibecode-cli monitor:report         # Generate performance report

# Health checks
vibecode-cli monitor:health         # Run health checks
vibecode-cli monitor:logs           # View application logs
vibecode-cli monitor:metrics        # View metrics dashboard
```

**Features**:
- Datadog APM integration
- Database performance monitoring
- LLM observability (token usage, latency)
- Custom metrics and dashboards

---

## Integration with RAG System

The CLI provides specialized commands for the RAG system:

### Vector Database Management

```bash
# Embeddings
vibecode-cli rag:ingest <file>      # Ingest documents
vibecode-cli rag:index              # Rebuild vector index
vibecode-cli rag:search <query>     # Test semantic search

# Cache management
vibecode-cli rag:cache:clear        # Clear Valkey cache
vibecode-cli rag:cache:warm         # Warm cache with common queries
vibecode-cli rag:cache:stats        # Show cache statistics

# Performance
vibecode-cli rag:benchmark          # Run RAG benchmarks
vibecode-cli rag:optimize           # Optimize HNSW parameters
```

### Example Workflow

```bash
# 1. Setup environment
vibecode-cli dev:start

# 2. Run migrations
vibecode-cli db:migrate

# 3. Ingest documents
vibecode-cli rag:ingest ./docs/**/*.md

# 4. Build vector index
vibecode-cli rag:index

# 5. Test search
vibecode-cli rag:search "How do I deploy to production?"

# 6. Monitor performance
vibecode-cli monitor:health
```

---

## Integration with Multi-Agent Workflow

Manage experiments and multi-agent workflows:

```bash
# Experiments
vibecode-cli exp:create             # Create new experiment
vibecode-cli exp:start <key>        # Start experiment
vibecode-cli exp:stop <key>         # Stop experiment
vibecode-cli exp:results <key>      # View results

# Multi-agent orchestration
vibecode-cli agents:list            # List all agents
vibecode-cli agents:run <group>     # Run agent group
vibecode-cli agents:status          # Check agent status

# Guardrails
vibecode-cli guardrails:check       # Run guardrail checks
vibecode-cli guardrails:config      # Configure guardrails
```

---

## Configuration

### Config File

Create `vibecode.config.js` in your project root:

```javascript
module.exports = {
  // Database
  database: {
    url: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 }
  },
  
  // Valkey cache
  cache: {
    host: process.env.VALKEY_HOST || 'localhost',
    port: 6379,
    maxmemory: '512mb'
  },
  
  // Datadog
  monitoring: {
    apiKey: process.env.DD_API_KEY,
    service: 'vibecode',
    env: process.env.NODE_ENV
  },
  
  // Deployment
  deployment: {
    platform: 'aks',
    registry: 'ghcr.io/vibecode',
    environments: ['dev', 'staging', 'prod']
  },
  
  // VMs
  vms: {
    provider: 'vfkit',
    defaultImage: 'alpine-3.22-arm64',
    defaultResources: {
      cpus: 2,
      memory: '2GB'
    }
  }
};
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://vibecode:vibecode@localhost:5432/vibecode

# Cache
VALKEY_HOST=localhost
VALKEY_PORT=6379

# Monitoring
DD_API_KEY=your_datadog_api_key
DD_SERVICE=vibecode
DD_ENV=production

# LLM
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

---

## Advanced Usage

### Custom Scripts

Add custom commands to `package.json`:

```json
{
  "scripts": {
    "cli": "vibecode-cli",
    "dev": "vibecode-cli dev:start",
    "test": "vibecode-cli test:all",
    "deploy": "vibecode-cli deploy:prod",
    "monitor": "vibecode-cli monitor:health"
  }
}
```

### Automation

Use in CI/CD pipelines:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npx vibecode-cli test:all
      
      - name: Security scan
        run: npx vibecode-cli security:scan
      
      - name: Deploy to production
        run: npx vibecode-cli deploy:prod
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DD_API_KEY: ${{ secrets.DD_API_KEY }}
```

---

## Architecture

### Command Structure

```
vibecode-cli/
├── commands/
│   ├── dev/           # Development commands
│   ├── test/          # Testing commands
│   ├── security/      # Security commands
│   ├── db/            # Database commands
│   ├── deploy/        # Deployment commands
│   ├── vm/            # VM management
│   ├── monitor/       # Monitoring commands
│   ├── rag/           # RAG system commands
│   └── exp/           # Experiment commands
├── lib/
│   ├── config.ts      # Configuration management
│   ├── logger.ts      # Logging utilities
│   ├── spinner.ts     # Progress indicators
│   └── utils.ts       # Helper functions
└── index.ts           # Main entry point
```

### Plugin System

Extend the CLI with custom plugins:

```typescript
// plugins/custom-deploy.ts
import { Command } from '@vibecode/cli';

export default class CustomDeployCommand extends Command {
  static description = 'Custom deployment strategy';
  
  async run() {
    this.log('Running custom deployment...');
    // Your custom logic here
  }
}
```

---

## Performance

### Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| CLI startup | <100ms | Fast initialization |
| Database migration | ~2s | Depends on schema |
| Vector index rebuild | ~30s | 100K documents |
| Cache warm | ~10s | 1000 queries |
| Health check | <1s | All services |

### Optimization Tips

1. **Use watch mode** for development
2. **Enable caching** for faster builds
3. **Run tests in parallel** with `--parallel`
4. **Use incremental migrations** for large schemas

---

## Troubleshooting

### Common Issues

**Database connection failed**:
```bash
# Check connection
vibecode-cli db:test-connection

# Verify credentials
echo $DATABASE_URL
```

**Cache not responding**:
```bash
# Check Valkey status
vibecode-cli monitor:health

# Restart cache
vibecode-cli vm:restart valkey
```

**Deployment failed**:
```bash
# Check deployment logs
vibecode-cli deploy:logs

# Rollback if needed
vibecode-cli deploy:rollback
```

---

## Documentation Links

- **[User Guide](../cli-tools/user-guide/)** - Complete usage guide
- **[Architecture](../cli-tools/architecture/)** - Technical details
- **[API Reference](../cli-tools/api/)** - Command reference
- **[Examples](../cli-tools/examples/)** - Common workflows

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

---

## License

MIT License - see [LICENSE](../LICENSE) for details.

---

**Last Updated**: October 24, 2025  
**Version**: 1.0.0  
**Maintainer**: VibeCode Team
