# Branch Cleanup Documentation

## Overview

This document tracks the cleanup of merged branches in the vibecode-webgui repository. These branches have been merged into the main branch and are no longer needed.

## Statistics

- **Total remote branches**: 405
- **Merged branches still in remote**: 113
- **Analysis date**: 2026-02-01

## How to Delete Branches

### Option 1: Using the GitHub Actions Workflow

1. Go to the Actions tab in the repository
2. Select the "Cleanup Merged Branches" workflow
3. Click "Run workflow"
4. First run with `dry_run=true` to preview what will be deleted
5. Then run with `dry_run=false` to actually delete the branches

### Option 2: Using the Shell Script

```bash
# Run the cleanup script
./scripts/cleanup-branches.sh /tmp/branches_to_delete.txt
```

**Prerequisites:**
- GitHub CLI (`gh`) must be installed
- You must be authenticated: `gh auth login`
- You must have write access to the repository

### Option 3: Manual Deletion via GitHub CLI

```bash
# Delete a single branch
gh api -X DELETE "repos/ryanmaclean/vibecode-webgui/git/refs/heads/BRANCH_NAME"
```

## Branches to Delete

The following 113 branches have been merged and can be safely deleted:

### Chore Branches (4)
- 2026-01-31-iohz-7054c
- chore/codeowners
- chore/readme-cleanup
- chore/root-cleanup-part2

### Copilot Branches (2)
- copilot/cleanup-branches
- copilot/sub-pr-1061

### Feature Audit Branches (82)
- feature-audit-1289
- feature-audit-1290
- feature-audit-1291
- feature-audit-1292
- feature-audit-1293
- feature-audit-1294
- feature-audit-1295
- feature-audit-1299-datadog
- feature-audit-1300-opentelemetry
- feature-audit-1301-prometheus-metrics
- feature-audit-1303-custom-dashboards
- feature-audit-1305-memory-footprint
- feature-audit-1321-eslint
- feature-audit-1322-monaco-core
- feature-audit-1323-intellisense
- feature-audit-1331
- feature-audit-1389
- feature-audit-1390
- feature-audit-1437-git-integration
- feature-audit-1438-multi-language
- feature-audit-1439-native-vm-images
- feature-audit-1440-vibecode-postgresql
- feature-audit-1443
- feature-audit-1444
- feature-audit-1445
- feature-audit-1446
- feature-audit-1447
- feature-audit-1448
- feature-audit-1449
- feature-audit/1239-pgvector
- feature-audit/1269-feature-audit-tauri-2-9-1-integration-native-desktop-application-built-with-rust-swift
- feature-audit/1270-feature-audit-openvscode-server-backend-full-vs-code-experience-with-native-rust-cli-no-docker-required
- feature-audit/1271-feature-audit-cross-platform-support-macos-intel-apple-silicon-linux-x86-64-arm64-windows-x86-64
- feature-audit/1272-feature-audit-native-system-integration-platform-native-menus-notifications-and-system-tray-support
- feature-audit/1372-dropbear-ssh
- feature-audit/1373-openvscode-localhost-3000
- feature-audit/1384-feature-audit-real-time-status-monitoring
- feature-audit/1385-feature-audit-console-output-viewer
- feature-audit/1386-feature-audit-service-health-indicators
- feature-audit/1411-extension-files
- feature-audit/1412-auto-load
- feature-audit/1413-init-script
- feature-audit/1441-feature-audit-vibecode-valkey-10gb-redis-compatible-in-memory-store
- feature-audit/1442-feature-audit-vibecode-nodejs-50gb-node-js-development-environment
- feature-audit/1443-feature-audit-vibecode-nodejs-codeserver-50gb-node-js-code-server
- feature-audit/1444-feature-audit-vibecode-pgvector-20gb-postgresql-with-vector-extensions
- feature-audit/1445-feature-audit-vibecode-ide-50gb-full-ide-environment
- feature-audit/1449-feature-audit-datadog-integration-optional-metrics-and-apm-3-integration-methods-ssh-cloud-init-lima
- feature-audit/1450-feature-audit-opentelemetry-tracing-distributed-tracing-support-with-otlp-exporters
- feature-audit/1501-otlp-traces
- feature-audit/gh-1259
- feature-audit/gh-1260
- feature-audit/gh-1262
- feature-audit/gh-1263
- feature-audit/gh-1264
- feature-audit/gh-1265
- feature-audit/gh-1266
- feature-audit/gh-1267
- feature-audit/gh-1268
- feature-audit/gh-1431
- feature-audit/gh-1522
- feature-audit/gh-1523
- feature-audit/issue-1249
- feature-audit/issue-1250
- feature-audit/issue-1251
- feature-audit/issue-1252
- feature-audit/issue-1421
- feature-audit/issue-1423
- feature-audit/issue-1424
- feature-audit/issue-1518
- feature-audit/issue-1519
- feature-audit/issue-1520
- feature/feature-audit-1251
- feature/feature-audit-1252
- feature/feature-audit-1253

### Fix Branches (18)
- fix/arm64-cross-compile-packages
- fix/ci-test-failures
- fix/rust-import-parsing-bug
- fix/ts-strict-connection-pool-monitor-989
- fix/typescript-api-routes-any
- fix/typescript-catch-unknown
- fix/typescript-components-any-batch2
- fix/typescript-protocols-adapters-any
- fix/typescript-strict-api-management-982-final
- fix/typescript-strict-auto-scaler-983
- fix/typescript-strict-components-991-final
- fix/typescript-strict-mode-1023
- fix/typescript-strict-mode-1025
- fix/typescript-strict-mode-1026
- fix/typescript-strict-mode-1027
- fix/typescript-strict-mode-1028
- fix/typescript-strict-mode-1032
- fix/typescript-strict-mode-1033
- fix/typescript-strict-mode-1034
- fix/typescript-strict-mode-1041
- fix/typescript-strict-mode-1042
- fix/typescript-strict-mode-1044
- fix/typescript-strict-mode-1052
- fix/typescript-strict-mode-1053

### Polecat Branches (6)
- polecat/malachite/hq-004@mkpr7gzs
- polecat/pyrite/st-706@mkmsjmce
- polecat/vibecode-107/st-sh2py-bench@ml2jzanl
- polecat/vibecode-108/st-sh2py-tests@ml2jzv7b
- polecat/vibecode-109/st-sh2py-cli@ml2k0fyf
- polecat/vibecode-110/st-sh2py-util@ml2k10le
- polecat/vibecode-111/st-sh2py-security@ml2k1lcc

### Test Branches (1)
- test/api-route-coverage-953

## Safety Checks

The cleanup script and workflow include the following safety checks:

1. **Protected branches**: Branches named `main`, `master`, `develop`, `staging`, or `production` are never deleted
2. **Merged verification**: Only branches that have been merged via pull requests are considered
3. **Dry run option**: The workflow defaults to dry-run mode for review before actual deletion
4. **Confirmation prompt**: The shell script requires user confirmation before deletion

## Next Steps

1. Review the list of branches above
2. Run the workflow in dry-run mode to verify
3. Execute the cleanup (either via workflow or script)
4. Verify that no important branches were accidentally deleted

## Notes

- All branches listed have been merged into main and are no longer active
- The associated pull requests have been closed
- These branches are safe to delete without losing any code or history
- The main branch contains all the code from these merged branches
