---
title: Current Folder Structure Audit
date: 2026-02-14
status: Initial Audit
---

# Current Folder Structure Audit

This document provides a comprehensive audit of the current top-level directory structure of the VibeCode project. This audit serves as the foundation for planning the transition to a modular multi-service architecture.

## Audit Date

**Date:** February 14, 2026
**Purpose:** Document existing structure before architectural refactoring
**Scope:** All top-level directories in the repository

## Current Root Directory Structure

### Hidden Directories (Configuration & Tools)

```
.agents/                    # Agent configurations and tools
.auto-claude/              # Auto-Claude automation configurations
.beads/                    # Beads framework/tooling
.claude/                   # Claude AI configuration
.codex/                    # Codex documentation or tooling
.gastown/                  # Gastown-related configurations
.github/                   # GitHub Actions, workflows, and templates
.husky/                    # Git hooks via Husky
.opencode/                 # OpenCode configurations
.pre-commit-cache/         # Pre-commit hook cache
.test-results/             # Test execution results
.ts-baseline-temp/         # TypeScript baseline temporary files
.vscode/                   # VS Code workspace settings
```

### Application Source & Core

```
src/                       # Main application source code
                          # - Next.js pages, components, hooks
                          # - Frontend application logic
                          # - Client-side code

server/                    # Server-side application code
                          # - Backend services
                          # - API implementations

packages/                  # Internal packages and libraries
                          # - Shared code modules
                          # - Reusable components

types/                     # TypeScript type definitions
                          # - Shared types across application
```

### Infrastructure & Deployment

```
infrastructure/            # Infrastructure as Code (IaC)
                          # - Terraform configurations
                          # - ARM templates
                          # - Cloud resource definitions

infra/                     # Additional infrastructure configurations
                          # - May contain alternative IaC approaches

deploy/                    # Deployment configurations and scripts
                          # - Deployment automation
                          # - Release management

docker/                    # Docker configurations
                          # - Dockerfiles
                          # - Docker Compose files
                          # - Container orchestration

azure/                     # Azure-specific configurations
                          # - Azure deployment files
                          # - Azure-specific IaC

monitoring/                # Monitoring and observability
                          # - Prometheus, Grafana configs
                          # - Alerting rules
                          # - Observability dashboards
```

### Data & Database

```
prisma/                    # Prisma ORM
                          # - Database schema definitions
                          # - Migrations
                          # - Database client generation

data/                      # Application data
                          # - User uploads
                          # - Persistent data storage
```

### Configuration

```
config/                    # Application configuration files
                          # - Environment-specific configs
                          # - Feature flags
                          # - Application settings

settings/                  # Additional settings and preferences
                          # - User settings
                          # - System preferences
```

### Specialized Services

```
airflow/                   # Apache Airflow workflows
                          # - DAG definitions
                          # - Workflow orchestration

daemon/                    # Background daemon processes
                          # - Long-running services
                          # - Background workers

deacon/                    # Deacon service
                          # - Purpose TBD (service-specific)

gitea/                     # Gitea integration
                          # - Git server configurations
                          # - Repository management
```

### Developer Tools & Utilities

```
scripts/                   # Build and utility scripts
                          # - Automation scripts
                          # - Build helpers
                          # - Development utilities

tools/                     # Development tools
                          # - CLI tools
                          # - Developer utilities
                          # - Helper programs

cmd/                       # Command-line applications
                          # - Go CLI programs
                          # - Executable commands

plugins/                   # Plugin system
                          # - Extensible functionality
                          # - Plugin implementations

extensions/                # Extensions and add-ons
                          # - VS Code extensions
                          # - Browser extensions
                          # - Application extensions

skills/                    # Skills or capabilities
                          # - AI/ML skills
                          # - Feature modules
```

### Testing

```
tests/                     # Test files and configurations
                          # - Unit tests
                          # - Integration tests
                          # - E2E tests
                          # - Test utilities

dd-skill-test/            # Datadog skill testing
                          # - Datadog integration tests
                          # - Monitoring validation

precommit/                # Pre-commit configurations
                          # - Code quality checks
                          # - Linting
                          # - Format validation
```

### Documentation

```
docs/                      # Documentation files
                          # - Technical documentation
                          # - User guides
                          # - Architecture docs
                          # - API documentation
```

### Examples & Templates

```
examples/                  # Code examples and samples
                          # - Usage examples
                          # - Sample implementations
                          # - Tutorial code

experiments/              # Experimental features
                          # - Proof of concepts
                          # - Research and development
                          # - Feature prototypes
```

### Static Assets

```
public/                    # Static public assets
                          # - Images, fonts
                          # - Static files served directly
                          # - Public resources
```

### Archive & Legacy

```
archive/                   # Archived files and documentation
                          # - Deprecated code
                          # - Historical documentation
                          # - Old versions

release-archive/          # Archived releases
                          # - Previous release artifacts
                          # - Historical versions

release-v5.1.0-beta/      # Specific release version
                          # - Beta release files
```

### Platform-Specific

```
platforms/                 # Platform-specific implementations
                          # - iOS, Android, Desktop
                          # - Platform adaptations

swift/                     # Swift/iOS code
                          # - iOS application code
                          # - macOS code

fast-openvscode-vm/       # OpenVSCode VM (x86_64)
                          # - Virtual machine configurations
                          # - VSCode server VM

fast-openvscode-vm-arm64/ # OpenVSCode VM (ARM64)
                          # - ARM-based VM configurations
                          # - Apple Silicon support
```

### Domain-Specific Directories

```
mayor/                     # Mayor subsystem
                          # - Purpose TBD (domain-specific)

mbp_m1/                    # MacBook Pro M1 specific
                          # - Platform-specific configurations
                          # - ARM Mac development setup

tundra-dome/              # Tundra Dome subsystem
                          # - Purpose TBD (domain-specific)

td/                        # TD subsystem
                          # - Purpose TBD (abbreviation)

feature_audit/            # Feature auditing
                          # - Feature tracking
                          # - Capability analysis
```

### Recovery & Support

```
recovery/                  # Recovery and backup
                          # - Disaster recovery scripts
                          # - Backup configurations
                          # - System restoration
```

### Dependencies

```
node_modules/             # Node.js dependencies (generated)
                          # - NPM packages
                          # - Third-party libraries

vendor/                    # Third-party vendor code
                          # - External dependencies
                          # - Vendored libraries

third_party/              # Third-party integrations
                          # - External service integrations
                          # - Third-party code
```

### Symbolic Links

```
rig/                       # Symbolic link
                          # → /Users/studio/gt/mbp_m1/crew/default
                          # Points to external rig configuration
```

## Summary Statistics

### Total Top-Level Directories

**Count:** 48 directories (excluding node_modules)

### Categories Breakdown

- **Application Code:** 4 directories (src, server, packages, types)
- **Infrastructure:** 6 directories (infrastructure, infra, deploy, docker, azure, monitoring)
- **Configuration:** 15 hidden config directories + 2 config directories
- **Services:** 4 directories (airflow, daemon, deacon, gitea)
- **Testing:** 3 directories (tests, dd-skill-test, precommit)
- **Documentation:** 1 directory (docs)
- **Tools:** 6 directories (scripts, tools, cmd, plugins, extensions, skills)
- **Platform-specific:** 4 directories (platforms, swift, fast-openvscode-vm, fast-openvscode-vm-arm64)
- **Archive:** 3 directories (archive, release-archive, release-v5.1.0-beta)
- **Other:** Remaining specialized and domain-specific directories

## Key Observations

### Structure Characteristics

1. **Monolithic Organization**: Current structure is primarily monolithic with mixed concerns
2. **Multiple Infrastructure Approaches**: Several overlapping infrastructure directories (infrastructure, infra, deploy)
3. **Service Fragmentation**: Services are scattered (airflow, daemon, deacon) rather than grouped
4. **Configuration Sprawl**: Configuration files spread across multiple directories
5. **Platform-Specific Segregation**: Platform code exists in separate directories rather than integrated
6. **Testing Distribution**: Tests centralized in `tests/` but also found in specialized directories

### Areas of Concern

1. **Lack of Service Boundaries**: No clear service separation or module boundaries
2. **Unclear Ownership**: Many directories have unclear purposes (td, mayor, tundra-dome)
3. **Duplicate Purposes**: Multiple directories serving similar functions (infra/infrastructure, vendor/third_party)
4. **Mixed Abstractions**: High-level services mixed with low-level utilities
5. **No Shared Library Strategy**: Unclear approach to code sharing between services

### Positive Aspects

1. **Clear Source Separation**: `src/` for frontend, `server/` for backend
2. **Centralized Documentation**: Documentation primarily in `docs/`
3. **Standard Tooling**: Uses standard tools (Prisma, Docker, etc.)
4. **Testing Infrastructure**: Dedicated testing directory structure
5. **Git Hooks**: Pre-commit hooks configured for code quality

## Recommendations for Refactoring

Based on this audit, the following areas should be addressed in the modular restructuring:

1. **Service Consolidation**: Group related services under a unified `services/` structure
2. **Shared Code Strategy**: Create a clear `shared/` or `common/` directory for cross-service code
3. **Infrastructure Consolidation**: Merge overlapping infrastructure directories
4. **Configuration Standardization**: Centralize configuration in a standard location
5. **Clear Module Boundaries**: Define explicit service boundaries with independent deployability
6. **Documentation Organization**: Maintain clear documentation per service
7. **Testing Strategy**: Establish testing patterns for multi-service architecture

## Next Steps

1. Define target modular architecture
2. Map existing code to new service boundaries
3. Identify shared dependencies
4. Plan migration strategy
5. Create migration scripts
6. Execute phased refactoring

---

**Audit Completed:** February 14, 2026
**Next Review:** After modular structure definition
