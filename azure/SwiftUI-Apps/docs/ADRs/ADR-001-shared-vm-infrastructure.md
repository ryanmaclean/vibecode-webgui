# ADR-001: Shared VM Infrastructure with BaseVMManager

**Status:** Accepted
**Date:** 2025-11-25
**Deciders:** Architecture Team
**Consulted:** Claude Code, AI Analysis

---

## Context

We have 6 VM-based applications with 60-70% code duplication:
- BasicVibeCodeApp (285 lines)
- LiquidGlassVibeCodeApp (688 lines)
- VsockVibeCodeApp (458 lines)
- NetworkTestVibeCodeApp (274 lines)
- NetworkTestCLI (262 lines)

Each app duplicates:
- VM configuration logic (~80 lines)
- Console monitoring (~40 lines)
- Lifecycle management (~50 lines)
- Error handling (~30 lines)

This creates maintenance burden:
- Bug fixes require updates in 6 places
- New features need parallel implementation
- Testing is duplicated
- Architecture is inconsistent

---

## Decision

We will create a **shared infrastructure** based on:

1. **BaseVMManager** - Abstract base class with template method pattern
2. **Strategy Pattern** for networking (NAT, vsock, bridge, etc.)
3. **Strategy Pattern** for observability (Datadog, OpenTelemetry, etc.)
4. **Shared utilities** for DHCP, console monitoring, testing

### Architecture

```
VibeCodeKit/
├── Core/
│   ├── BaseVMManager.swift           [Abstract base with hooks]
│   └── VMConfiguration/              [Configuration builders]
├── Networking/
│   ├── NetworkingStrategy.swift      [Protocol]
│   ├── NATNetworkStrategy.swift
│   ├── VsockNetworkStrategy.swift
│   └── DHCPLeaseMonitor.swift        [Consolidated]
├── Observability/
│   ├── ObservabilityProvider.swift   [Protocol]
│   ├── DatadogProvider.swift
│   ├── OpenTelemetryProvider.swift
│   └── CompositeProvider.swift
└── Testing/
    ├── NetworkTestSuite.swift
    └── VMTestHarness.swift
```

### Example Usage

```swift
// Apps/BasicVibeCodeApp/BasicVMManager.swift
final class BasicVMManager: BaseVMManager {
    override func createNetworkingStrategy() -> NetworkingStrategy {
        return NATNetworkStrategy()
    }

    override func getKernelCommandLine() -> String {
        return "console=hvc0 debug loglevel=8 ipv6.disable=1"
    }
}
```

---

## Consequences

### Positive

- **36% code reduction**: ~3,900 lines → ~2,500 lines
- **Single source of truth**: Bug fixes in one place
- **Faster development**: New apps in 1 day instead of 3
- **Consistent behavior**: All apps use same VM management
- **Easier testing**: Shared test harness and mocks
- **Pluggable observability**: Choose backend via config

### Negative

- **Initial complexity**: More files to understand initially
- **Migration effort**: 5 weeks to migrate all apps
- **Learning curve**: Developers need to learn hook system
- **Risk during transition**: Apps must work during migration

### Mitigation

- Maintain parallel implementations during migration
- Comprehensive documentation of shared components
- Clear migration playbook with step-by-step guide
- Test each app thoroughly after migration
- Rollback plan: keep git history, can revert per-app

---

## Alternatives Considered

### Alternative 1: Merge All Apps Into One

**Pros:**
- Single codebase
- Maximum code sharing
- One build/test cycle

**Cons:**
- Large monolithic app
- Mixing concerns (basic vs premium features)
- User confusion (too many options)
- Harder to maintain separate experiences

**Rejected:** Too much coupling, violates separation of concerns

### Alternative 2: Framework/Library

**Pros:**
- Can distribute independently
- Versioned releases
- Clear API boundaries

**Cons:**
- Overkill for 6 apps
- Framework overhead
- Versioning complexity
- Slower iteration

**Rejected:** Over-engineering for current scale

### Alternative 3: Code Generation

**Pros:**
- No runtime dependencies
- Apps fully independent
- Easy to customize generated code

**Cons:**
- Generated code drift
- Regeneration complexity
- Templates hard to maintain
- Still duplicates at build time

**Rejected:** Doesn't solve maintenance burden

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
- Create `Shared/` directory
- Implement `BaseVMManager`
- Extract networking strategies
- Consolidate DHCP parsers

### Phase 2: Observability (Week 2)
- Create `ObservabilityProvider` protocol
- Wrap existing implementations
- Create `CompositeProvider`

### Phase 3: App Migration (Week 3)
- Migrate BasicVibeCodeApp
- Migrate LiquidGlassVibeCodeApp
- Migrate VsockVibeCodeApp

### Phase 4: Testing (Week 4)
- Migrate NetworkTestVibeCodeApp
- Migrate NetworkTestCLI
- Create shared test suite

### Phase 5: Polish (Week 5)
- Documentation
- Performance validation
- Remove deprecated code

---

## Success Metrics

- [ ] **Code reduction**: Achieve 35%+ reduction
- [ ] **Test coverage**: 80%+ for shared components
- [ ] **Performance**: No regression in VM startup time
- [ ] **Observability**: All metrics still firing
- [ ] **New app velocity**: <1 day to create new themed app
- [ ] **Bug fix time**: 50% reduction in time to fix cross-app bugs

---

## References

- Analysis: See agent reports in conversation history
- Code duplication analysis: REFACTORING-IN-PROGRESS.md
- Migration tracking: MIGRATION-STATUS.md
- AI rules: .ai-rules, .cursorrules

---

## Approval

**Approved by:** [Pending]
**Date:** 2025-11-25
**Review Date:** 2025-12-20 (after Phase 5 completion)
