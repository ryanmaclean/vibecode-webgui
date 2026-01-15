# ⚠️ CRITICAL REQUIREMENT: Console Colors

## NON-NEGOTIABLE REQUIREMENT

The console output window **MUST** display:
- **Green text**: RGB(0, 1, 0) / #00FF00
- **Black background**: RGB(0, 0, 0) / #000000

## DO NOT REVERT

This is a **user requirement** established on 2026-01-15 and must **NEVER** be changed or reverted.

## Implementation Location

**File**: `Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVibeCodeApp.swift`

**Lines**: ~310-318 (ConsoleView ScrollView)

```swift
ScrollView {
    Text(vmManager.consoleOutput)
        .font(.system(.body, design: .monospaced))
        .foregroundColor(Color(red: 0, green: 1, blue: 0))  // Green text - DO NOT CHANGE
        .frame(maxWidth: .infinity, alignment: .leading)
        .textSelection(.enabled)
        .padding()
}
.background(Color.black)  // Black background - DO NOT CHANGE
```

## Testing

**Test File**: `Tests/ConsoleColorTests.swift`

**Verification Script**: `Tests/verify-console-colors.sh`

Run the verification before any commit:
```bash
cd /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
./Tests/verify-console-colors.sh
```

## Why This Matters

User explicitly stated: "console output is BLACK AND GREEN! please ensure we have a test for this and NEVER REVERT"

The console output represents a terminal/shell environment, and green-on-black is the traditional terminal color scheme that users expect.

## What NOT To Do

❌ **DO NOT** use system colors like `NSColor.textBackgroundColor` (white)
❌ **DO NOT** use `Color(NSColor.textColor)` (black text)
❌ **DO NOT** change to "modern" or "system" color schemes
❌ **DO NOT** make colors configurable or themeable

## History

- **2026-01-15**: Initial implementation with wrong colors (black on white)
- **2026-01-15**: Fixed to green on black per user requirement
- **2026-01-15**: Added critical documentation and tests to prevent reversion

## If You Need To Change This

**You don't.** This is a non-negotiable user requirement.

If there's a legitimate reason to change console colors, you must:
1. Get explicit user approval
2. Update this documentation
3. Update the tests
4. Document the reason in git commit message

## Related Files

- `Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVibeCodeApp.swift` - Implementation
- `Tests/ConsoleColorTests.swift` - Automated test
- `Tests/verify-console-colors.sh` - Shell verification script
- `V4.1.0-TESTING-CHECKLIST.md` - Manual testing checklist includes color verification

## Commits

- `7af7e2f99` - Initial console color fix (green on black)
- (This commit) - Added critical documentation and tests
