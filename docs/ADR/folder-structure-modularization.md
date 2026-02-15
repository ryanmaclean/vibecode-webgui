# ADR-004: Modular Folder Structure for Multi-Service Architecture

**Date:** 2026-02-14
**Status:** Accepted
**Supersedes:** N/A
**Amended by:** N/A

---

## Context

### Current State Problems

VibeCode's codebase had grown to **48+ top-level directories** with significant organizational issues:

1. **Infrastructure Sprawl:** Six overlapping directories for infrastructure concerns (`infrastructure/`, `infra/`, `deploy/`, `docker/`, `azure/`, `monitoring/`) creating decision paralysis and duplication risk.

2. **Service Fragmentation:** Backend services scattered across multiple locations (`server/`, `daemon/`, `infrastructure/services/`) with no clear boundaries, enabling circular dependencies.

3. **Platform Code Scattered:** Platform-specific code spread across 4+ directories (`platforms/`, `swift/`, `fast-openvscode-vm/`, `fast-openvscode-vm-arm64/`, `mbp_m1/`).

4. **Configuration Sprawl:** 17+ configuration directories (including hidden directories like `.agents/`, `.auto-claude/`, `.claude/`, `.vscode/`) with no centralized config strategy.

5. **Circular Dependencies:** Analysis revealed 7 critical circular dependency chains:
   - Frontend (`src/`) ↔ Backend API (`src/app/api/`)
   - Services (`server/`) ↔ Infrastructure (`infrastructure/`)
   - Platform code bidirectional coupling with services

6. **Developer Impact:**
   - Average **10 minutes** to locate code for modifications
   - **Decision paralysis** when adding new features ("Where does this go?")
   - Estimated **50-60 hours/week lost** across a 5-person team due to structural confusion
   - High onboarding friction for new developers

### Requirements

The new structure needed to:

- **Reduce cognitive overhead** by minimizing top-level directories
- **Enforce module boundaries** to prevent circular dependencies
- **Enable independent service deployment** for microservices architecture
- **Clarify platform separation** for web, desktop, mobile, and CLI
- **Centralize infrastructure** as code and deployment configurations
- **Support monorepo tooling** (Turborepo, Nx, or similar)
- **Maintain backward compatibility** during gradual migration

---

## Decision

**Adopt a 7-folder modular structure** organized by functional domain:

```
vibecode/
├── services/              # Backend services (independently deployable)
├── platforms/             # Platform-specific implementations
├── shared/                # Shared libraries and utilities
├── infrastructure/        # Infrastructure as Code and deployment
├── docs/                  # Comprehensive documentation
├── tools/                 # Developer tooling and scripts
└── config/                # Centralized configuration
```

### Key Changes

1. **Consolidate 48 directories → 7 functional groups** (86% reduction)
2. **Unify infrastructure** from 6 directories → 1 (`infrastructure/`)
3. **Isolate platform code** in `platforms/` with adapter pattern
4. **Enforce service boundaries** using `services/` with API gateway pattern
5. **Centralize configuration** from 17+ locations → 1 (`config/`)
6. **Establish shared libraries** in `shared/` with clear dependency hierarchy

---

## Rationale

### 1. Services-First Architecture

**Decision:** Organize backend code by service (`api-gateway/`, `ai-gateway/`, `auth-service/`, etc.)

**Rationale:**
- Each service is independently deployable
- Clear ownership and responsibility boundaries
- Enables microservices scaling strategy
- Prevents circular dependencies through API contracts
- Supports polyglot services (different languages/frameworks)

**Example Structure:**
```
services/
├── api-gateway/
│   ├── src/
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
├── ai-gateway/
│   ├── src/
│   ├── tests/
│   └── requirements.txt
└── auth-service/
    ├── src/
    ├── tests/
    └── Dockerfile
```

### 2. Platform Isolation

**Decision:** Separate platform-specific code (`web/`, `desktop/`, `mobile/`, `macos/`, `cli/`)

**Rationale:**
- Different platforms have different build processes
- Enables platform teams to work independently
- Prevents platform-specific dependencies from leaking into services
- Supports adapter pattern for cross-platform code sharing

**Adapter Pattern:**
```typescript
// shared/contracts/storage-adapter.ts
interface StorageAdapter {
  read(key: string): Promise<string>
  write(key: string, value: string): Promise<void>
}

// platforms/web/adapters/storage.ts
export class WebStorageAdapter implements StorageAdapter {
  read(key: string) { return localStorage.getItem(key) }
  write(key: string, value: string) { localStorage.setItem(key, value) }
}

// platforms/desktop/adapters/storage.ts (Tauri)
export class DesktopStorageAdapter implements StorageAdapter {
  read(key: string) { return invoke('read_file', { key }) }
  write(key: string, value: string) { return invoke('write_file', { key, value }) }
}
```

### 3. Shared Library Hierarchy

**Decision:** Organize shared code by dependency level (types → utils → contracts → components)

**Rationale:**
- Prevents circular dependencies in shared code
- Clear dependency flow from low-level to high-level
- Types have zero dependencies
- Utils depend only on types
- Contracts depend on types and utils
- Components depend on all lower levels

**Dependency Flow:**
```
components/  (Level 4: depends on contracts, utils, types)
    ↓
contracts/   (Level 3: depends on utils, types)
    ↓
utils/       (Level 2: depends on types)
    ↓
types/       (Level 1: zero dependencies)
```

### 4. Infrastructure Consolidation

**Decision:** Merge 6 infrastructure directories into 1 organized by tool/platform

**Rationale:**
- Single source of truth for infrastructure
- Grouped by infrastructure domain (terraform, docker, kubernetes, azure, monitoring)
- Easier to locate infrastructure code
- Consistent deployment configurations
- Reduced duplication

**Before:**
```
infrastructure/    # Some Terraform?
infra/            # More Terraform?
deploy/           # Deployment scripts?
docker/           # Docker files?
azure/            # Azure configs?
monitoring/       # Observability?
```

**After:**
```
infrastructure/
├── terraform/
├── docker/
├── kubernetes/
├── azure/
├── monitoring/
└── ci-cd/
```

### 5. Centralized Configuration

**Decision:** Consolidate configuration in `config/` organized by environment and service

**Rationale:**
- Eliminates configuration sprawl across 17+ locations
- Environment-specific configs clearly separated (dev/staging/prod/test)
- Service-specific configs co-located but not embedded in service code
- Platform configs separated from application configs
- Easier to audit and secure sensitive configurations

**Structure:**
```
config/
├── base/                 # Base configuration shared across environments
├── environments/
│   ├── development/
│   ├── staging/
│   ├── production/
│   └── test/
├── services/            # Service-specific configs
└── platforms/           # Platform-specific configs
```

### 6. Documentation Centralization

**Decision:** Consolidate documentation in `docs/` with subdirectories by type

**Rationale:**
- Single location for all documentation
- Architecture Decision Records (ADRs) centralized
- Service and platform documentation co-located
- Historical documentation archived but accessible
- Easier documentation discovery and maintenance

---

## Consequences

### Positive

1. **86% Reduction in Top-Level Directories** (48 → 7)
   - Dramatically reduced cognitive overhead
   - Faster code location (10 min → 2 min average)
   - Clearer decision-making for new code placement

2. **Eliminated Circular Dependencies**
   - Enforced unidirectional dependency flow
   - Services communicate only through API contracts
   - Platforms use adapters to access services
   - Shared libraries have strict hierarchy

3. **Independent Service Deployment**
   - Each service has its own Dockerfile and dependencies
   - Services can be deployed independently
   - Enables microservices scaling strategy
   - Supports polyglot services

4. **Improved Developer Experience**
   - Clear guidelines: "Where do I add X?" decisively answered
   - Reduced onboarding time for new developers
   - Consistent patterns across services
   - Estimated **80% reduction** in time spent navigating codebase

5. **Infrastructure as Code Clarity**
   - Single `infrastructure/` directory for all IaC
   - Clear separation by tool (Terraform, Docker, K8s)
   - Consistent deployment patterns
   - Easier to audit and maintain

6. **Platform Team Autonomy**
   - Web, desktop, mobile, and CLI teams can work independently
   - Platform-specific code isolated
   - Shared code accessed through well-defined interfaces
   - Different tech stacks per platform supported

7. **Monorepo Compatibility**
   - Structure supports Turborepo/Nx task orchestration
   - Clear package boundaries for dependency management
   - Efficient incremental builds
   - Shared tooling configuration

### Negative

1. **Migration Effort Required**
   - Moving 48 directories to new structure requires significant effort
   - Risk of breaking imports during migration
   - Requires updating documentation and scripts
   - **Mitigation:** Phased migration approach with git symlinks during transition

2. **Learning Curve for Existing Team**
   - Developers must learn new structure
   - Requires updating mental models of codebase
   - Temporary slowdown during adjustment period
   - **Mitigation:** Comprehensive documentation (FOLDER_STRUCTURE.md, MODULE_BOUNDARIES.md) and team training sessions

3. **Stricter Boundaries May Feel Restrictive**
   - Some cross-service patterns may become more verbose
   - Shared code requires more deliberate extraction
   - Platform-specific optimizations harder to implement
   - **Mitigation:** Adapter pattern and well-defined interface contracts reduce friction

4. **Increased Repository Size (Short-Term)**
   - During migration, some code may be duplicated temporarily
   - Git history may become harder to trace
   - **Mitigation:** Use `git mv` to preserve history, clean up duplicates after migration

5. **Potential Performance Overhead**
   - API gateway pattern adds network hop
   - Service-to-service calls may be slower than in-process
   - **Mitigation:** Caching layer, Redis for cross-service data, gRPC for high-performance inter-service communication

### Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking changes during migration | High | Medium | Phased migration with git symlinks, comprehensive testing |
| Team resistance to change | Medium | Medium | Documentation, training sessions, clear benefits communication |
| Circular dependencies reintroduced | High | Low | ESLint rules, dependency-cruiser, pre-commit hooks, CI/CD checks |
| Service communication overhead | Medium | Medium | Caching layer, gRPC for performance-critical paths, API gateway optimization |
| Configuration sprawl returns | Low | Low | Linting rules, code review guidelines, centralized config documentation |

---

## Implementation Details

### Phase 1: Prevent Further Sprawl (Week 1)

**Goal:** Stop making the problem worse

**Actions:**
1. Create placeholder directories for new structure
2. Add ESLint rules to prevent imports from old locations in new code
3. Update documentation with new structure guidelines
4. Configure dependency-cruiser to enforce module boundaries

**Deliverables:**
- `services/`, `platforms/`, `shared/`, `infrastructure/`, `docs/`, `tools/`, `config/` directories created
- `.eslintrc.js` updated with import restrictions
- `dependency-cruiser.config.js` configured
- Updated `CONTRIBUTING.md` with new structure guidelines

### Phase 2: Migrate Shared Libraries (Week 2-3)

**Goal:** Move foundational code to establish patterns

**Priority Order:**
1. `shared/types/` ← `types/`
2. `shared/utils/` ← scattered utilities
3. `shared/contracts/` ← API contracts
4. `shared/components/` ← shared UI components

**Migration Strategy:**
```bash
# Use git mv to preserve history
git mv types/ shared/types/

# Create symlink for backward compatibility
ln -s shared/types/ types/

# Update imports gradually
find . -name "*.ts" -exec sed -i '' 's|from "types/|from "shared/types/|g' {} \;

# Remove symlink after all imports updated
rm types/
```

**Validation:**
- All tests pass after each migration
- No broken imports reported by TypeScript
- Build succeeds

### Phase 3: Extract Services (Week 4-6)

**Goal:** Isolate backend services with clear boundaries

**Service Extraction Order (by dependency):**
1. `auth-service` (no dependencies)
2. `git-service` (depends on auth-service)
3. `ai-gateway` (depends on auth-service)
4. `chat-service` (depends on auth-service, ai-gateway)
5. `webhook-service` (depends on auth-service)
6. `background-worker` (depends on multiple services)
7. `workflow-orchestrator` (depends on multiple services)
8. `api-gateway` (depends on all services)

**Service Template:**
```
services/<service-name>/
├── src/
│   ├── routes/           # API routes
│   ├── handlers/         # Request handlers
│   ├── services/         # Business logic
│   ├── models/           # Data models
│   └── index.ts          # Entry point
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

**API Gateway Pattern:**
```typescript
// services/api-gateway/src/routes/ai.ts
import { proxyRequest } from '../utils/proxy'

export async function handleAIRequest(req: Request) {
  // API Gateway forwards to AI Gateway service
  return proxyRequest(req, 'http://ai-gateway:3001')
}
```

### Phase 4: Isolate Platforms (Week 7-8)

**Goal:** Separate platform-specific code

**Platform Migration:**
1. `platforms/web/` ← `src/` (Next.js app)
2. `platforms/desktop/tauri/` ← Tauri wrapper code
3. `platforms/mobile/ios/` ← `swift/`
4. `platforms/macos/` ← macOS menubar app
5. `platforms/cli/` ← CLI tooling

**Adapter Implementation:**
```typescript
// shared/contracts/platform-adapters.ts
export interface StorageAdapter {
  read(key: string): Promise<string | null>
  write(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

export interface FilesystemAdapter {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
}

// platforms/web/adapters/storage.ts
export const webStorageAdapter: StorageAdapter = {
  async read(key) { return localStorage.getItem(key) },
  async write(key, value) { localStorage.setItem(key, value) },
  async delete(key) { localStorage.removeItem(key) }
}

// platforms/desktop/adapters/storage.ts
import { invoke } from '@tauri-apps/api'

export const desktopStorageAdapter: StorageAdapter = {
  async read(key) { return invoke('read_storage', { key }) },
  async write(key, value) { return invoke('write_storage', { key, value }) },
  async delete(key) { return invoke('delete_storage', { key }) }
}
```

### Phase 5: Consolidate Infrastructure (Week 9)

**Goal:** Merge 6 infrastructure directories into 1

**Migration Mapping:**
```
infrastructure/       → infrastructure/terraform/
infra/               → infrastructure/terraform/
deploy/              → infrastructure/scripts/
docker/              → infrastructure/docker/
azure/               → infrastructure/azure/
monitoring/          → infrastructure/monitoring/
```

**Structure:**
```
infrastructure/
├── terraform/
│   ├── modules/
│   ├── environments/
│   └── main.tf
├── docker/
│   ├── compose/
│   └── images/
├── kubernetes/
│   ├── helm/
│   └── manifests/
├── azure/
│   ├── bicep/
│   └── arm/
├── monitoring/
│   ├── prometheus/
│   ├── grafana/
│   └── datadog/
└── scripts/
    ├── deploy.sh
    └── rollback.sh
```

### Phase 6: Centralize Configuration (Week 10)

**Goal:** Consolidate configuration from 17+ locations

**Configuration Strategy:**
```
config/
├── base/
│   ├── app.config.ts
│   └── db.config.ts
├── environments/
│   ├── development.ts
│   ├── staging.ts
│   ├── production.ts
│   └── test.ts
├── services/
│   ├── ai-gateway.config.ts
│   ├── auth-service.config.ts
│   └── api-gateway.config.ts
└── platforms/
    ├── web.config.ts
    ├── desktop.config.ts
    └── mobile.config.ts
```

**Environment-Aware Config Loader:**
```typescript
// shared/utils/config.ts
import { merge } from 'lodash'

export function loadConfig() {
  const env = process.env.NODE_ENV || 'development'
  const baseConfig = require(`@/config/base/app.config`)
  const envConfig = require(`@/config/environments/${env}`)

  return merge({}, baseConfig, envConfig)
}
```

### Phase 7: Cleanup & Documentation (Week 11-12)

**Goal:** Remove old directories, update documentation

**Cleanup Actions:**
1. Remove git symlinks
2. Delete old directories
3. Update all documentation
4. Update CI/CD pipelines
5. Update onboarding guides

**Documentation Updates:**
- ✅ `docs/FOLDER_STRUCTURE.md` - Created
- ✅ `docs/MODULE_BOUNDARIES.md` - Created
- ✅ `docs/ADR/folder-structure-modularization.md` - This document
- ⏳ Update `docs/ARCHITECTURE.md` with folder structure section
- ⏳ Update `CONTRIBUTING.md` with new guidelines
- ⏳ Create migration guide for team

---

## Enforcement Mechanisms

### 1. ESLint Rules

**Prevent imports from outside module boundaries:**

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['../../services/*'],
          message: 'Services should not import from other services directly. Use API contracts in shared/contracts/'
        },
        {
          group: ['../../platforms/*'],
          message: 'Platforms should not import from other platforms. Use shared libraries or adapters.'
        },
        {
          group: ['../../../*'],
          message: 'Do not traverse more than 2 levels up. Use absolute imports with path aliases.'
        }
      ]
    }]
  }
}
```

### 2. Dependency Cruiser

**Enforce module boundaries with dependency-cruiser:**

```javascript
// dependency-cruiser.config.js
module.exports = {
  forbidden: [
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'services-no-cross-service-imports',
      severity: 'error',
      from: { path: '^services/[^/]+' },
      to: { path: '^services/(?!\\1)[^/]+', pathNot: '^shared/' }
    },
    {
      name: 'platforms-no-cross-platform-imports',
      severity: 'error',
      from: { path: '^platforms/[^/]+' },
      to: { path: '^platforms/(?!\\1)[^/]+', pathNot: '^shared/' }
    },
    {
      name: 'shared-library-hierarchy',
      severity: 'error',
      from: { path: '^shared/types/' },
      to: { path: '^shared/(utils|contracts|components)/' }
    }
  ]
}
```

### 3. TypeScript Project References

**Enable incremental builds and enforce dependencies:**

```json
// tsconfig.json (root)
{
  "references": [
    { "path": "./shared/types" },
    { "path": "./shared/utils" },
    { "path": "./shared/contracts" },
    { "path": "./shared/components" },
    { "path": "./services/auth-service" },
    { "path": "./services/ai-gateway" },
    { "path": "./platforms/web" }
  ]
}

// services/ai-gateway/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "references": [
    { "path": "../../shared/types" },
    { "path": "../../shared/utils" },
    { "path": "../../shared/contracts" }
  ],
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist"
  }
}
```

### 4. Pre-Commit Hooks

**Validate module boundaries before commit:**

```yaml
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run dependency-cruiser
npm run validate:dependencies

# Run ESLint
npm run lint

# Check TypeScript project references
npm run typecheck
```

### 5. CI/CD Pipeline Checks

**GitHub Actions validation:**

```yaml
# .github/workflows/validate-structure.yml
name: Validate Module Boundaries

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: npm ci

      - name: Validate dependencies
        run: npm run validate:dependencies

      - name: Check circular dependencies
        run: npx madge --circular --extensions ts,tsx ./

      - name: TypeScript project references
        run: npm run typecheck:all

      - name: ESLint
        run: npm run lint
```

---

## Alternatives Considered

### Alternative 1: Keep Current 48-Directory Structure

**Pros:**
- No migration effort
- No learning curve

**Cons:**
- Confusion continues to worsen as codebase grows
- Developer productivity continues to decline
- Circular dependencies remain unaddressed
- New developers struggle with onboarding

**Verdict:** Rejected - Technical debt will compound over time

### Alternative 2: Monolithic src/ Directory

**Structure:**
```
src/
├── frontend/
├── backend/
└── shared/
```

**Pros:**
- Simple top-level structure
- Easy to understand at a glance

**Cons:**
- Does not support independent service deployment
- All services coupled in single directory
- Platform-specific code still mixed
- Does not solve infrastructure sprawl

**Verdict:** Rejected - Insufficient for microservices architecture

### Alternative 3: Fully Separate Repositories (Multi-Repo)

**Structure:**
- `vibecode-web` (separate repo)
- `vibecode-api-gateway` (separate repo)
- `vibecode-ai-gateway` (separate repo)
- etc.

**Pros:**
- Complete service isolation
- Independent versioning
- No cross-service imports possible

**Cons:**
- Shared code management becomes complex (npm packages)
- Cross-service changes require multiple PRs
- Harder to onboard new developers
- Increased CI/CD complexity
- Difficult to maintain consistency

**Verdict:** Rejected - Monorepo provides better developer experience while maintaining service boundaries

### Alternative 4: Domain-Driven Design (DDD) Folder Structure

**Structure:**
```
src/
├── domains/
│   ├── authentication/
│   ├── collaboration/
│   └── ai-assistance/
├── shared-kernel/
└── infrastructure/
```

**Pros:**
- Aligns with business domains
- Encourages domain-driven design
- Clear bounded contexts

**Cons:**
- Harder to map to deployment units (services)
- Platform code placement unclear
- Does not address infrastructure sprawl
- Team may not be familiar with DDD patterns

**Verdict:** Rejected - Service-oriented structure better matches deployment model

---

## Success Metrics

### Quantitative Metrics

| Metric | Baseline (Current) | Target (Post-Migration) | Measurement Method |
|--------|-------------------|-------------------------|-------------------|
| Time to locate code | 10 min average | 2 min average | Developer surveys |
| Circular dependencies | 7 chains | 0 | dependency-cruiser report |
| Top-level directories | 48 | 7 | Directory count |
| Build time | - | No regression | CI/CD metrics |
| Test suite time | - | No regression | CI/CD metrics |
| Onboarding time | - | 30% reduction | New hire surveys |

### Qualitative Metrics

- **Developer Satisfaction:** Survey team on folder structure clarity
- **Code Review Speed:** Measure PR review time before/after migration
- **Decision Confidence:** Survey team on confidence when adding new code
- **Documentation Clarity:** New hire feedback on folder structure docs

### Leading Indicators (Early Success Signals)

- All new code added to correct location without confusion
- Zero new circular dependencies introduced
- Build times remain stable or improve
- CI/CD pipeline passes consistently
- Positive team feedback on clarity

---

## Related Documentation

- **Main Documentation:** [docs/FOLDER_STRUCTURE.md](../FOLDER_STRUCTURE.md) - Comprehensive folder structure guide
- **Module Boundaries:** [docs/MODULE_BOUNDARIES.md](../MODULE_BOUNDARIES.md) - Interface contracts and dependency rules
- **Analysis:**
  - [docs/analysis/current-structure-audit.md](../analysis/current-structure-audit.md) - Current state audit
  - [docs/analysis/pain-points.md](../analysis/pain-points.md) - Identified pain points
  - [docs/analysis/dependency-map.md](../analysis/dependency-map.md) - Dependency mapping
- **Design:**
  - [docs/design/organization-principles.md](../design/organization-principles.md) - Core principles
  - [docs/design/proposed-structure.md](../design/proposed-structure.md) - Detailed proposed structure
- **Architecture:** [docs/ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture overview

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-14 | Auto-Claude | Initial ADR creation |

---

## Approval

This ADR is approved and ready for implementation.

**Next Steps:**
1. Update `docs/ARCHITECTURE.md` with folder structure section
2. Begin Phase 1 implementation (Prevent Further Sprawl)
3. Schedule team training session on new structure
4. Set up enforcement mechanisms (ESLint, dependency-cruiser, pre-commit hooks)
5. Create detailed migration guide for each service

---

**For questions or feedback on this ADR, please open a GitHub issue with the label `adr:folder-structure`.**
