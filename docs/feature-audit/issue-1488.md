# Feature Audit: Auto-Discovery - Automatic VM Image Detection

Issue: #1488
Source release: VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance

## Summary

The auto-discovery feature automatically detects and loads VM images from multiple predefined locations, eliminating the need for manual VM configuration.

## Expected Behavior

- Automatically scan predefined directories for VM images
- Support multiple discovery locations (bundle, development, user paths)
- Load VM metadata and display available VMs in the UI
- Graceful handling when no VMs are found

## Current State

**VERIFIED: Feature exists in mainline**

### Implementation Location

`platforms/macos/VibeCodeSwift/Sources/ViewModels/VMManager.swift`

### Discovery Locations (Priority Order)

| Priority | Location | Purpose |
|----------|----------|---------|
| 1 | `Bundle.main.resourcePath/vms` | Bundled VMs in app package |
| 2 | `/Users/studio/Documents/vibecode-webgui/dist/vm-images` | Development testing |
| 3 | `~/Library/Application Support/VibeCode/vms` | User-installed VMs |

### Key Implementation (VMManager.swift:34-93)

```swift
func loadAvailableVMs() {
    // Try multiple locations for VMs
    var vmPath: URL?

    // 1. Try app bundle Resources
    if let resourcePath = Bundle.main.resourcePath {
        let bundlePath = URL(fileURLWithPath: resourcePath).appendingPathComponent("vms")
        if FileManager.default.fileExists(atPath: bundlePath.path) {
            vmPath = bundlePath
        }
    }

    // 2. Try development location
    if vmPath == nil {
        let devPath = URL(fileURLWithPath: "/Users/studio/Documents/vibecode-webgui/dist/vm-images")
        if FileManager.default.fileExists(atPath: devPath.path) {
            vmPath = devPath
        }
    }

    // 3. Try user Application Support
    if vmPath == nil {
        if let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            let userPath = appSupport.appendingPathComponent("VibeCode/vms")
            if FileManager.default.fileExists(atPath: userPath.path) {
                vmPath = userPath
            }
        }
    }
    // ... scan directory for VM images
}
```

### Features Verified

1. **Multi-location scanning**: Checks bundle, dev, and user paths
2. **Automatic loading**: Called on VMManager initialization
3. **Observability integration**: Datadog logging for discovery events
4. **Debug support**: Writes discovery status to `/tmp/vibecode-debug.log`
5. **Error handling**: Graceful fallback when no VMs found

## Tests

Test file: `tests/feature-audit/issue-1488.test.ts`

## Conclusion

Feature is fully implemented and available in the current mainline. The auto-discovery system scans three locations in priority order and automatically populates the VM list.
