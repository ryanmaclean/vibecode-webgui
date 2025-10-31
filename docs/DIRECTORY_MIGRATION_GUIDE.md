# Directory Migration Guide

## Overview

On **October 28, 2025**, the VibeCode WebGUI repository underwent a comprehensive directory reorganization to improve project structure, maintainability, and developer experience. This guide documents all changes and provides migration instructions for developers, CI/CD systems, and documentation.

### Why This Reorganization?

The previous directory structure had grown organically over time, leading to:

- **Inconsistent naming conventions** - Mix of `kubernetes/`, `k8s/`, `helm/`, and `charts/`
- **Cluttered root directory** - Too many top-level directories making navigation difficult
- **Poor discoverability** - Related files scattered across multiple locations
- **CI/CD confusion** - Multiple potential paths for the same resource types
- **Platform-specific sprawl** - macOS-related directories not grouped logically

The reorganization follows these principles:

1. **Consistency** - Standard naming conventions across the codebase
2. **Logical grouping** - Related resources organized by function/platform
3. **Clean root** - Frequently accessed directories remain at root; others consolidated
4. **Better discoverability** - Intuitive paths for finding resources
5. **Maintainability** - Easier to navigate and maintain over time

---

## Directory Changes Reference Table

| Old Path | New Path | Type | Notes |
|----------|----------|------|-------|
| `kubernetes/` | `k8s/` | Directory | Standard k8s abbreviation; contains all Kubernetes manifests |
| `helm/` | `charts/` | Directory | Industry-standard naming for Helm charts |
| `configs/` | `config/` | Directory | Singular form (consistent with conventions); all configuration files |
| `demo/` | `demos/` | Directory | Plural form for consistency; contains demo applications |
| `macos-*` directories | `platforms/macos/*` | Directory | Platform-specific code grouped under platforms/ |
| `macos-vm/` | `platforms/macos/vm/` | Directory | macOS VM-related code |
| `macos-native-build/` | `platforms/macos/native-build/` | Directory | macOS native build artifacts |
| `macos-fleet-orchestration/` | `platforms/macos/fleet-orchestration/` | Directory | Fleet management for macOS |
| `macos-services/` | `platforms/macos/services/` | Directory | macOS-specific services |
| Test artifacts (scattered) | `tests/*` | Directory | All test files consolidated |
| `audit-results/` | `security/audit-results/` | Directory | Security audit results grouped |
| Security verifications | `security/verifications/` | Directory | Security verification artifacts |
| `reports/` (root) | `docs/reports/` | Directory | Reports moved to documentation |
| `releases/` (root) | `docs/releases/` | Directory | Release artifacts archived in docs |
| Old build artifacts | `docs/archive/old-builds/` | Directory | Historical builds archived |
| `.opencode/` | `config/ide/.opencode/` | Directory | IDE configuration files grouped |
| Config alternatives | `config/alternatives/` | Directory | Alternative configuration examples |
| Environment examples | `config/env-examples/` | Directory | Environment file templates |
| Lighthouse config | `config/lighthouse/` | Directory | Performance testing configuration |

---

## What Stayed at Root

The following directories remain at the root level and should **NOT** be moved:

### Active Development Directories

- **`claudedocs/`** - Claude AI documentation and context files
  - *Reason:* Frequently accessed by Claude and development tools

- **`electron-vibecode/`** - Electron application codebase
  - *Reason:* Active development; separate application boundary

- **`datadog/`** - Datadog monitoring configurations and integrations
  - *Reason:* Frequently accessed for debugging and monitoring

- **`src/`** - Main application source code
  - *Reason:* Core application code; standard convention

- **`scripts/`** - Build, deployment, and utility scripts
  - *Reason:* Frequently referenced; standard location

- **`docker/`** - Docker configurations and Dockerfiles
  - *Reason:* Build system dependency; standard convention

### Go Module Requirement

- **`go/`** - Go module root
  - *Reason:* **CRITICAL** - Go modules require specific directory structure at repository root. Moving this would break Go module resolution and imports.

### Infrastructure and Operations

- **`infrastructure/`** - Terraform/OpenTofu infrastructure as code
  - *Reason:* Standard IaC location; frequently accessed

- **`tofu/`** - OpenTofu-specific configurations
  - *Reason:* Active infrastructure management

- **`ansible/`** - Ansible playbooks and roles
  - *Reason:* Configuration management; standard location

### Standard Project Files

- **`public/`** - Static assets for web application
  - *Reason:* Next.js convention; build system dependency

- **`prisma/`** - Database schema and migrations
  - *Reason:* Prisma CLI requirement; standard location

---

## Updating Your Workflows

### For Developers

#### 1. Update Import Paths

If your code references moved directories, update the paths:

```typescript
// Old
import config from '../configs/ai-providers.json';

// New
import config from '../config/ai-providers.json';
```

#### 2. Update Documentation References

Search your local documentation and comments for old paths:

```bash
# Find references to old paths
grep -r "configs/" docs/
grep -r "kubernetes/" docs/
grep -r "helm/" docs/
grep -r "macos-" docs/

# Replace with new paths
# Use your editor's find-and-replace functionality
```

#### 3. Update Local Scripts

If you have personal scripts referencing old paths:

```bash
# Old
./scripts/deploy.sh charts/vibecode-platform

# New
./scripts/deploy.sh charts/vibecode-platform
```

#### 4. Pull Latest Changes

```bash
# Ensure you have the latest structure
git pull origin main

# Verify new structure
ls -la k8s/
ls -la charts/
ls -la platforms/
```

---

### For CI/CD

#### GitHub Actions Workflows

Update workflow files in `.github/workflows/`:

```yaml
# Old
- name: Deploy Helm Chart
  run: helm install vibecode ./charts/vibecode-platform

# New
- name: Deploy Helm Chart
  run: helm install vibecode ./charts/vibecode-platform
```

```yaml
# Old
- name: Apply Kubernetes Manifests
  run: kubectl apply -f kubernetes/

# New
- name: Apply Kubernetes Manifests
  run: kubectl apply -f k8s/
```

#### Docker Build Contexts

Update Dockerfile paths if they reference configuration:

```dockerfile
# Old
COPY configs/ /app/configs/

# New
COPY config/ /app/config/
```

#### Helm Chart References

Update values files and helmfile configurations:

```yaml
# helmfile.yaml - Old
releases:
  - name: vibecode
    chart: ./charts/vibecode-platform

# helmfile.yaml - New
releases:
  - name: vibecode
    chart: ./charts/vibecode-platform
```

#### Jenkins/GitLab CI

Update pipeline configurations:

```groovy
// Old
sh "kubectl apply -f kubernetes/"

// New
sh "kubectl apply -f k8s/"
```

---

### For Documentation

#### 1. Update Markdown Links

Search and replace in documentation files:

```markdown
<!-- Old -->
See [Configuration Guide](../configs/README.md)
See [Kubernetes Setup](../kubernetes/README.md)

<!-- New -->
See [Configuration Guide](../config/README.md)
See [Kubernetes Setup](../k8s/README.md)
```

#### 2. Update Code Examples

Ensure code examples reflect new paths:

```markdown
<!-- Old -->
```bash
helm install vibecode ./charts/vibecode-platform
```

<!-- New -->
```bash
helm install vibecode ./charts/vibecode-platform
```
```

#### 3. Update README Files

Update any README files that reference directory structure:

```markdown
<!-- Old -->
- configs/ - Configuration files
- kubernetes/ - K8s manifests

<!-- New -->
- config/ - Configuration files
- k8s/ - Kubernetes manifests
```

---

## Common Migration Patterns

### Helm Charts

```bash
# Old
helm install vibecode ./charts/vibecode-platform
helm upgrade vibecode ./charts/vibecode-platform
helm lint ./charts/vibecode-platform

# New
helm install vibecode ./charts/vibecode-platform
helm upgrade vibecode ./charts/vibecode-platform
helm lint ./charts/vibecode-platform
```

### Configuration Files

```bash
# Old - Environment setup
source configs/env.example
cp configs/.env.example .env

# New - Environment setup
source config/env-examples/env.example
cp config/env-examples/.env.example .env
```

```bash
# Old - AI configuration
cp configs/ai-providers.example.json configs/ai-providers.json

# New - AI configuration
cp config/ai-providers.example.json config/ai-providers.json
```

### Kubernetes Manifests

```bash
# Old
kubectl apply -f kubernetes/
kubectl apply -f kubernetes/deployments/
kubectl delete -f kubernetes/

# New
kubectl apply -f k8s/
kubectl apply -f k8s/deployments/
kubectl delete -f k8s/
```

```bash
# Old - Kustomize
kubectl apply -k kubernetes/overlays/production

# New - Kustomize
kubectl apply -k k8s/overlays/production
```

### macOS Platform Development

```bash
# Old - Build macOS native
cd macos-native-build && make

# New - Build macOS native
cd platforms/macos/native-build && make
```

```bash
# Old - VM testing
./macos-vm/scripts/test.sh

# New - VM testing
./platforms/macos/vm/scripts/test.sh
```

```bash
# Old - Fleet orchestration
cd macos-fleet-orchestration && ./deploy.sh

# New - Fleet orchestration
cd platforms/macos/fleet-orchestration && ./deploy.sh
```

### Running Tests

```bash
# Old - Test artifacts were scattered
./test-results/
./test-output/
./tests/

# New - All test artifacts consolidated
./tests/
./tests/e2e/
./tests/integration/
./tests/archive/
```

### Security Audits

```bash
# Old
cat audit-results/latest-scan.json

# New
cat security/audit-results/latest-scan.json
```

```bash
# Old - View audit reports
ls -la audit-results/

# New - View audit reports
ls -la security/audit-results/
```

### Demo Applications

```bash
# Old
cd demo && npm start

# New
cd demos && npm start
```

---

## Verification Steps

Follow these steps to verify your local repository is correctly updated:

### 1. Verify Directory Structure

```bash
# Check new directories exist
ls -la k8s/
ls -la charts/
ls -la config/
ls -la demos/
ls -la platforms/
ls -la security/

# Check old directories are gone
ls -la kubernetes/     # Should not exist
ls -la helm/           # Should not exist
ls -la configs/        # Should not exist
ls -la macos-*/        # Should not exist
```

### 2. Verify Symlinks (if any)

```bash
# Check for any broken symlinks
find . -type l -exec test ! -e {} \; -print
```

### 3. Run Tests

```bash
# Verify tests still pass with new structure
npm test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

### 4. Verify Build Process

```bash
# Ensure build still works
npm run build

# Verify Docker build
docker build -t vibecode-test .

# Verify Helm chart
helm lint ./charts/vibecode-platform
```

### 5. Check Git Status

```bash
# Ensure no unexpected changes
git status

# Verify you're on the correct branch
git branch --show-current
```

### 6. Verify Configuration Loading

```bash
# Test configuration files are found
node -e "console.log(require('./config/ai-providers.example.json'))"

# Verify environment examples
cat config/env-examples/env.example
```

---

## Rollback Instructions

If you need to access the old structure or experience issues:

### Option 1: Access Old Structure via Git History

```bash
# View files from before migration
git log --oneline --since="2025-10-27" --until="2025-10-28"

# Checkout specific file from before migration
git checkout <commit-hash> -- path/to/old/file

# View old directory structure
git show <commit-hash>:kubernetes/
```

### Option 2: Create a Reference Branch

```bash
# Create a branch pointing to pre-migration state
git checkout -b pre-migration <commit-hash-before-migration>

# Switch back to main
git checkout main

# Reference old structure anytime
git show pre-migration:kubernetes/deployment.yaml
```

### Option 3: Temporary Workaround with Symlinks

**WARNING:** Only use temporarily during transition period.

```bash
# Create temporary symlinks (NOT recommended for permanent use)
ln -s k8s kubernetes
ln -s charts helm
ln -s config configs

# Remove when migration is complete
rm kubernetes helm configs
```

### Option 4: Cherry-pick Specific Files

```bash
# If you need specific files from old structure
git log --all --full-history -- "kubernetes/*"
git checkout <commit-hash> -- kubernetes/specific-file.yaml
mv kubernetes/specific-file.yaml k8s/
```

### Option 5: Full Revert (Emergency Only)

```bash
# ONLY if migration causes critical issues
git revert <migration-commit-hash>

# Or reset to before migration (DESTRUCTIVE)
git reset --hard <commit-hash-before-migration>
```

---

## FAQs

### Q: Will my existing clones break?

**A:** Existing local clones will receive the new structure when you `git pull`. Update your scripts and workflows accordingly.

### Q: What about CI/CD pipelines?

**A:** Update workflow files to reference new paths. See the "For CI/CD" section above.

### Q: Are there any breaking changes to APIs?

**A:** No. This is purely a directory structure change. Application functionality remains unchanged.

### Q: What if I find a reference to an old path?

**A:** Please update it and submit a PR, or open an issue with the location.

### Q: How do I update submodules?

**A:** If you have submodules referencing old paths:

```bash
git submodule update --remote
# Edit .gitmodules if paths have changed
git add .gitmodules
git commit -m "Update submodule paths"
```

### Q: Can I use symlinks permanently?

**A:** No. Symlinks are not version controlled and will cause issues for other developers. Update your references instead.

### Q: What about IDE configurations?

**A:** IDE-specific configs have been moved to `config/ide/`. Update your IDE settings if needed.

### Q: Where are old build artifacts?

**A:** Historical builds are archived in `docs/archive/old-builds/`.

---

## Getting Help

If you encounter issues during migration:

1. **Check this guide** - Review the relevant section above
2. **Search existing issues** - Someone may have encountered the same problem
3. **Create an issue** - Use the "Migration Issue" template
4. **Contact the team** - Reach out in the #engineering channel

---

## Checklist for Migration

Use this checklist to ensure complete migration:

- [ ] Pull latest changes from main branch
- [ ] Verify new directory structure exists
- [ ] Update local scripts referencing old paths
- [ ] Update IDE project settings if needed
- [ ] Run test suite to verify nothing broke
- [ ] Update any personal documentation/notes
- [ ] Review CI/CD workflows for your services
- [ ] Update Docker build files if applicable
- [ ] Test Helm deployments with new paths
- [ ] Update Kubernetes manifests references
- [ ] Verify configuration files load correctly
- [ ] Check for broken symlinks
- [ ] Update team documentation you own
- [ ] Remove any old bookmarks/shortcuts

---

## Related Documentation

- [Project Architecture](./ARCHITECTURE.md)
- [Configuration Guide](../config/README.md)
- [Kubernetes Deployment](./DEPLOYMENT.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

---

**Last Updated:** October 28, 2025
**Migration Version:** 1.0
**Status:** Active
