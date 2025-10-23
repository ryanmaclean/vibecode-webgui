# Agent Operations Handbook

This document consolidates the quick-reference virtualization workflow notes and the coding guardrails for the VibeCode Web GUI.

---

## Fast OpenVSCode MicroVM Workflow

1. **Stable release available**
   - Fetch the packaged image from GitHub release `fast-openvscode-vm-v0.1.0`.
   - Rebuild locally with `scripts/release/package-fast-openvscode-vm.sh`; the script generates `<timestamp>.tar.gz` + `.sha256` in `dist/`.

2. **Nightly/insiders build**
   - `fast-openvscode-vm-insiders/` mirrors the stable tree and is ready for the latest `openvscode-server-insiders` tarball.
   - Issue #554 tracks replacing the contents and releasing a prerelease (e.g., `fast-openvscode-vm-v0.2.0-pre`).

3. **Keep large assets out of git**
   - `.gitignore` excludes both VM directories. Package with the script and upload artifacts to releases; do not commit binaries.

4. **Documentation links**
   - `demos/README.md` explains where to download releases and how to rebuild/upload.
   - `archive/agents/2025-10-02-firecracker-bench-hand-off.md` summarizes completed work and outstanding tasks.

5. **Open issues to monitor**
   - #555 Automate the VM release pipeline in CI.
   - #556 Document the stable + insiders workflow.
   - #557 Define nightly VM verification checklist.
   - #554 Prep insiders prerelease (nightly build).
   - #552 / #553 cover HTTP handshake fixes and automated benchmarking.

6. **Benchmark tooling**
   - `scripts/benchmarks/boot_latency_bench.py` and `firecracker_bench.py` emit DogStatsD metrics via `--dogstatsd`.
   - `scripts/benchmarks/emit_to_datadog.py` forwards JSON outputs (with dry-run support). Dashboards/monitors are tracked in #550 and noisy-neighbor tests in #551.

7. **Nightly build checklist (once defined)**
   - Swap in new insiders bits under `fast-openvscode-vm-insiders/`.
   - Run `scripts/release/package-fast-openvscode-vm.sh`.
   - Execute the verification checklist (issue #557 once complete).
   - Publish release artifacts and update docs with download link + SHA256.

Keep this section current so new agents can execute the workflow with minimal ramp-up.

---

## VibeCode Web GUI Coding Standards

These guidelines apply when contributing to the Next.js/TypeScript application.

### 🚨 CRITICAL: Logger Circular Dependency Prevention

**NEVER import the logger module directly in application code!**

The logger module (`src/lib/logger.ts`) uses top-level `await` which creates circular dependencies that break the build. This issue affected **335 files** and caused builds to fail for extended periods.

#### ✅ CORRECT APPROACH
```typescript
// ✅ Use console directly for logging
console.log('Info message')
console.error('Error message')
console.warn('Warning message')
```

#### ❌ FORBIDDEN APPROACH
```typescript
// ❌ NEVER do this - causes circular dependencies
import { logger } from '@/lib/logger'
logger.info('message')
```

#### 🔧 EMERGENCY FIX SCRIPT
If logger imports are accidentally added, run:
```bash
./scripts/fix-logger-circular-dependency.sh
```

This script automatically fixes all logger imports across the codebase.

#### 📋 PREVENTION CHECKLIST
- [ ] Never import `logger` from `@/lib/logger`
- [ ] Never import `appLogger` from `@/lib/server-monitoring`
- [ ] Never import `createChildLogger` from any logger module
- [ ] Use `console.log`, `console.error`, `console.warn` instead
- [ ] Test build with `npm run build` after any changes
- [ ] If build fails with logger errors, run the fix script immediately

### Build, Lint, and Test

- **Lint:** `npm run lint`
- **Type Check:** `npm run type-check`
- **Test:** `npm run test`
- **Run a single test file:** `npx jest <path/to/test/file>`
- **Run E2E tests:** `npm run test:e2e`

### Code Style

- **Framework:** Next.js with React. Prefer functional components and hooks.
- **Language:** TypeScript. Use strict types and interfaces.
- **Styling:** Tailwind CSS with utility classes.
- **Imports:** Order as (1) React, (2) external libraries, (3) internal modules.
- **Formatting:** Follow the existing lint/format rules; ESLint is configured.
- **Naming:** camelCase for variables/functions, PascalCase for components/types.
- **Error Handling:** Use `try/catch` for async flows and surface actionable errors.
- **Components:** Keep components focused on a single responsibility.
- **State Management:** Favor React hooks (`useState`, `useContext`, etc.) for local state.
- **API Routes:** Place server logic in `src/app/api/`.
- **Dependencies:** Add new packages via npm and document rationale when introducing them.

Document any deviations or new conventions here so the next agent inherits a consistent environment.

### MCP Sequential Thinking (Local Dev)
- Install once: `cd docker/mcp-servers && npm install --legacy-peer-deps`.
- Start the server: `npm run start:sequential-thinking` (or `npm run dev:sequential-thinking` for auto-reload).
- The API expects the service at `http://localhost:3004/v1/tools/think_sequentially`; keep that port consistent.
- Verify before hitting the Next.js route: `curl -s http://localhost:3004/v1/tools/think_sequentially -H 'Content-Type: application/json' -d '{"prompt":"sanity check","num_steps":2}'`.
- Multi-agent assignments for current cycle live in `archive/agents/2025-10-22-mcp-roundtable-plan.md` (Codex personas 1-10).

### Roundtable CLI Helper
- Run availability check: `./scripts/roundtable/run-roundtable.sh`.
- Override subagents: `./scripts/roundtable/run-roundtable.sh --agents codex`.
- Results stored at `~/.roundtable/availability_check.json`; share in daily status if agents change.

### Emergency Build Fix Scripts
- **Logger Circular Dependency Fix**: `./scripts/fix-logger-circular-dependency.sh`
  - Automatically fixes all logger imports across 335+ files
  - Run immediately if build fails with logger circular dependency errors
  - Prevents extended build failures
