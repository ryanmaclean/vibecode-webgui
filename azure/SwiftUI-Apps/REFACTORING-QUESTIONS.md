# Refactoring Questions & Answers

**Purpose:** Track questions from AI assistants and human developers during refactoring

---

## Template

```markdown
### Q: [Question Title]
**Asked by:** [AI Assistant Name / Human Name]
**Date:** [ISO Date]
**Status:** [OPEN / ANSWERED / BLOCKED]

**Question:**
[Full question here]

**Context:**
- File: [relevant file]
- Phase: [1-5]
- Related: [related files/issues]

**Answer:**
[Answer when resolved]

**Decision:**
[Any architectural decisions made]
---
```

---

## Open Questions

### Q: Should BaseVMManager be a class or protocol?
**Asked by:** Claude Code
**Date:** 2025-11-25
**Status:** ANSWERED

**Question:**
Should `BaseVMManager` be:
- Option A: Abstract base class with template methods
- Option B: Protocol with default implementations (requires Swift 5.x)
- Option C: Protocol + separate VMManagerBase helper class

**Context:**
- All current VMManagers use classes
- Need to share implementation, not just interface
- Swift protocols with default implementations have limitations

**Answer:**
**Decision: Abstract base class (Option A)**

Rationale:
1. Allows shared implementation of common logic
2. Template method pattern fits our use case
3. Subclasses can override specific methods
4. No protocol witness table overhead
5. Easier to understand for developers

**Decision:**
Use `class BaseVMManager: NSObject, ObservableObject` with `override` methods.

---

### Q: How to handle @Published properties in BaseVMManager?
**Asked by:** Claude Code
**Date:** 2025-11-25
**Status:** ANSWERED

**Question:**
Can subclasses add additional @Published properties, or should all be in base class?

**Context:**
- LiquidGlassVibeCodeApp has `vmIPAddress`
- VsockVibeCodeApp has `vsockStatus`
- BasicVibeCodeApp only needs basic properties

**Answer:**
**Both are allowed:**
- Common properties in BaseVMManager (@Published var status, isRunning, etc.)
- App-specific properties in subclasses (e.g., `@Published var vsockStatus` in VsockVMManager)

SwiftUI will observe both base and subclass properties correctly.

**Decision:**
Base class: common properties
Subclasses: can add additional @Published properties as needed

---

## Resolved Questions

### Q: Should we consolidate DHCP V1 and V2 parsers?
**Asked by:** Analysis Agent
**Date:** 2025-11-25
**Status:** ANSWERED

**Question:**
DHCPLeaseParser.swift (V1) and DHCPLeaseParserV2.swift exist with overlapping functionality. Should we consolidate?

**Answer:**
**YES - Consolidate into DHCPLeaseMonitor.swift**

New API:
```swift
class DHCPLeaseMonitor {
    // V1 capability
    static func findIPAddress(macAddress: String) -> String?

    // V2 capabilities
    static func findMostRecentIP() -> String?
    static func getAllLeasedMACs() -> [String: String]

    // Enhanced monitoring
    static func startMonitoring(
        macAddress: String?,  // nil for auto-discovery
        onIPFound: @escaping (String) -> Void
    ) -> Timer
}
```

**Decision:**
Merge both, keep all functionality, improve API consistency.

---

### Q: Can VsockProxyServer be shared between apps?
**Asked by:** Analysis Agent
**Date:** 2025-11-25
**Status:** ANSWERED

**Question:**
VsockProxyServer and ProxyConnection are currently embedded in VsockVibeCodeApp. Should they move to Shared/?

**Answer:**
**YES - Move to Shared/Networking/**

Rationale:
- May be useful for other apps wanting vsock
- Not tied to VsockVibeCodeApp UI
- Pure networking logic
- Testable in isolation

New location: `Shared/Networking/VsockProxyServer.swift`

**Decision:**
Extract to shared, make VsockVMManager use VsockNetworkStrategy which uses VsockProxyServer internally.

---

## Blocked Questions

### Q: [Example Blocked Question]
**Asked by:** [AI Name]
**Date:** [Date]
**Status:** BLOCKED

**Question:**
[Question]

**Blocker:**
[What's blocking resolution]

**Waiting on:**
[Decision from human, another phase, etc.]

---

## How to Use This File

**AI Assistants:**
- When unsure about architecture decisions during migration
- Add question using template above
- Set Status: OPEN
- Continue with best judgment, note uncertainty in code comments

**Humans:**
- Review OPEN questions periodically
- Answer questions by filling in **Answer** and **Decision** sections
- Change Status to ANSWERED or BLOCKED
- Add to ADR if decision is architecturally significant

**After answering:**
- Notify AI assistants to check answers
- Consider if answer should become a rule in .ai-rules
- Update REFACTORING-IN-PROGRESS.md if it affects guidelines
