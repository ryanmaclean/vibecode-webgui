# 🚧 REFACTORING IN PROGRESS 🚧

**Status:** Active Architecture Migration
**Start Date:** 2025-11-25
**Target Completion:** 2025-12-20
**Progress:** Phase 0 - Planning Complete

---

## ⚠️ IMPORTANT: Read Before Making Changes

This codebase is undergoing a **major architectural refactoring** to eliminate code duplication and establish shared infrastructure.

### Current State
- **6 VM applications** with 60-70% duplicated code
- **3 observability systems** with overlapping functionality
- **Multiple DHCP parsers** (V1, V2) needing consolidation
- **~3,900 lines** of duplicated logic across apps

### Target State
- **Shared/** with reusable components
- **BaseVMManager** with pluggable strategies
- **Unified observability** layer (Datadog/OpenTelemetry)
- **~2,500 lines** after refactoring (36% reduction)
- **Pure Swift 6 + Apple Virtualization.framework** (no external VM tools)

---

## 🤖 AI Assistant Guidelines

**ALL AI coding assistants (Claude Code, Gemini CLI, OpenAI Codex, Cursor, etc.) MUST:**

### 1. DO NOT Add New Duplicate Code
❌ **FORBIDDEN:**
- Creating new VM manager classes without using BaseVMManager
- Duplicating console monitoring logic
- Copy-pasting networking configuration
- Adding observability without using ObservabilityProvider

✅ **REQUIRED:**
- Use existing shared components in `Shared/` directory
- Extend BaseVMManager for new VM apps
- Add network strategies, don't duplicate
- Use ObservabilityProvider protocol

### 2. Mark Legacy Code
When touching old code, add this header:
```swift
// @deprecated: Part of legacy implementation
// @migrate-to: Shared/Core/BaseVMManager.swift
// @see: REFACTORING-IN-PROGRESS.md
// TODO(refactor): Replace with BaseVMManager pattern
```

### 3. Check Migration Status
Before modifying any `.swift` file:
1. Check `MIGRATION-STATUS.md` for file status
2. If marked "MIGRATING", coordinate in that file's TODO
3. If marked "LEGACY", prefer refactoring over patches

### 4. New Code Location Rules
| What You're Adding | Where It Goes |
|--------------------|---------------|
| VM lifecycle logic | `Shared/Core/BaseVMManager.swift` |
| Networking strategy | `Shared/Networking/*Strategy.swift` |
| Console monitoring | `Shared/ConsoleMonitoring/` |
| Observability | `Shared/Observability/` |
| UI components | `Shared/UI/` (if reusable) |
| App-specific UI | `Apps/{AppName}/` |
| Tests | `Tests/` or `Shared/Testing/` |

### 5. Code Review Checklist
Before submitting changes, verify:
- [ ] No duplicated VM configuration code
- [ ] No new VMManager classes (extend BaseVMManager instead)
- [ ] Observability uses ObservabilityProvider protocol
- [ ] New networking uses NetworkingStrategy pattern
- [ ] Added tests for shared components
- [ ] Updated MIGRATION-STATUS.md if completing migration

---

## 📋 Active Migration Phases

| Phase | Status | Files Affected | Assignee |
|-------|--------|----------------|----------|
| **Phase 0: Planning** | ✅ Complete | All analysis docs | Claude |
| **Phase 1: Core** | 🔜 Next | BaseVMManager, Shared/ structure | - |
| **Phase 2: Observability** | ⏳ Planned | ObservabilityProvider, wrappers | - |
| **Phase 3: VM Apps** | ⏳ Planned | Basic, LiquidGlass, Vsock | - |
| **Phase 4: Testing** | ⏳ Planned | NetworkTest apps | - |
| **Phase 5: Polish** | ⏳ Planned | Documentation, cleanup | - |

---

## 🔍 Quick Reference: Is This File Being Migrated?

See: [MIGRATION-STATUS.md](./MIGRATION-STATUS.md)

---

## 📚 Architecture Documentation

- [Architecture Decision Records](./docs/ADRs/) - Design decisions
- [Shared Component Guide](./Shared/README.md) - How to use shared code
- [Migration Playbook](./docs/MIGRATION-PLAYBOOK.md) - Step-by-step guide
- [Testing Strategy](./docs/TESTING-STRATEGY.md) - How to test during migration

---

## 🤝 Getting Help

- **Questions?** Check [docs/FAQ-REFACTORING.md](./docs/FAQ-REFACTORING.md)
- **Conflicts?** See [docs/CONFLICT-RESOLUTION.md](./docs/CONFLICT-RESOLUTION.md)
- **Stuck?** Add to [REFACTORING-BLOCKERS.md](./REFACTORING-BLOCKERS.md)

---

## ⚡ TL;DR for AI Assistants

**4 Golden Rules:**
1. ❌ Don't duplicate VM management code
2. ✅ Use `Shared/` components
3. 📝 Mark legacy code with `@deprecated` + `@migrate-to`
4. ✅ **ONLY use Apple Virtualization.framework** (NOT vfkit, QEMU, etc.)

**Technology Stack:**
- Pure Swift 6 + Apple Virtualization.framework
- Native VZ APIs: `VZVirtualMachine`, `VZLinuxBootLoader`, `VZVirtioConsoleDeviceSerialPortConfiguration`
- No external VM tools or command-line executables

**When in doubt:** Ask the human or check MIGRATION-STATUS.md first.

---

## 🐍 Python Script Standards

**CRITICAL: ddtrace is REQUIRED (not optional)**

**Installation:**
```bash
pip3 install --break-system-packages --user ddtrace
export PATH="$HOME/Library/Python/3.14/bin:$PATH"
```

**ALL Python scripts in this repository MUST:**

1. ✅ **Use Python 3** (`#!/usr/bin/env python3`)
2. ✅ **Include ddtrace integration** (REQUIRED - install it first!)
3. ✅ **Use Colors class** for terminal output
4. ✅ **Have proper docstrings** (module + functions)
5. ✅ **Use type hints** where appropriate

**Pattern to follow:**
```python
# Try to import ddtrace for observability
try:
    import ddtrace
    from ddtrace import tracer
    DDTRACE_AVAILABLE = True
except ImportError:
    DDTRACE_AVAILABLE = False
    print("⚠️  ddtrace not available, running without tracing", file=sys.stderr)

# Always use with graceful fallback
if DDTRACE_AVAILABLE:
    with tracer.trace("operation_name", service="vibecode-service") as span:
        span.set_tag("key", "value")
        # do work
else:
    # do work without tracing
```

**Why ddtrace?**
- Consistent observability across Swift (Datadog), Python (ddtrace), and JavaScript
- Correlate VM operations with build/deploy scripts
- Track release process end-to-end
- Debug issues in production with traces

**Example scripts:**
- `scripts/create-github-release.py` - Release automation with ddtrace
- See also: `scripts/vfkit/validate-grub-installation.py` (from parent repo)
