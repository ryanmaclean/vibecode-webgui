---
title: Current Structure Pain Points & Redundancies
date: 2026-02-14
status: Initial Analysis
priority: High
---

# Current Structure Pain Points & Redundancies

This document identifies specific pain points, redundancies, and issues in the current folder structure that create confusion, duplication, and maintenance challenges. These issues must be addressed in the proposed modular architecture.

## Critical Redundancies

### 1. Infrastructure Directory Proliferation

**Problem:** Multiple overlapping directories for infrastructure concerns

**Affected Directories:**
- `infrastructure/` - Infrastructure as Code (IaC)
- `infra/` - Additional infrastructure configurations
- `deploy/` - Deployment configurations and scripts
- `docker/` - Docker configurations
- `azure/` - Azure-specific configurations
- `monitoring/` - Observability configurations

**Pain Points:**
- **Decision Paralysis**: When adding new infrastructure code, unclear which directory to use
- **Duplication Risk**: Similar configurations may exist in multiple locations
- **Cognitive Overhead**: Developers must check 6 different locations for infrastructure concerns
- **Maintenance Burden**: Changes to infrastructure may need updates across multiple directories
- **No Single Source of Truth**: Infrastructure state is fragmented

**Concrete Examples:**
- Should Docker Compose files go in `docker/` or `deploy/`?
- Should Terraform configs go in `infrastructure/` or `infra/`?
- Should Prometheus configs go in `monitoring/` or `infrastructure/monitoring/`?

**Impact:** High - Infrastructure changes are common and this confusion slows deployment velocity

---

### 2. Configuration Sprawl

**Problem:** Configuration files scattered across multiple locations

**Affected Directories:**
- `config/` - Application configuration files
- `settings/` - Additional settings and preferences
- 15+ hidden configuration directories (`.agents/`, `.auto-claude/`, `.claude/`, `.vscode/`, etc.)

**Pain Points:**
- **No Centralized Configuration**: Application config spread across `config/` and `settings/`
- **Unclear Naming**: Similar concepts but different directory names
- **Environment-Specific Confusion**: No clear pattern for dev/staging/prod configs
- **Tool-Specific Proliferation**: Each tool creates its own config directory
- **Search Inefficiency**: Finding a specific configuration requires knowing which directory to check

**Concrete Examples:**
- User preferences: Are they in `config/` or `settings/`?
- Feature flags: Should they go in `config/` or with application code?
- Service-specific configs: No clear convention for placement

**Impact:** Medium-High - Frequent source of confusion for developers and during debugging

---

### 3. Vendor & Third-Party Ambiguity

**Problem:** Duplicate directories for external dependencies

**Affected Directories:**
- `vendor/` - Third-party vendor code
- `third_party/` - Third-party integrations

**Pain Points:**
- **Semantic Overlap**: No clear distinction between "vendor" and "third_party"
- **Inconsistent Usage**: Developers must guess which to use
- **Dependency Confusion**: External code may exist in both locations
- **No Clear Policy**: No documented decision criteria

**Concrete Examples:**
- Modified third-party library: `vendor/` or `third_party/`?
- External service SDK: Which directory?
- Vendored dependencies vs. integrations: Same or different?

**Impact:** Low-Medium - Infrequent additions but creates long-term organizational debt

---

### 4. Platform-Specific Fragmentation

**Problem:** Platform-specific code scattered across multiple directories

**Affected Directories:**
- `platforms/` - Platform-specific implementations
- `swift/` - Swift/iOS code
- `fast-openvscode-vm/` - OpenVSCode VM (x86_64)
- `fast-openvscode-vm-arm64/` - OpenVSCode VM (ARM64)
- `mbp_m1/` - MacBook Pro M1 specific configurations
- `azure/` - Azure platform (also in infrastructure category)

**Pain Points:**
- **No Unified Platform Strategy**: Platform code lacks cohesive organization
- **Inconsistent Naming**: Some by language (swift/), some by architecture (arm64), some by hardware (mbp_m1)
- **Unclear Platform Abstraction**: No clear boundary between platform and application code
- **Desktop App Confusion**: Is Tauri code in `platforms/`, `src/`, or separate?
- **Cross-Platform Code Sharing**: Unclear how shared code is organized

**Concrete Examples:**
- macOS menubar app code: Is it in `swift/`, `platforms/macos/`, or `mbp_m1/`?
- Desktop wrapper (Tauri): Where does it belong?
- Shared mobile utilities: No clear location for iOS/Android shared code

**Impact:** High - Multi-platform support is a core feature, fragmentation slows development

---

### 5. Service Organization Chaos

**Problem:** Services scattered without clear boundaries or grouping

**Affected Directories:**
- `airflow/` - Apache Airflow workflows
- `daemon/` - Background daemon processes
- `deacon/` - Deacon service (unclear purpose)
- `gitea/` - Gitea integration
- `server/` - Server-side application code (also a service?)

**Pain Points:**
- **No Service Boundaries**: Services are top-level directories without clear relationships
- **Unclear Service Definitions**: What qualifies as a "service" vs. "application code"?
- **Inter-Service Dependencies**: No clear documentation of service dependencies
- **No Service Grouping**: Services scattered alphabetically rather than by domain
- **Naming Inconsistency**: `daemon/` vs `deacon/` - similar names, unclear purposes

**Concrete Examples:**
- Adding a new background worker: Does it go in `daemon/`, `server/`, or new directory?
- API endpoints: Are they in `server/` or should they be in a `api/` service?
- Workflow orchestration: Is `airflow/` a service or infrastructure?

**Impact:** High - Unclear service boundaries lead to monolithic coupling

---

### 6. Developer Tools Proliferation

**Problem:** Multiple overlapping directories for tools and utilities

**Affected Directories:**
- `scripts/` - Build and utility scripts
- `tools/` - Development tools
- `cmd/` - Command-line applications
- `plugins/` - Plugin system
- `extensions/` - Extensions and add-ons
- `skills/` - Skills or capabilities

**Pain Points:**
- **Semantic Overlap**: Unclear difference between scripts, tools, and cmd
- **Plugin vs Extension**: No clear distinction
- **Skills Ambiguity**: "Skills" could mean many things
- **Build Script Confusion**: Should build scripts be in `scripts/`, `tools/`, or with code?
- **CLI Tool Organization**: No pattern for organizing CLI utilities

**Concrete Examples:**
- New build helper: `scripts/build/` or `tools/build/`?
- VS Code extension: `extensions/vscode/` or `plugins/vscode/`?
- AI capabilities: Are they "skills" or application code?
- Developer CLI tool: `cmd/`, `tools/`, or `scripts/`?

**Impact:** Medium - Frequent source of minor confusion but low business impact

---

### 7. Testing Strategy Inconsistency

**Problem:** Tests distributed across multiple directories with unclear patterns

**Affected Directories:**
- `tests/` - Main test directory
- `dd-skill-test/` - Datadog skill testing
- `precommit/` - Pre-commit configurations
- `.test-results/` - Test execution results

**Pain Points:**
- **Mixed Testing Approaches**: Unit/integration/e2e tests not clearly separated
- **Service-Specific Test Confusion**: Should service tests be in `tests/` or with service code?
- **No Clear Colocation**: Tests may or may not be near tested code
- **Special Case Directories**: `dd-skill-test/` suggests others might create similar directories
- **Results Location**: Test results in hidden directory, unclear if gitignored

**Concrete Examples:**
- Where do unit tests for `server/` go?
- Should each service have its own test directory?
- Integration tests spanning services: Where do they belong?
- E2E tests for frontend: `tests/e2e/` or `src/__tests__/`?

**Impact:** Medium-High - Unclear testing patterns reduce test coverage and confidence

---

### 8. Archive & Version Management Confusion

**Problem:** Multiple approaches to archiving and version management

**Affected Directories:**
- `archive/` - Archived files and documentation
- `release-archive/` - Archived releases
- `release-v5.1.0-beta/` - Specific release version

**Pain Points:**
- **No Clear Archive Policy**: What gets archived and where?
- **Version-Specific Directories**: `release-v5.1.0-beta/` as top-level is unusual
- **Documentation Archive Overlap**: `archive/` vs `docs/archive/` - which for what?
- **Historical Code Access**: Unclear how to find old versions
- **Git vs Directory Versioning**: Confusion between git tags and directory-based versions

**Concrete Examples:**
- Deprecated feature code: `archive/` or remove and rely on git?
- Beta releases: Should they have top-level directories?
- Old documentation: `archive/` or `docs/archive/`?

**Impact:** Low - Infrequent operations but creates clutter

---

### 9. Domain-Specific Directory Mystery

**Problem:** Several directories with unclear purposes and undocumented rationale

**Affected Directories:**
- `mayor/` - Mayor subsystem (purpose unclear)
- `tundra-dome/` - Tundra Dome subsystem (purpose unclear)
- `td/` - TD subsystem (abbreviation, unclear)
- `deacon/` - Deacon service (purpose unclear)
- `mbp_m1/` - MacBook Pro M1 specific (why top-level?)
- `feature_audit/` - Feature auditing (should this be in docs?)

**Pain Points:**
- **Onboarding Difficulty**: New developers have no context for these directories
- **Documentation Absence**: No README files explaining purposes
- **Naming Ambiguity**: Names like "mayor" and "tundra-dome" are not self-documenting
- **Abbreviations**: `td/` could mean many things
- **Scope Uncertainty**: Are these services, tools, experiments, or something else?

**Concrete Examples:**
- What is the "mayor" subsystem and who uses it?
- Should code related to these domains be in these directories?
- Are these active or deprecated?
- Is `mbp_m1/` specific to one developer's machine?

**Impact:** High - Creates significant onboarding friction and uncertainty

---

## Dependency & Coupling Issues

### 10. Circular Dependency Risk

**Problem:** No enforced module boundaries enable circular dependencies

**Current State:**
- `src/` can import from `server/`
- `server/` can import from `src/`
- `packages/` can import from both
- Services can import from each other without restrictions

**Pain Points:**
- **Build Order Confusion**: Unclear what needs to build first
- **Testing Difficulty**: Circular deps make unit testing harder
- **Deployment Complexity**: Can't independently deploy coupled services
- **Refactoring Risk**: Changes ripple unpredictably across codebase
- **No Dependency Graph**: Cannot visualize or enforce dependency hierarchy

**Impact:** High - Fundamental architectural problem limiting scalability

---

### 11. Shared Code Organization

**Problem:** No clear strategy for code shared between services

**Current Issues:**
- Shared types: Sometimes in `types/`, sometimes duplicated
- Shared utilities: Sometimes in `packages/`, sometimes copied
- Shared components: Unclear if they belong in a service or `shared/`
- Shared configs: Spread across `config/`, service directories, and root

**Pain Points:**
- **Code Duplication**: Utilities copied rather than imported
- **Version Skew**: Duplicated code drifts out of sync
- **Import Complexity**: No clear pattern for importing shared code
- **Ownership Ambiguity**: Who maintains shared code?
- **Breaking Changes**: Shared code changes can break multiple services

**Impact:** High - Affects code quality and maintenance burden

---

## Navigation & Discoverability Issues

### 12. Flat Top-Level Structure

**Problem:** 48+ top-level directories create cognitive overload

**Pain Points:**
- **Visual Clutter**: Directory listing is overwhelming
- **Scan Time**: Finding the right directory takes longer
- **No Grouping**: Related directories not visually grouped
- **Alphabetical Chaos**: Related items scattered alphabetically (docker, daemon, deacon far apart)
- **No Visual Hierarchy**: All directories appear equally important

**Impact:** Medium - Affects daily developer experience

---

### 13. Naming Conventions Inconsistency

**Problem:** No consistent naming patterns across directories

**Examples:**
- Singular vs plural: `script/` vs `scripts/`, `test/` vs `tests/`
- Kebab-case vs snake_case: `feature_audit/` vs `fast-openvscode-vm/`
- Abbreviations: `cmd/` vs `command/`, `td/` vs full names
- Descriptiveness: `src/` (clear) vs `mayor/` (unclear)

**Pain Points:**
- **Guesswork**: Developers must guess directory names
- **Multiple Searches**: Trying variations to find the right directory
- **Inconsistent Additions**: New directories follow different conventions
- **No Style Guide**: No documented naming standards

**Impact:** Low-Medium - Minor friction but frequent annoyance

---

## Build & Deployment Pain Points

### 14. Build Configuration Fragmentation

**Problem:** Build configs scattered across multiple locations

**Locations:**
- Root package.json
- Service-specific package.json files
- Dockerfiles in `docker/`
- Build scripts in `scripts/`
- CI/CD configs in `.github/`
- Infrastructure configs in `infrastructure/`

**Pain Points:**
- **Build Path Confusion**: Unclear which scripts run which builds
- **Environment Setup**: No clear "getting started" build path
- **Monorepo Challenges**: No clear monorepo tooling (Nx, Turborepo, etc.)
- **Caching Strategy**: No documented build caching approach
- **Dependency Installation**: Unclear which services need which dependencies

**Impact:** High - Affects onboarding and CI/CD reliability

---

### 15. Deployment Environment Confusion

**Problem:** No clear separation of deployment environments

**Current State:**
- Production configs: Unclear where they live
- Staging configs: No clear staging environment setup
- Development configs: Mixed with production configs
- Local development: No documented local setup path

**Pain Points:**
- **Environment Leaks**: Production config accidentally used locally
- **Secret Management**: No clear pattern for secrets per environment
- **Configuration Drift**: Environments diverge over time
- **Testing Environments**: Unclear how to spin up test environment

**Impact:** High - Security and reliability risk

---

## Documentation & Knowledge Sharing

### 16. Documentation Organization

**Problem:** Documentation structure doesn't match code structure

**Current State:**
- `docs/` exists but may not reflect current 48-directory structure
- Service-specific docs: Unclear if they go in service dir or `docs/`
- API docs: No clear location
- Architecture docs: May be outdated given structure evolution

**Pain Points:**
- **Stale Documentation**: Structure changes faster than docs update
- **Discoverability**: Hard to find docs for specific services
- **Onboarding**: No clear "start here" documentation path
- **Mixed Content**: Technical docs mixed with user docs

**Impact:** Medium-High - Affects onboarding and knowledge transfer

---

## Summary of Top Priority Pain Points

### Critical (Must Fix)

1. **Infrastructure Directory Proliferation** - 6 overlapping directories
2. **Platform-Specific Fragmentation** - No unified platform strategy
3. **Service Organization Chaos** - No clear service boundaries
4. **Circular Dependency Risk** - No enforced module boundaries
5. **Shared Code Organization** - No clear sharing strategy
6. **Domain-Specific Directory Mystery** - Unclear purposes
7. **Build & Deployment Fragmentation** - Scattered configuration

### High Priority (Should Fix)

8. **Configuration Sprawl** - Multiple config locations
9. **Testing Strategy Inconsistency** - No clear patterns
10. **Flat Top-Level Structure** - 48+ directories is too many
11. **Documentation Organization** - Structure doesn't match code

### Medium Priority (Nice to Fix)

12. **Developer Tools Proliferation** - 6 overlapping tool directories
13. **Naming Conventions Inconsistency** - No style guide
14. **Vendor & Third-Party Ambiguity** - Similar directories

### Low Priority (Monitor)

15. **Archive & Version Management** - Infrequent operations
16. **Navigation & Discoverability** - Improved by fixing higher priorities

---

## Impact Assessment

### Developer Velocity Impact

**Time Lost Per Week (Estimated):**
- Finding correct directory: 2-3 hours/developer
- Resolving import/dependency issues: 3-4 hours/developer
- Build/deployment confusion: 1-2 hours/developer
- Onboarding new developers: +10 hours overhead

**For a team of 5 developers:** ~50-60 hours/week lost to structural confusion

### Technical Debt Impact

**Debt Accumulation:**
- Duplicated code across services
- Circular dependencies increasing
- Configuration drift between environments
- Testing gaps due to unclear patterns
- Documentation falling further behind

### Business Impact

**Risks:**
- Slower feature delivery due to navigation overhead
- Increased onboarding time (weeks instead of days)
- Higher bug rate from configuration errors
- Deployment delays from unclear processes
- Difficulty scaling team due to complexity

---

## Root Causes Analysis

### Why These Problems Exist

1. **Organic Growth**: Structure evolved without upfront architectural planning
2. **Multiple Contributors**: Different developers added directories following different patterns
3. **No Governance**: No documented standards or review for new directories
4. **Short-Term Thinking**: Quick additions without considering long-term organization
5. **Tool Proliferation**: Each new tool created its own directory
6. **Lack of Refactoring**: Structure never refactored as project grew
7. **Missing Documentation**: No living documentation of intended structure

### Lessons Learned

1. **Architecture First**: Define structure before significant code development
2. **Enforce Boundaries**: Need tooling to enforce module boundaries
3. **Living Documentation**: Structure documentation must stay current
4. **Naming Standards**: Must have and enforce naming conventions
5. **Regular Audits**: Periodic structure reviews prevent sprawl
6. **Onboarding Feedback**: New developers reveal structure problems

---

## Next Steps

Based on this pain point analysis, the modular structure design must address:

1. **Service Consolidation**: All services under `services/` with clear boundaries
2. **Infrastructure Unification**: Single `infrastructure/` with clear subdirectories
3. **Platform Strategy**: Unified `platforms/` with consistent organization
4. **Shared Code Pattern**: Clear `shared/` directory with versioning
5. **Configuration Standard**: Single `config/` with environment separation
6. **Testing Conventions**: Clear patterns for unit/integration/e2e tests
7. **Documentation Alignment**: Docs structure mirrors code structure
8. **Dependency Enforcement**: Tools to prevent circular dependencies
9. **Naming Standards**: Document and enforce naming conventions
10. **Governance Process**: Review process for new directories

---

**Analysis Date:** February 14, 2026
**Next Review:** After proposed structure design
**Priority:** High - Blocking modular architecture implementation
