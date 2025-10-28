# Disable Failing Builds - Analysis & Recommendation

## Current Situation

You have **34 active workflows** in `.github/workflows/`, and many are likely failing.

## Recommendation: Disable Non-Essential Workflows

### 1. Move Most Workflows to `disabled-expensive/`

You already have a pattern established. Move failing/costly workflows there:

**Keep these essential workflows**:
- `main-branch-ci.yml` - Lightweight CI for main branch
- `ci-simplified.yml` - Simplified CI pipeline
- `tauri-test.yml` - Tauri testing
- `changelog.yml` - Changelog generation
- `security-audit.yml` - Security scanning

**Disable these expensive/failing workflows**:
- `agents.yml` - If not actively used
- `azure-appservice-deploy.yml` - If not deploying to Azure
- `build-agentapi.yml` - If agentapi not ready
- `build-minimal.yml` - If redundant
- `codeserver-profiles.yml` - Complex, has failures
- `datadog-service-catalog.yml` - If not using service catalog
- `dependency-compatibility.yml` - If not needed
- `docs-ci-cd.yml` - If redundant
- `kind-code-server-smoke.yml` - If KIND not needed
- `release-branch-ci.yml` - If not doing releases
- All `test-*.yml` - Consolidate into one

### 2. Simple Approach: Disable All But Core

Just keep:
1. `main-branch-ci.yml` - Main branch CI
2. `tauri-test.yml` - Tauri testing
3. `security-audit.yml` - Security scanning

Move everything else to `disabled-expensive/`.

## Quick Commands to Disable

```bash
# Navigate to workflows
cd .github/workflows

# Move all except essential to disabled
mv agents.yml azure-appservice-deploy.yml build-agentapi.yml build-minimal.yml codeserver-profiles.yml datadog-service-catalog.yml dependency-compatibility.yml desktop-build.yml db-monitoring-deployment.yml.conflict-backup-1760252204 deploy-docs.yml docs-ci-cd.yml docs-ci-cd.yml.conflict-backup-1760252204 helm-package.yaml kind-code-server-smoke.yml main-branch-ci.yml.conflict-backup-1760252204 minivim-build.yml minivim-neovim-test.yml musl-benchmarks.yml performance-testing.yml release-branch-ci.yml.conflict-backup-1760252204 secret-scanning.yml supply-chain-attestation.yml tauri-release.yml test-amd64-minimal.yml test-amd64-standard.yml test-amd64-web.yml test-ci-simplified.yml test-coverage.yml test-simple.yml disabled-expensive/

# Keep only essential
# main-branch-ci.yml
# ci-simplified.yml  
# tauri-test.yml
# changelog.yml
# security-audit.yml
```

## Alternative: Disable via YAML

Add `workflow_dispatch` only and remove all triggers:

```yaml
# Before
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# After
on:
  workflow_dispatch:  # Can only run manually
```

## Best Approach

**Option 1: Move to disabled-expensive/** (Recommended)
- Keeps history
- Easy to re-enable
- Clean separation

**Option 2: Rename to `.yml.disabled`**
- Simple rename
- Can still see in directory
- GitHub ignores these files

**Option 3: Delete them**
- Not recommended - loses history
- Hard to restore

## Recommendation

1. Move non-essential workflows to `disabled-expensive/`
2. Keep only 5 essential workflows active
3. Fix those 5 to ensure they pass
4. Add back others one at a time as needed

This reduces CI costs by ~85% and eliminates failing build noise.
