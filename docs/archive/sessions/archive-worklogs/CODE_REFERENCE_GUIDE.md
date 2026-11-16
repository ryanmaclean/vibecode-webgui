# VM IP Detection - Code Reference Guide

Quick reference for all code changes and key implementations.

## Table of Contents
1. [DHCP Parser Implementation](#dhcp-parser-implementation)
2. [SwiftUI App Integration](#swiftui-app-integration)
3. [UI Display Code](#ui-display-code)
4. [Testing Code](#testing-code)

---

## DHCP Parser Implementation

### File: DHCPLeaseParser.swift (Primary)

**Purpose**: Parse DHCP leases and find VM IP by MAC address

**Core Functions**:

```swift
// Main function - find IP for specific MAC
static func findVMIPAddress(macAddress: String = vmMACAddress) -> String?

// Start monitoring with callbacks
static func startMonitoring(
    macAddress: String = vmMACAddress,
    interval: TimeInterval = 1.0,
    onIPFound: @escaping (String) -> Void,
    onNotFound: @escaping () -> Void
) -> Timer
```

**Usage Example**:
```swift
// Start monitoring for VM IP
if let ip = DHCPLeaseParser.findVMIPAddress() {
    print("Found VM at: \(ip)")
}

// Or use continuous monitoring
let timer = DHCPLeaseParser.startMonitoring(
    macAddress: "52:54:00:12:34:90",
    onIPFound: { ip in
        print("VM IP: \(ip)")
        self.vmIP = ip
    },
    onNotFound: {
        print("VM IP lost")
        self.vmIP = nil
    }
)

// Stop monitoring when done
timer.invalidate()
```

**Key Constants**:
```swift
static let dhcpLeasesPath = "/var/db/dhcpd_leases"
static let vmMACAddress = "52:54:00:12:34:90"
```

---

### File: DHCPLeaseParserV2.swift (Enhanced)

**New Features**:

```swift
// Find most recent IP (auto-discovery)
static func findMostRecentIP() -> String?

// Get all MAC -> IP mappings
static func getAllLeasedMACs() -> [String: String]

// Monitor with fallback support
static func startMonitoringWithFallback(
    macAddress: String = vmMACAddress,
    useFallback: Bool = true,
    interval: TimeInterval = 1.0,
    onIPFound: @escaping (String) -> Void,
    onNotFound: @escaping () -> Void
) -> Timer
```

**Usage Examples**:
```swift
// Get all leases
let allLeases = DHCPLeaseParserV2.getAllLeasedMACs()
// Returns: ["52:54:00:12:34:90": "192.168.64.2", "aa:bb:cc:dd:ee:ff": "192.168.64.5"]

// Find most recent IP
if let recentIP = DHCPLeaseParserV2.findMostRecentIP() {
    print("Most recent VM IP: \(recentIP)")
}

// Monitor with fallback (try specific MAC, then most recent)
let timer = DHCPLeaseParserV2.startMonitoringWithFallback(
    useFallback: true
)
```

---

## SwiftUI App Integration

### File: BasicVibeCodeApp.swift

**VMManager Class Updates**:

```swift
class VMManager: ObservableObject {
    @Published var status = "Stopped"
    @Published var isRunning = false
    @Published var consoleOutput = ""
    @Published var serverURL: String?
    @Published var vmIPAddress: String?  // NEW

    private var vm: VZVirtualMachine?
    private var consoleFileHandle: FileHandle?
    private let consoleLogPath = URL(fileURLWithPath: "/tmp/vibecode-console.log")
    private var consoleTimer: Timer?
    private var dhcpMonitorTimer: Timer?  // NEW
    private let vmMACAddress = "52:54:00:12:34:90"  // NEW
```

**VM Startup Integration**:
```swift
private func onVMStarted() {
    DispatchQueue.main.async {
        self.isRunning = true
        self.status = "Running"

        // Console monitoring
        self.consoleTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
            self.updateConsoleOutput()
        }

        // NEW: Start DHCP monitoring
        self.dhcpMonitorTimer = DHCPLeaseParser.startMonitoring(
            macAddress: self.vmMACAddress,
            interval: 1.0,
            onIPFound: { ip in
                DispatchQueue.main.async {
                    self.vmIPAddress = ip
                    print("VM IP Address detected: \(ip)")
                }
            },
            onNotFound: {
                DispatchQueue.main.async {
                    self.vmIPAddress = nil
                }
            }
        )
    }
}
```

**VM Shutdown Cleanup**:
```swift
func stopVM() {
    guard isRunning else { return }

    status = "Stopping..."
    consoleTimer?.invalidate()
    consoleTimer = nil
    dhcpMonitorTimer?.invalidate()  // NEW: Clean up monitoring
    dhcpMonitorTimer = nil

    vm?.stop { _ in
        DispatchQueue.main.async {
            self.isRunning = false
            self.status = "Stopped"
            self.serverURL = nil
            self.vmIPAddress = nil  // NEW: Clear IP on stop
            try? self.consoleFileHandle?.close()
        }
    }
}
```

**URL Building Logic**:
```swift
private func updateConsoleOutput() {
    guard let output = try? String(contentsOf: consoleLogPath, encoding: .utf8) else { return }

    DispatchQueue.main.async {
        self.consoleOutput = String(output.suffix(2000))

        // NEW: Check if server is ready
        if output.contains("Server will be available") && self.serverURL == nil {
            // Use actual VM IP if available, otherwise fallback to localhost
            if let vmIP = self.vmIPAddress {
                self.serverURL = "http://\(vmIP):3000"
            } else {
                self.serverURL = "http://localhost:3000"
            }
            self.status = "Ready"
        }
    }
}
```

---

## UI Display Code

### File: BasicVibeCodeApp.swift - UI Updates

**Status Section with IP Display**:
```swift
// Status
VStack(alignment: .leading, spacing: 8) {
    HStack {
        Circle()
            .fill(vmManager.isRunning ? Color.green : Color.gray)
            .frame(width: 12, height: 12)
        Text(vmManager.status)
            .font(.system(.body, design: .monospaced))
    }

    // NEW: VM IP Address if detected
    if let vmIP = vmManager.vmIPAddress {
        HStack(spacing: 8) {
            Image(systemName: "network")
                .foregroundColor(.blue)
            Text("VM IP: \(vmIP)")
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(.secondary)
        }
    }
}
```

---

### File: LiquidGlassVibeCodeApp.swift - Premium UI

**Enhanced IP Address Card**:
```swift
// NEW: VM IP Address display with glassmorphism
if let vmIP = vmManager.vmIPAddress {
    HStack(spacing: 12) {
        Image(systemName: "network")
            .font(.system(size: 18))
            .foregroundStyle(
                LinearGradient(
                    colors: [.green, .teal],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )

        VStack(alignment: .leading, spacing: 2) {
            Text("VM Network Address")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.white.opacity(0.7))

            Text(vmIP)
                .font(.system(size: 14, weight: .medium, design: .monospaced))
                .foregroundColor(.white.opacity(0.9))
        }

        Spacer()
    }
    .padding(16)
    .background(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(.ultraThinMaterial)
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.green.opacity(0.3), lineWidth: 1)
            )
    )
    .padding(.top, 20)
}
```

**Same Backend Changes as BasicApp**:
- Identical VMManager implementation
- Same DHCP monitoring logic
- Same URL building with IP detection
- Only UI rendering differs

---

## Testing Code

### File: TestDHCPParser.swift (Swift Tests)

**Basic Test Structure**:
```swift
struct TestDHCPParser {
    static func main() {
        print("=== DHCP Lease Parser Test Suite ===\n")

        // Test 1: Read actual DHCP
        print("Test 1: Reading actual DHCP leases file")
        if let ip = DHCPLeaseParser.findVMIPAddress() {
            print("✓ Successfully found VM IP: \(ip)")
        } else {
            print("✗ No VM IP found")
        }

        // Test 2: Parse sample content
        let sampleDHCP = """
        {
            name=studioslMachine
            ip_address=192.168.64.2
            hw_address=1,6a:1:60:6d:ef:38
            lease=0x6903c794
        }
        """
        testParseContent(sampleDHCP, expectedIP: "192.168.64.2")
    }
}

// Run with: swift TestDHCPParser.swift
TestDHCPParser.main()
```

---

### File: test-dhcp-detection.sh (Bash Tests)

**Run All Tests**:
```bash
#!/bin/bash

echo "=== VibeCode VM IP Detection Test Suite ==="

# Test 1: Check DHCP file exists
if [ -f /var/db/dhcpd_leases ]; then
    echo "✓ DHCP leases file exists"
else
    echo "✗ DHCP leases file not found"
    exit 1
fi

# Test 2: Read current leases
echo "Reading DHCP leases..."
cat /var/db/dhcpd_leases

# Test 3: Extract IPs
echo "All IPs:"
grep -o 'ip_address=[^[:space:]]*' /var/db/dhcpd_leases | cut -d= -f2

# Test 4: Find target MAC
TARGET_MAC="52:54:00:12:34:90"
if grep -q "$TARGET_MAC" /var/db/dhcpd_leases; then
    echo "✓ Found target MAC"
    VM_IP=$(grep -B2 -A2 "$TARGET_MAC" /var/db/dhcpd_leases | grep ip_address | cut -d= -f2)
    echo "  VM IP: $VM_IP"
else
    echo "✗ Target MAC not found"
fi
```

**Usage**:
```bash
bash /Users/ryan.maclean/vibecode-webgui/test-dhcp-detection.sh
```

---

## Integration Checklist

Use this to verify integration:

```
SwiftUI Integration:
  [ ] DHCPLeaseParser.swift imported
  [ ] vmIPAddress @Published property added
  [ ] dhcpMonitorTimer private property added
  [ ] vmMACAddress constant defined
  [ ] onVMStarted() calls DHCPLeaseParser.startMonitoring()
  [ ] stopVM() invalidates dhcpMonitorTimer
  [ ] updateConsoleOutput() uses vmIPAddress for URL building

UI Updates:
  [ ] Status section displays vmIPAddress when available
  [ ] Network icon shown with IP
  [ ] LiquidGlassApp has enhanced IP card
  [ ] URL link built with actual IP

Testing:
  [ ] test-dhcp-detection.sh executable
  [ ] TestDHCPParser.swift compiles
  [ ] DHCP file readable and contains leases
  [ ] Manual testing works end-to-end
```

---

## Common Modifications

### Change Monitoring Interval

**Current**: 1 second
**In**: `DHCPLeaseParser.startMonitoring(..., interval: 1.0, ...)`

```swift
// More responsive:
interval: 0.5  // Check every 500ms

// Less CPU intensive:
interval: 2.0  // Check every 2 seconds
```

### Use Different MAC Address

**Current**: `"52:54:00:12:34:90"`
**In**: Private property `vmMACAddress`

```swift
private let vmMACAddress = "52:54:00:12:34:AB"  // Your new MAC
```

### Enable Fallback Mode

**Switch from V1 to V2 parser**:

```swift
// Replace this:
self.dhcpMonitorTimer = DHCPLeaseParser.startMonitoring(...)

// With this:
self.dhcpMonitorTimer = DHCPLeaseParserV2.startMonitoringWithFallback(
    useFallback: true  // Try specific MAC, then most recent
)
```

### Add IP Validation

**Before using IP**:

```swift
func isValidVMIP(_ ip: String) -> Bool {
    // Check format: 192.168.64.X
    let pattern = "^192\\.168\\.64\\.([1-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-4])$"
    return NSPredicate(format: "SELF MATCHES %@", pattern).evaluate(with: ip)
}

// Use:
if let vmIP = vmIPAddress, isValidVMIP(vmIP) {
    // Safe to use IP
}
```

---

## DHCP File Format Reference

**Location**: `/var/db/dhcpd_leases`

**Format**:
```
{
    name=<hostname>
    ip_address=<ip_address>
    hw_address=<type>,<mac_address>
    identifier=<type>,<mac_address>
    lease=<timestamp>
}
```

**Example**:
```
{
    name=studioslMachine
    ip_address=192.168.64.2
    hw_address=1,52:54:00:12:34:90
    identifier=1,52:54:00:12:34:90
    lease=0x6903c794
}
```

**Field Meanings**:
- `name`: DHCP hostname
- `ip_address`: Assigned IP address
- `hw_address`: Hardware type (1=Ethernet) + MAC address
- `identifier`: Same as hw_address
- `lease`: Lease timestamp/ID

---

## Debug Output Examples

### Console Output When IP Detected

```
DEBUG: DHCP leases content:
{
    name=studioslMachine
    ip_address=192.168.64.2
    hw_address=1,52:54:00:12:34:90
    ...
}
DEBUG: Found 1 lease blocks
DEBUG: Lease - hw_address: 1,52:54:00:12:34:90, ip_address: 192.168.64.2
DEBUG: MATCH FOUND! VM IP: 192.168.64.2
VM IP Address detected: 192.168.64.2
```

### App Status Progression

```
1. User clicks "Start VM"
   Status: "Starting..."

2. VM kernel boots
   Status: "Running"

3. DHCP assigns IP
   IP: "192.168.64.2"

4. OpenVSCode server starts
   Status: "Ready"
   URL: "http://192.168.64.2:3000"
```

---

## Performance Metrics

**Current Implementation**:
- Monitoring interval: 1 second
- DHCP file size: ~130 bytes
- Regex matching: < 1ms
- Timer overhead: minimal
- Memory impact: < 1MB

**Optimization Tips**:
1. Increase interval after IP found
2. Stop timer when VM not running
3. Cache IP address locally
4. Use background queue for file I/O

---

## References

- Full guide: `/Users/ryan.maclean/vibecode-webgui/azure/DHCP_IP_DETECTION_GUIDE.md`
- Implementation summary: `/Users/ryan.maclean/vibecode-webgui/IMPLEMENTATION_SUMMARY.md`
- Parser source: `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/DHCPLeaseParser.swift`
- Tests: `/Users/ryan.maclean/vibecode-webgui/test-dhcp-detection.sh`
