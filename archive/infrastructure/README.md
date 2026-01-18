# Archived: Infrastructure Code

**Archived:** 2026-01-15
**Agent:** AGENT 164 - Archive Infrastructure
**Reason:** Infrastructure not needed for local macOS menubar app

## What was this?

This directory contains all infrastructure code that was used when VibeCode was designed as a cloud-based service. It includes:

### Docker & Containers
- **docker/** - Docker configurations for various services
- **Dockerfile**, **Dockerfile.production** - Root-level Docker build files
- **docker-compose*.yml** - Multiple compose configurations for different environments
- **.dockerignore** - Docker ignore patterns

### Kubernetes & Orchestration
- **k8s/** - Kubernetes manifests and configurations
- **helm/** - Helm charts for Kubernetes deployments
- **helm-charts/** - Additional Helm chart configurations

### Cloud Infrastructure
- **cloud/tofu/** - OpenTofu (Terraform alternative) infrastructure as code
- **cloud/ansible/** - Ansible playbooks and automation scripts
- **cloud/azure-functions/** - Azure Functions for serverless compute
- **cloud/azure/** - Azure-specific infrastructure configs, scripts, and docs
  - Files: Dockerfiles, bicep templates, build scripts, VM configs
  - Docs: Azure deployment guides
  - Scripts: Cloud deployment automation
  - **NOTE:** SwiftUI-Apps preserved in `/azure/SwiftUI-Apps/`

### Services
- **services/** - Microservices architecture (ai-gateway, etc.)

### Monitoring
- **monitoring/** - Monitoring configurations and dashboards

### CI/CD
- **github-workflows/** - Archived GitHub Actions workflows
  - Build and push image workflows
  - Cloud deployment workflows
  - Desktop build workflows (Tauri, etc.)
  - Release workflows
  - **NOTE:** Essential macOS workflows preserved in active `.github/workflows/`

### Additional Files
- **datadog-azure-embedding-dashboard.json** - Datadog monitoring dashboard
- **run-azure-embedding-e2e-tests.js** - Azure E2E test runner
- **vibecode-docker-doctor.datadog.yaml** - Docker health monitoring
- **jest.no-docker.config.js** - Jest config without Docker
- **postcss.config.docker.js** - PostCSS Docker configuration

## Why archived?

VibeCode has pivoted to be a **local macOS menubar application** rather than a cloud-based service. The infrastructure code for:
- Docker containers
- Kubernetes deployments
- Cloud provider configurations (Azure, AWS, GCP)
- Microservices architecture
- CI/CD pipelines for cloud deployments

...is no longer needed for the core menubar app functionality.

## What was preserved?

### Active Infrastructure
The following remain active for local development:
- `.github/workflows/build-macos.yml` - macOS build workflow
- `.github/workflows/ci.yml` - Core CI checks
- `.github/workflows/e2e.yml` - E2E tests
- `.github/workflows/pr-checks.yml` - PR validation
- `.github/workflows/security-scan.yml` - Security scanning
- Other essential development workflows

### SwiftUI App
- **`/azure/SwiftUI-Apps/`** - Core menubar application (NOT archived)
  - This contains the main VibeCode menubar app
  - Will be relocated by AGENT 166 to proper location

## How to restore?

If you need to restore any infrastructure code:

```bash
# Restore Docker
cp -r archive/infrastructure/docker/ docker/
cp archive/infrastructure/Dockerfile* .
cp archive/infrastructure/docker-compose*.yml .
cp archive/infrastructure/.dockerignore* .

# Restore Kubernetes
cp -r archive/infrastructure/k8s/ k8s/
cp -r archive/infrastructure/helm/ helm/

# Restore cloud infrastructure
cp -r archive/infrastructure/cloud/tofu/ tofu/
cp -r archive/infrastructure/cloud/ansible/ ansible/
cp -r archive/infrastructure/cloud/azure-functions/ azure-functions/

# Restore services
cp -r archive/infrastructure/services/ services/

# Restore workflows
cp archive/infrastructure/github-workflows/* .github/workflows/
```

## Archive Statistics

Run this to see archive contents:
```bash
find archive/infrastructure/ -type f | wc -l
du -sh archive/infrastructure/
```

## Related Agents

- **AGENT 163**: Archive Mobile/Desktop (parallel)
- **AGENT 165**: Archive Legacy Code (parallel)
- **AGENT 166**: Archive SwiftUI (depends on this)

## Notes

This archive preserves the entire infrastructure codebase for historical reference and potential future use. All code is intact and functional as of the archive date.
