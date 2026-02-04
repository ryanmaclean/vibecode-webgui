# Codebase Cleanup Audit Report
**Task ID**: st-8qm
**Date**: 2026-01-19
**Auditor**: vibecode/polecats/mica

## Executive Summary

This audit identified **100+ files and directories** that are candidates for cleanup, including:
- 6 stale git branches (3+ months old)
- 3 empty directories
- 11 backup files in root
- 19 test/debug scripts in root
- 8 screenshot/image files in root
- 12 text report files in root
- 1 old database backup directory
- 150+ commented-out code blocks (mostly logger imports)
- 15+ significant commented functions
- 3 disabled API routes

## 1. Stale Git Branches

### Local Branches (3+ months old, candidates for deletion)
| Branch | Last Commit | Age | Status |
|--------|-------------|-----|--------|
| `minivim-refresh` | 2025-10-30 | 3 months | Unmerged |
| `backup/2025-10-29-ai-cleanup` | 2025-11-01 | 3 months | Unmerged |
| `release/2025-11-apple-vm` | 2025-11-01 | 3 months | Unmerged |
| `feat/unified-launcher-openvscode-vm` | 2025-11-17 | 9 weeks | Unmerged |
| `feature/workspace-rag-mlx-ddtrace` | 2025-11-18 | 9 weeks | Unmerged |
| `feature/workspace-rag-swift-container` | 2025-11-18 | 9 weeks | Unmerged |

### Merged Branches (safe to delete)
| Branch | Status |
|--------|--------|
| `phase2/sprint1-basic-integration` | Merged into main |
| `origin/phase2/sprint1-basic-integration` | Merged into main |

**Recommendation**: Archive or delete these branches after verifying no unique work exists on them.

### Audit Notes (2026-02-04)

- `feature/workspace-rag-mlx-ddtrace`: MLX + ddtrace tracing support already exists in `src/tracing/MLXEmbeddingService.ts`. The remote branch no longer exists on `origin`.
- `feature/workspace-rag-swift-container`: Docker Compose + auto-password artifacts were missing from main. Restored `docker-compose.openvscode.yml`, `init-db.sql`, and `scripts/openvscode-entrypoint.sh` to align with docker-database docs.

## 2. Empty Directories

| Directory | Status |
|-----------|--------|
| `./watermarkpodautoscaler/` | Completely empty |
| `./templates/nestjs-embedjs-template/` | Completely empty |
| `./vendor/vfkit/` | Completely empty |

**Recommendation**: Delete these empty directories.

## 3. Backup and Conflict Files

### Root Directory Backups
```
./docker-compose.yml.conflict-backup-1760252204
./docker-compose.multiarch.yml.conflict-backup-1760252202
./tsconfig.json.conflict-backup-1760252204
./fix-merge-conflicts.sh.backup
./resolve-source-conflicts.sh.backup
./resolve-conflicts.sh.backup
./eslint.config.mjs.backup
./jest.config.mjs.backup
./jest.config.mjs.from-merge
./health-route-test.salvage.ts
./TODO.md.backup
```

### Nested Backup Files
```
./docker/Dockerfile.backup
./k8s/kind-test-config.yaml.conflict-backup-1760252202
./docs/package-lock.json.conflict-backup-1760252203
./docs/package.json.conflict-backup-1760252203
./logs/vibecode.log.backup-1761950732
./scripts/setup-backup-strategy.sh.bak.1759079306
./scripts/resolve-source-conflicts.sh.backup
./scripts/fix-merge-conflicts-better.sh.backup-1760252802
./scripts/deploy-kind-postgres-monitoring.sh.backup-1760252801
./scripts/fix-merge-conflicts.sh.backup-1760252801
./scripts/resolve-conflicts.sh.backup
./scripts/setup-postgres-datadog-monitoring.sh.backup-1760252802
./web-dashboard/package.json.conflict-backup-1760252204
```

**Recommendation**: Delete all backup and conflict resolution files after verifying active files are correct.

## 4. Test and Debug Files in Root

### Debug Scripts (19 files)
```
debug-connection.ts
debug-db-connection.ts
debug-embedding-setup.js
debug-openrouter-response.js
debug-openrouter-success.js
test-connection-detailed.cjs
test-connection-simple.cjs
test-datadog-api.cjs
test-datadog-api.js
test-db-metrics-simple.js
test-postgres-connection.cjs
test-rag-basic.ts
test-rag-connection.cjs
test-rag-datadog.cjs
test-rag-direct-sql.ts
test-rag-manual.ts
test-rag-simple.cjs
test-real-rag.cjs
test-vector-db.js
```

**Recommendation**: Move these to `tests/manual/` or `scripts/debug/` directory, or delete if obsolete.

## 5. Image Files in Root Directory

```
code_server_diy_diagram.png (58KB)
demo.gif
dmg-datadog-proof.png (70KB)
final-signed-test-02-desktop.png (4.7MB)
get-extension-info-error.png (80KB)
get-extension-info-v2-error.png (80KB)
installation-first-launch.png (256KB)
openvscode-server-working-8080.png (61KB)
```

**Total Size**: ~5.2MB

**Recommendation**: Move to `docs/images/` or `assets/screenshots/` directory.

## 6. Text Report Files

```
BENCHMARK_COMPLETION_REPORT.txt
BENCHMARK_FILES_MANIFEST.txt
BENCHMARK_QUICK_REFERENCE.txt
DATADOG_EXTENSION_FINAL_REPORT.txt
DELIVERABLES_INDEX.txt
MENUBAR_TEXT_CHANGES_SUMMARY.txt
RALPH_LOOP_STATUS_HONEST_ASSESSMENT.txt
SECURITY_ANALYSIS_SUMMARY.txt
TEST_VERIFICATION_SUMMARY_v3.2.1.txt
UPDATE_VERIFICATION.txt
V4_SECURITY_UPDATES_FILES_CHANGED.txt
version-info.txt
```

**Recommendation**: Move to `docs/reports/` or delete if obsolete.

## 7. SQL Files in Root Directory

```
init-db.sql
init-pgvector.sql
pgvector-performance-test.sql
setup-document-embeddings.sql
vector-schema.sql
```

**Recommendation**: Move to `database/` or `prisma/migrations/` directory.

## 8. Old Database Backup

```
./db_backup_20251103_095041/
./.backup/
```

**Backup Date**: November 3, 2025 (2.5+ months old)

**Recommendation**: Delete after verifying current backups are working.

## 9. Temporary Run Scripts

```
./run_now.command
```

**Recommendation**: Delete if no longer needed.

## 10. Configuration File Sprawl

### Environment Files (5 files)
```
env.aks.example
env.development.example
env.production.example
env.staging.example
nas.env.example
```

**Recommendation**: Consolidate or move to `config/` directory.

### Docker Compose Files (13 files!)
```
docker-compose.ai-gateway.yml
docker-compose.code-server.yml
docker-compose.dev.yml
docker-compose.litellm.yml
docker-compose.multiarch.yml
docker-compose.nas.yml
docker-compose.pgvector.yml
docker-compose.prod.yml
docker-compose.production.enhanced.yml
docker-compose.production.yml
docker-compose.repo.yml
docker-compose.test.yml
docker-compose.yml
```

**Recommendation**: Review and consolidate. Consider using override pattern with base file.

## 11. Commented-Out Code Analysis

### Critical Files with Extensive Commented Code

#### **src/lib/experiments/alerts.ts** (Lines 451-509)
- **Issue**: Complete Datadog API integration commented out
- **Impact**: Monitor creation/deletion not functional
- **Recommendation**: Implement or remove file

#### **src/app/ai-code-review-demo/page.tsx** (Lines 261-268)
- **Issue**: AICodeReview component disabled
- **Reason**: LangChain compatibility issues
- **Recommendation**: Fix compatibility or remove demo page

#### **src/components/ai/AICodeReview.tsx** (Lines 47-77)
- **Issue**: Entire AI workflow execution commented out
- **Impact**: Feature uses mock results only
- **Recommendation**: Fix LangChain integration or remove component

#### **src/components/ai/AIChatInterface.tsx** (Multiple blocks)
- **Issue**: Advanced prompt engineering features disabled
- **Impact**: Reduced functionality
- **Recommendation**: Re-enable or remove UI elements

#### **src/lib/cloud/provider-factory.ts** (Lines 8-9, 70-71, 77-78)
- **Issue**: GCP and Azure providers commented out
- **Impact**: Only AWS works
- **Recommendation**: Complete implementations or document AWS-only support

#### **src/app/wiki/[slug]/page.tsx** (Lines 8-18, 50, 57)
- **Issue**: Static generation and HTML rendering disabled
- **Reason**: Security scan findings
- **Recommendation**: Implement safe rendering or document limitation

#### **src/lib/auth.ts** (Lines 11-12, 48)
- **Issue**: Database adapter disabled
- **Reason**: "File-based development mode"
- **Recommendation**: Document or implement proper database auth

### Disabled API Routes (Entire Directories)
```
src/app/api/ai/sequential-thinking.disabled/
src/app/api/ai/upload.disabled/
src/app/api/ai/web-search.disabled/
```

**Recommendation**: Either complete implementation and enable, or delete directories.

### Widespread Pattern: Logger Imports
**150+ files** have commented-out logger imports:
```typescript
// import { logger } from '@/lib/logger';
```

**Recommendation**: Either remove these comments or re-enable logging systematically.

## 12. License Compliance Verification

### License Files Present
- `./LICENSE` - Main MIT license
- `./LICENSES/` directory with multiple licenses

### Verification Status
✅ No license compliance issues identified with proposed deletions
✅ All files proposed for removal are:
  - Temporary/backup files (no license implications)
  - Test/debug scripts (internal tooling)
  - Documentation artifacts (internal use)
  - Screenshots (internal documentation)

**Note**: Stale branches should be verified for unique contributions before deletion.

## Cleanup Action Plan

### Phase 1: Safe Deletions (Low Risk)
1. ✅ Delete empty directories (3 items)
2. ✅ Delete backup and conflict files (20+ items)
3. ✅ Delete old database backup directory
4. ✅ Delete temporary run script
5. ✅ Delete merged git branches (2 items)

### Phase 2: File Organization (Medium Risk)
1. 📁 Move test/debug scripts to `tests/manual/` or delete
2. 📁 Move images to `docs/images/`
3. 📁 Move text reports to `docs/reports/`
4. 📁 Move SQL files to `database/`
5. 📁 Move env examples to `config/`

### Phase 3: Code Cleanup (Higher Risk)
1. 🔍 Review and remove/fix commented code in critical files
2. 🔍 Decide on disabled API routes (complete or delete)
3. 🔍 Remove systematic logger comment pattern
4. 🔍 Consolidate docker-compose files

### Phase 4: Branch Cleanup (Verification Required)
1. ⚠️ Verify stale branches have no unique work
2. ⚠️ Archive or delete old feature branches
3. ⚠️ Delete remote merged branches

## Estimated Impact

- **Disk Space Savings**: ~10-15 MB
- **File Count Reduction**: ~100+ files removed/relocated
- **Code Clarity**: Significant improvement by removing commented code
- **Root Directory**: From 231 files to ~50-70 files
- **Maintenance**: Easier navigation and reduced confusion

## Risk Assessment

| Risk Level | Items | Mitigation |
|------------|-------|------------|
| **Low** | Backup files, empty dirs | Direct deletion safe |
| **Medium** | File reorganization | Can revert via git |
| **High** | Commented code removal | Requires testing |
| **Critical** | Branch deletion | Verify first, can recover from remote |

## Next Steps

1. ✅ Get approval for cleanup plan
2. Create feature branch for cleanup work
3. Execute Phase 1 (safe deletions)
4. Execute Phase 2 (file organization)
5. Create PR with detailed change documentation
6. After merge, execute Phase 3 & 4 in separate PRs

---

**Report Generated**: 2026-01-19 23:32 PST
**Task**: st-8qm - Clean up unused files, branches, and folders
**Status**: Audit Complete, Ready for Execution
