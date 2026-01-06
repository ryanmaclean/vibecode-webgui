# VibeCode SwiftUI Apps - Documentation

**Status:** Refactoring in Progress (Phase 0 Complete)

---

## 📚 Quick Links

### For Humans
- [Refactoring Overview](../REFACTORING-IN-PROGRESS.md) - What's happening and why
- [Migration Status](../MIGRATION-STATUS.md) - Current progress tracker
- [Architecture Decision Records](./ADRs/) - Design decisions
- [WWDC 2022 Alignment](./WWDC-2022-ALIGNMENT.md) - Apple VZ framework compliance
- [Architecture Overview](../ARCHITECTURE.md) - System architecture
- [Project Status](./PROJECT-STATUS-SUMMARY.md) - Current project status

### Organized Documentation
- [Agent Reports](./reports/) - All agent completion summaries
- [Performance Analysis](./performance/README-PERFORMANCE.md) - Performance benchmarks and analysis
- [Testing Documentation](./testing/README-TESTING.md) - Test reports and guides
- [Integration Guides](./guides/) - VSOCK, networking, serial console, deployment
- [Release Notes](./releases/) - Version history and changelogs
- [Quick Start Guides](./quick-start/) - Fast reference cards

### For AI Assistants
- [AI Rules](./.ai-rules) - Machine-readable rules
- [Cursor Rules](../.cursorrules) - Cursor/Claude Code specific
- [Refactoring Questions](../REFACTORING-QUESTIONS.md) - Q&A for AI
- [Git Attributes](../.gitattributes) - Git handling rules

---

## 🗂️ Document Structure

```
docs/
├── README.md                          (you are here)
├── WWDC-2022-ALIGNMENT.md             ✅ Apple VZ framework compliance
├── MIGRATION-COMPLETE-SUMMARY.md      Migration completion summary
├── VSOCK-API-MIGRATION.md             VSOCK API migration details
├── PROJECT-STATUS-SUMMARY.md          Current project status
├── REFACTORING-COMPLETE-EXECUTIVE-SUMMARY.md  Refactoring summary
├── CODE-QUALITY-REPORT.md             Code quality analysis
├── COMPARISON.md                      Feature comparisons
│
├── reports/                           📋 Agent completion reports
│   ├── AGENT*-*.md                    Individual agent reports
│   ├── DOCUMENTATION-UPDATE-REPORT.md
│   ├── DELIVERY-REPORT.md
│   ├── CODE-SIGNING-SUMMARY.md
│   └── OBSERVABILITY-VERIFICATION-SUMMARY.md
│
├── performance/                       📊 Performance analysis
│   ├── README-PERFORMANCE.md          Performance docs index
│   ├── PERFORMANCE-INDEX.md           Performance test index
│   ├── PERFORMANCE-EXECUTIVE-SUMMARY.md
│   ├── PERFORMANCE-BENCHMARK-REPORT.md
│   ├── PERFORMANCE-COMPARISON-TABLES.md
│   ├── PERFORMANCE-VALIDATION-FINAL.md
│   └── PERFORMANCE-*.md               Additional reports
│
├── testing/                           🧪 Test reports and results
│   ├── README-TESTING.md              Testing docs index
│   ├── TEST-INDEX.md                  Test suite index
│   ├── TESTING-GUIDE.md               How to run tests
│   ├── INTEGRATION-TEST-REPORT.md
│   ├── BUILD-TEST-REPORT.md
│   ├── BUILD-VERIFICATION-REPORT.md
│   ├── SHARED-TESTS-QUICK-START.md
│   └── TEST-*.md                      Test execution reports
│
├── guides/                            📖 Integration and user guides
│   ├── DATADOG-PROVIDER-INTEGRATION-GUIDE.md
│   ├── DEPLOYMENT-GUIDE.md
│   ├── VM-CONNECTIVITY-COMPLETE-GUIDE.md
│   ├── NETWORK-*.md                   Network configuration guides
│   ├── SERIAL-CONSOLE-*.md            Serial console guides
│   ├── VSOCK-*.md                     VSOCK implementation guides
│   ├── README-VSOCK.md                VSOCK documentation
│   ├── OPENTELEMETRY-INTEGRATION.md
│   └── INIT-SCRIPT-UPDATE-INSTRUCTIONS.md
│
├── releases/                          📦 Release notes and changelogs
│   ├── RELEASE-NOTES-BasicVibeCode.md
│   ├── RELEASE-NOTES-v2.0.md
│   └── RELEASE-NOTES-VibeCode-MultiVM.md
│
├── quick-start/                       ⚡ Quick reference cards
│   ├── QUICK-START-TESTING.md
│   ├── QUICK-TEST-REFERENCE.md
│   ├── SIGNING-QUICK-REFERENCE.md
│   └── OPENTELEMETRY-QUICKSTART.md
│
└── ADRs/                              Architecture Decision Records
    ├── ADR-001-shared-vm-infrastructure.md
    ├── ADR-002-observability-unification.md  (TODO)
    └── ADR-003-network-strategies.md         (TODO)
```

---

## 🔧 Technology Stack

**CRITICAL:** This project uses **ONLY Apple's native Virtualization.framework**

✅ **What We Use:**
- **Swift 6** - Modern Swift with strict concurrency
- **Apple Virtualization.framework** - VZVirtualMachine, VZLinuxBootLoader, VZ device APIs
- **SwiftUI** - Native macOS UI framework
- **Combine** - Reactive state management
- **Python 3 + ddtrace** - Build/release automation with observability

❌ **What We DON'T Use:**
- ❌ vfkit (external VM tool)
- ❌ QEMU, VMware, VirtualBox
- ❌ Any command-line VM executables
- ❌ External VM management tools

**Why Pure Apple VZ?**
- Native integration with macOS
- Better performance (no IPC overhead)
- More reliable (no external processes)
- Simpler deployment (no dependencies)
- Apple Silicon optimized
- Follows WWDC 2022 best practices ✅

See [WWDC-2022-ALIGNMENT.md](./WWDC-2022-ALIGNMENT.md) for full compliance details.

---

## 🎯 Purpose of This Documentation

This documentation exists to:

1. **Make refactoring transparent** - Anyone (human or AI) can see what's happening
2. **Prevent regressions** - Rules prevent adding duplicate code
3. **Enable collaboration** - Multiple AI assistants can work together
4. **Track progress** - Clear visibility into migration status
5. **Document decisions** - ADRs explain "why" for future reference

---

## 🤖 For AI Assistants

**Before making ANY code change in this repository:**

1. ✅ Read [REFACTORING-IN-PROGRESS.md](../REFACTORING-IN-PROGRESS.md)
2. ✅ Check [MIGRATION-STATUS.md](../MIGRATION-STATUS.md) for file status
3. ✅ Follow rules in [.ai-rules](../.ai-rules)
4. ✅ Use templates in [.cursorrules](../.cursorrules)

**When uncertain:**
- Check [REFACTORING-QUESTIONS.md](../REFACTORING-QUESTIONS.md)
- Add new question if not found
- Document assumption in code comments
- Mark with `TODO(refactor):` for human review

---

## 👥 For Human Developers

**New to this codebase?**
Start here:
1. Read [REFACTORING-IN-PROGRESS.md](../REFACTORING-IN-PROGRESS.md) (5 min)
2. Check [MIGRATION-STATUS.md](../MIGRATION-STATUS.md) for current state (2 min)
3. Read [ADR-001](./ADRs/ADR-001-shared-vm-infrastructure.md) for architecture (10 min)
4. Read [Shared/README.md](../Shared/README.md) when Phase 1 complete

**Want to contribute?**
1. Pick a task from [MIGRATION-STATUS.md](../MIGRATION-STATUS.md)
2. Follow [MIGRATION-PLAYBOOK.md](./MIGRATION-PLAYBOOK.md) (TODO)
3. Update status in MIGRATION-STATUS.md
4. Submit PR with clear migration phase in description

**Found a problem?**
- Add to [REFACTORING-BLOCKERS.md](../REFACTORING-BLOCKERS.md) (TODO)
- Tag with phase number
- Suggest resolution if possible

---

## 📋 Architecture Decision Records (ADRs)

ADRs document significant architectural decisions:

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./ADRs/ADR-001-shared-vm-infrastructure.md) | Shared VM Infrastructure with BaseVMManager | Accepted | 2025-11-25 |
| [WWDC-2022](./WWDC-2022-ALIGNMENT.md) | Apple Virtualization.framework Compliance | ✅ Verified | 2025-11-25 |
| ADR-002 | Observability Provider Unification | Draft | TBD |
| ADR-003 | Network Strategy Pattern | Draft | TBD |
| ADR-004 | Testing Harness Design | Draft | TBD |

**Creating new ADRs:**
Use template: `docs/ADRs/ADR-template.md` (TODO)

---

## 🏗️ Migration Phases

Current phase: **Phase 0 - Planning** ✅

| Phase | Focus | Status | ETA |
|-------|-------|--------|-----|
| 0 | Planning & Documentation | ✅ Complete | Done |
| 1 | Core Infrastructure (BaseVMManager, Shared/) | 🔜 Next | Week 1 |
| 2 | Observability Unification | ⏳ Planned | Week 2 |
| 3 | VM App Refactoring | ⏳ Planned | Week 3 |
| 4 | Testing & Network Apps | ⏳ Planned | Week 4 |
| 5 | Polish & Documentation | ⏳ Planned | Week 5 |

---

## 📊 Progress Tracking

See [MIGRATION-STATUS.md](../MIGRATION-STATUS.md) for:
- File-by-file status (LEGACY/MIGRATING/MIGRATED/NEW)
- Phase completion percentages
- Current assignees
- Blockers and notes

---

## 🎓 Learning Resources

### Understanding the Architecture

1. **Current (Legacy) Architecture:**
   - Each app has embedded VMManager
   - Networking, console, observability all duplicated
   - ~3,900 lines of code across 6 apps

2. **Target (Refactored) Architecture:**
   - Shared `BaseVMManager` with hook methods
   - Strategy pattern for networking
   - Protocol-based observability
   - ~2,500 lines (36% reduction)

3. **Migration Strategy:**
   - Parallel implementation (old and new coexist)
   - Gradual migration (one app at a time)
   - Full test coverage
   - Rollback capability at any point

### Key Patterns

**Template Method Pattern:**
```swift
class BaseVMManager {
    final func startVM() {
        // Common logic
        let strategy = createNetworkingStrategy()
        // More common logic
    }

    // Override in subclass
    func createNetworkingStrategy() -> NetworkingStrategy
}
```

**Strategy Pattern:**
```swift
protocol NetworkingStrategy {
    func configure(_ config: VZVirtualMachineConfiguration)
}

class NATNetworkStrategy: NetworkingStrategy { }
class VsockNetworkStrategy: NetworkingStrategy { }
```

**Observer Pattern:**
```swift
protocol ObservabilityProvider {
    func startSpan(name: String) -> SpanContext
    func endSpan(context: SpanContext, status: Status)
}

class DatadogProvider: ObservabilityProvider { }
class OpenTelemetryProvider: ObservabilityProvider { }
```

---

## 🔧 Tools & Automation

### Pre-Commit Checks (TODO)
- Detect VM configuration duplication
- Enforce file location rules
- Check @deprecated markers resolved
- Validate MIGRATION-STATUS.md updates

### CI Checks (TODO)
- All tests pass
- No LEGACY files modified without @deprecated markers
- Shared components have tests
- Documentation up-to-date

### Metrics Dashboard (TODO)
- Code duplication percentage
- Migration completion percentage
- Test coverage
- Lines of code trend

---

## 📞 Contact & Support

**Questions about refactoring?**
- Check [FAQ](./FAQ-REFACTORING.md) (TODO)
- Add to [REFACTORING-QUESTIONS.md](../REFACTORING-QUESTIONS.md)

**Found a bug during migration?**
- Document in [REFACTORING-BLOCKERS.md](../REFACTORING-BLOCKERS.md) (TODO)
- Continue with other tasks

**Want to help?**
- Pick a task from [MIGRATION-STATUS.md](../MIGRATION-STATUS.md)
- Follow [MIGRATION-PLAYBOOK.md](./MIGRATION-PLAYBOOK.md) (TODO)

---

## 📅 Timeline

**Start Date:** 2025-11-25
**Target Completion:** 2025-12-20
**Current Phase:** 0 (Planning) ✅
**Next Milestone:** Phase 1 Week 1 Complete

---

## ✅ Success Criteria

Migration considered successful when:
- [ ] **Code reduction**: 35%+ reduction achieved
- [ ] **All apps migrated**: All 6 apps using BaseVMManager
- [ ] **Test coverage**: 80%+ for shared components
- [ ] **No regressions**: All apps work identically
- [ ] **Performance**: No degradation in VM startup
- [ ] **Documentation**: Complete and up-to-date
- [ ] **AI rules**: Working across all AI assistants
- [ ] **Clean state**: All @deprecated markers removed

---

**Last Updated:** 2025-11-25 by Claude Code
**Next Review:** After Phase 1 completion
