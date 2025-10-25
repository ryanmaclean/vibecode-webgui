# VibeCode CLI - Development & Testing Menus

Comprehensive command-line interface for VibeCode development, testing, and validation operations.

## Overview

This implementation provides organized menus for accessing all development and testing scripts in the VibeCode project.

## Installation

The CLI is accessible via:
```bash
# From bin directory
./bin/vibecode-cli

# Or directly
./scripts/vibecode-cli-lib/vibecode-cli-main.sh
```

## Menu Structure

### 1. Development Menu (`dev-menu.sh`)

#### Build Operations (10 scripts)
- **Production Builds**
  - `build-production.sh` - Full production build
  - `build-and-push-codeserver.sh` - Build and push code server
  - `build-multiarch.sh` - Build multiarch images

- **Development Builds**
  - `build-codeserver-local.sh` - Build code server locally
  - `build-and-test-code-server.sh` - Build and test code server
  - `build-apple-runtime.sh` - Build Apple runtime

- **Specialized Builds**
  - `build-codeserver-multiarch.sh` - Build code server multiarch
  - `build-fast-openvscode-vm-with-ai-tools.sh` - Build fast OpenVSCode VM
  - `build-complete-wiki.sh` - Build complete wiki
  - `build-profiles.sh` - Build profiles

#### Development Tools (11 scripts)
- **TypeScript & Test Fixes**
  - `fix-typescript-baseline.sh` - Fix TypeScript baseline
  - `fix-all-tests.sh` - Fix all tests
  - `fix-test-syntax.sh` - Fix test syntax
  - `fix-ts-ignore.sh` - Fix TS ignore statements

- **Component Fixes**
  - `fix-logger-circular-dependency.sh` - Fix logger circular dependency
  - `fix-cognitive-search-adapter.sh` - Fix cognitive search adapter
  - `fix-database-connections.sh` - Fix database connections
  - `fix-network-policy.sh` - Fix network policy

- **Merge & Conflict Resolution**
  - `fix-merge-conflicts.sh` - Fix merge conflicts
  - `fix-merge-conflicts-better.sh` - Fix merge conflicts (improved)

- **General Tools**
  - `dev-tools.sh` - General dev tools

#### Code Quality & Auditing (9 scripts)
- **License & Compliance**
  - `check-licenses.sh` - Check licenses
  - `verify-extension-licenses.sh` - Verify extension licenses
  - `verify-gpl-free.sh` - Verify GPL-free status

- **Security & Auditing**
  - `security-audit.sh` - Security audit
  - `component-status-audit.sh` - Component status audit
  - `audit-documentation.sh` - Audit documentation

- **Verification**
  - `verify-setup.sh` - Verify setup
  - `verify-onboarding.sh` - Verify onboarding
  - `verify-env-consolidation.sh` - Verify environment consolidation

#### Clean & Maintenance (4 scripts)
- `kind-cleanup.sh` - KIND cleanup
- `cleanup-local-env.sh` - Cleanup local environment
- `safe-root-cleanup.sh` - Safe root cleanup
- `check-resource-deletion.sh` - Check resource deletion

**Total Development Scripts: 34**

---

### 2. Testing & Validation Menu (`test-menu.sh`)

#### Unit & Component Tests (20 scripts)
- **All Tests**
  - `run-all-tests.sh` - Run all tests
  - `run-tests.sh` - Run standard tests
  - `test-all-components.sh` - Test all components

- **Component-Specific Tests**
  - `test-cnm-integration.sh` - Test CNM integration
  - `test-litellm-integration.sh` - Test LiteLLM integration
  - `test-code-server-editors.sh` - Test code server editors
  - `run-agentapi-tests.sh` - Test AgentAPI

- **Database Tests**
  - `test-dbm-setup.sh` - Test DBM setup
  - `test-database-scaling.sh` - Test database scaling
  - `test-vector-db-migration.sh` - Test vector DB migration
  - `test-vector-migration-dev.sh` - Test vector migration (dev)
  - `test-vector-migration-edge-cases.sh` - Test edge cases
  - `test-vector-migration-large-dataset.sh` - Test large datasets
  - `test-vector-migration-rollback.sh` - Test rollback
  - `test-vector-error-handling.sh` - Test error handling
  - `test-vector-migration-utility.sh` - Test migration utility

- **Monitoring & Observability**
  - `test-monitoring.sh` - Test monitoring
  - `test-health-endpoints.sh` - Test health endpoints
  - `test-datadog-musl-build.sh` - Test Datadog MUSL build
  - `run-dbm-scenarios.sh` - Run DBM scenarios

#### Integration Tests (14 scripts)
- **Kubernetes Integration**
  - `test-k8s-complete.sh` - Test K8s complete
  - `test-k8s-core-functionality.sh` - Test K8s core
  - `test-k8s-health-probes.sh` - Test K8s health probes
  - `test-kind-deployment.sh` - Test KIND deployment
  - `test-code-server-kind.sh` - Test code server KIND

- **Deployment Integration**
  - `test-complete-deployment.sh` - Test complete deployment
  - `test-without-docker.sh` - Test without Docker
  - `test-docs-deployment.sh` - Test docs deployment
  - `test-docs.sh` - Test docs

- **Automation Integration**
  - `test-full-automation.sh` - Test full automation
  - `test-gitops-automation.sh` - Test GitOps automation
  - `test-authelia-automation.sh` - Test Authelia automation

- **Optimization Tests**
  - `test-optimizations-simple.sh` - Test optimizations
  - `test-experiments-validation.sh` - Test experiments validation

#### E2E & Accessibility Tests (2 scripts)
- `run-accessibility-tests.sh` - Run accessibility tests
- `run_perf_tests.sh` - Run performance tests

#### Validation & Verification (22 scripts)
- **Setup & Configuration Validation**
  - `validate-complete-setup.sh` - Validate complete setup
  - `validate-helm.sh` - Validate Helm
  - `validate-gitops-setup.sh` - Validate GitOps setup
  - `validate-env-config.sh` - Validate environment config
  - `validate-database-config.sh` - Validate database config

- **Deployment Validation**
  - `validate-deployment-readiness.sh` - Validate deployment readiness
  - `validate-deployment-workflows.sh` - Validate deployment workflows
  - `validate-web-testing-workflows.sh` - Validate web testing workflows

- **Container & Docker Validation**
  - `validate-arm64-dockerfile.sh` - Validate ARM64 Dockerfile
  - `validate-container-optimizations.sh` - Validate container optimizations
  - `validate-dockerfile-optimization.sh` - Validate Dockerfile optimization

- **Monitoring & Health Validation**
  - `validate-healthchecks.sh` - Validate healthchecks
  - `validate-postgres-monitoring.sh` - Validate Postgres monitoring
  - `validate-dbm-apm-connection.sh` - Validate DBM APM connection

- **System Verification**
  - `verify-setup.sh` - Verify setup
  - `verify-onboarding.sh` - Verify onboarding
  - `verify-env-consolidation.sh` - Verify environment consolidation
  - `verify-datadog-dbm.sh` - Verify Datadog DBM
  - `verify-dns-ssl.sh` - Verify DNS & SSL
  - `verify-docker-go-fix.sh` - Verify Docker Go fix
  - `verify-goose.sh` - Verify Goose
  - `verify-llm-observability.sh` - Verify LLM observability

#### Comprehensive Test Suites (3 scripts)
- `comprehensive-k8s-tests.sh` - Comprehensive K8s tests
- `comprehensive-kind-testing.sh` - Comprehensive KIND testing
- `comprehensive-validation.sh` - Comprehensive validation

**Total Testing Scripts: 61**

---

## Total Scripts Mapped

| Category | Count |
|----------|-------|
| Build Operations | 10 |
| Development Tools | 11 |
| Code Quality & Auditing | 9 |
| Clean & Maintenance | 4 |
| Unit & Component Tests | 20 |
| Integration Tests | 14 |
| E2E & Accessibility Tests | 2 |
| Validation & Verification | 22 |
| Comprehensive Test Suites | 3 |
| **TOTAL** | **95** |

## Usage Examples

### Interactive Mode
```bash
# Launch main menu
./bin/vibecode-cli

# Navigate through menus using number keys
```

### Direct Command Mode
```bash
# Open development menu directly
./bin/vibecode-cli dev

# Open testing menu directly
./bin/vibecode-cli test
```

### Help
```bash
./bin/vibecode-cli --help
```

## Architecture

```
scripts/vibecode-cli-lib/
├── vibecode-cli-main.sh  # Main entry point with central hub
├── dev-menu.sh           # Development operations menu
├── test-menu.sh          # Testing & validation menu
└── README.md             # This file

bin/
└── vibecode-cli          # Symlink to vibecode-cli-main.sh
```

## Features

- **Color-coded output** for better readability
- **Hierarchical menu system** with logical grouping
- **Error handling** for missing scripts
- **Interactive navigation** with option to return to previous menus
- **Direct command access** via CLI arguments
- **Confirmation prompts** for destructive operations
- **Comprehensive script mapping** covering 95+ scripts

## Future Enhancements

Integration points for additional menus (planned from other agents):
- Deployment & Infrastructure menu
- Security & Database menu
- VM Operations menu

## Navigation Tips

- Use number keys to select menu options
- Press `0` to go back to the previous menu
- Press `Ctrl+C` to exit at any time
- Read confirmation prompts carefully for destructive operations

## Script Organization

All scripts are organized by function:
- **Build**: Compilation and image building
- **Dev Tools**: Development utilities and fixes
- **Quality**: Auditing, linting, and compliance
- **Clean**: Cleanup and maintenance
- **Unit Tests**: Component and unit testing
- **Integration**: System integration tests
- **E2E**: End-to-end and accessibility tests
- **Validation**: Configuration and setup validation
- **Verification**: System state verification

## Contributing

When adding new scripts:
1. Place script in appropriate `scripts/` subdirectory
2. Add menu entry to relevant menu file
3. Update this README with script details
4. Test menu navigation and script execution

## License

Part of the VibeCode project.
