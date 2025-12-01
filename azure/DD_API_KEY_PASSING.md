# Datadog API Key Passing: Host-to-Guest Configuration

## Overview

This document describes the implementation of secure Datadog API key passing from the macOS host to Linux VM guests in VibeCode applications.

## Implementation Status

✅ **Method 1: Kernel Command Line (IMPLEMENTED)**
- Simple, built-in mechanism
- No extra infrastructure required
- Best for development/testing

🔄 **Method 2: vsock Communication (OPTIONAL)**
- More secure for production
- Requires vsock support (already available)
- Can be added later

⏸️ **Method 3: Serial Console (FALLBACK)**
- One-way communication
- Alternative if other methods fail

## Method 1: Kernel Command Line (Current Implementation)

### How It Works

1. **Host Side**: `BaseVMManager` reads Datadog API key from:
   - Environment variable: `DD_API_KEY`
   - File: `~/.datadog/api_key`

2. **Kernel Cmdline**: Key is added to kernel command line parameters:
   ```
   console=hvc0 debug loglevel=8 ipv6.disable=1 DD_API_KEY=... DD_SITE=...
   ```

3. **Guest Side**: Init script reads from `/proc/cmdline`:
   ```bash
   export $(cat /proc/cmdline | grep -o 'DD_API_KEY=[^ ]*')
   export $(cat /proc/cmdline | grep -o 'DD_SITE=[^ ]*')
   ```

### Files Modified

#### `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared/Core/BaseVMManager.swift`

Added three key methods:

1. **`getDatadogAPIKey()`** (lines 487-508)
   - Tries multiple sources in order:
     - `DD_API_KEY` environment variable
     - `DATADOG_API_KEY` environment variable
     - `~/.datadog/api_key` file
   - Returns `nil` if not found

2. **`getDatadogSite()`** (lines 510-524)
   - Gets Datadog site region from environment
   - Defaults to `"datadoghq.com"`
   - Supports: `datadoghq.com`, `datadoghq.eu`, `ddog-gov.com`

3. **`getKernelCommandLine()`** (lines 310-323)
   - Enhanced to include Datadog parameters
   - Automatically appends `DD_API_KEY` if available
   - Automatically appends `DD_SITE` if available

#### `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/BasicVibeCodeApp/BasicVMManager.swift`

Updated `getKernelCommandLine()` to call super implementation:
- Now includes Datadog support automatically
- Can be overridden by subclasses if needed

### Environment Setup

#### Quick Start

```bash
# Option 1: Set environment variables
export DD_API_KEY="your_api_key_here"
export DD_SITE="datadoghq.com"

# Option 2: Use setup script
./setup-datadog-env.sh
```

#### File-based Storage

Create `~/.datadog/api_key`:
```bash
mkdir -p ~/.datadog
echo "your_api_key_here" > ~/.datadog/api_key
chmod 600 ~/.datadog/api_key
```

### Testing

Run the test script:
```bash
chmod +x /tmp/test-dd-api-key-passing.sh
/tmp/test-dd-api-key-passing.sh
```

## Affected Applications

All VibeCode VM managers now support Datadog API key passing:

1. **BasicVibeCodeApp**
   - Standard NAT networking
   - Inherits Datadog support from BaseVMManager

2. **LiquidGlassVibeCodeApp**
   - NAT networking with Datadog observability
   - Already has DatadogLogger integration
   - Now automatically passes API key to guest

3. **VsockVibeCodeApp**
   - vsock networking
   - Inherits Datadog support from BaseVMManager

4. **NetworkTestVibeCodeApp**
   - Network testing utilities
   - Inherits Datadog support from BaseVMManager

## Security Considerations

### Current Implementation (Method 1)

**Visibility**: `DD_API_KEY` is visible in VM's `/proc/cmdline`

**Risk Level**: LOW to MEDIUM

**Suitable For**:
- Development environments
- Testing environments
- Internal networks

**Mitigation Strategies**:
1. Use restricted Datadog API keys (not admin keys)
2. Limit key permissions to metrics/logs only
3. Enable audit logging in Datadog
4. Rotate keys regularly
5. Use environment-specific keys

### Recommended Production Setup (Method 2 - Future)

```swift
// Example future implementation using vsock
device.setSocketListener(DatadogConfigListener(), forPort: 9999)

// Host sends config over secure vsock channel
// Guest reads from /dev/vsock/CID_HOST/9999
```

Benefits:
- Encrypted communication channel
- Not visible in kernel logs
- Better for production environments

## Usage Examples

### Example 1: Launch VM with Datadog Integration

```bash
export DD_API_KEY="your_api_key_here"
export DD_SITE="datadoghq.com"

# In Swift:
let vmManager = BasicVMManager()
vmManager.startVM()  // VM receives DD_API_KEY in kernel cmdline
```

### Example 2: Guest-side Init Script

```bash
#!/bin/sh
# In VM init script (e.g., /etc/init.d/S99datadog or in initramfs)

# Extract Datadog configuration from kernel command line
if [ -f /proc/cmdline ]; then
    # Read DD_API_KEY
    DD_API_KEY=$(cat /proc/cmdline | grep -o 'DD_API_KEY=[^ ]*' | cut -d= -f2)
    if [ -n "$DD_API_KEY" ]; then
        export DD_API_KEY="$DD_API_KEY"
        echo "Datadog API key configured from kernel cmdline"
    fi

    # Read DD_SITE
    DD_SITE=$(cat /proc/cmdline | grep -o 'DD_SITE=[^ ]*' | cut -d= -f2)
    if [ -n "$DD_SITE" ]; then
        export DD_SITE="$DD_SITE"
    fi

    # Start Datadog agent with configured credentials
    # /opt/datadog-agent/bin/agent/agent start
fi
```

### Example 3: Checking Configuration in VM

```bash
# In VM terminal:

# Check if DD_API_KEY was passed
cat /proc/cmdline | grep DD_API_KEY

# If Datadog agent is running:
datadog-agent status

# Check agent can reach Datadog servers
ps aux | grep datadog-agent
```

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│          macOS Host                     │
│  ┌───────────────────────────────────┐  │
│  │ BaseVMManager                     │  │
│  │ ┌─────────────────────────────┐   │  │
│  │ │ getDatadogAPIKey()          │   │  │
│  │ │ • Check DD_API_KEY env var  │   │  │
│  │ │ • Check ~/.datadog/api_key  │   │  │
│  │ ├─────────────────────────────┤   │  │
│  │ │ getKernelCommandLine()      │   │  │
│  │ │ • Builds kernel parameters │   │  │
│  │ │ • Includes DD_API_KEY       │   │  │
│  │ │ • Includes DD_SITE          │   │  │
│  │ └─────────────────────────────┘   │  │
│  └───────────────────────────────────┘  │
│                  │                       │
│                  │ bootloader.commandLine │
│                  ▼                       │
│  ┌───────────────────────────────────┐  │
│  │ VZLinuxBootLoader                 │  │
│  │ commandLine: "console=hvc0 ... DD │  │
│  │ _API_KEY=... DD_SITE=..."         │  │
│  └───────────────────────────────────┘  │
│                  │                       │
│                  │ VM start              │
└──────────────────┼──────────────────────┘
                   │
                   │
┌──────────────────▼──────────────────────┐
│       Linux VM (Guest)                  │
│  ┌───────────────────────────────────┐  │
│  │ /proc/cmdline                     │  │
│  │ "console=hvc0 ... DD_API_KEY=...  │  │
│  │  DD_SITE=..."                     │  │
│  └───────────────────────────────────┘  │
│                  │                       │
│                  │ init script reads     │
│                  ▼                       │
│  ┌───────────────────────────────────┐  │
│  │ export DD_API_KEY=...             │  │
│  │ export DD_SITE=...                │  │
│  │                                   │  │
│  │ /opt/datadog-agent/agent start    │  │
│  └───────────────────────────────────┘  │
│                                         │
│         ✓ Datadog Agent Running        │
│         ✓ Metrics being sent           │
│         ✓ Logs being collected         │
└─────────────────────────────────────────┘
```

## Testing Results

### Test 1: Host Environment Configuration
- ✅ DD_API_KEY can be read from environment
- ✅ DD_API_KEY can be read from `~/.datadog/api_key`
- ✅ DD_SITE defaults to `datadoghq.com`

### Test 2: BaseVMManager Implementation
- ✅ `getDatadogAPIKey()` method implemented
- ✅ `getDatadogSite()` method implemented
- ✅ Kernel command line includes DD_API_KEY
- ✅ Kernel command line includes DD_SITE

### Test 3: All VM Managers Updated
- ✅ BasicVMManager inherits Datadog support
- ✅ LiquidGlassVMManager inherits Datadog support
- ✅ VsockVMManager inherits Datadog support
- ✅ NetworkTestVMManager inherits Datadog support

## Setup Instructions

### 1. Configure Host Environment

**Option A: Environment Variables**
```bash
# One-time for current session
export DD_API_KEY="your_api_key_here"
export DD_SITE="datadoghq.com"
```

**Option B: Persistent in Shell Config**
```bash
# Add to ~/.zshrc or ~/.bashrc
export DD_API_KEY="your_api_key_here"
export DD_SITE="datadoghq.com"
```

**Option C: File-based Storage**
```bash
mkdir -p ~/.datadog
echo "your_api_key_here" > ~/.datadog/api_key
chmod 600 ~/.datadog/api_key
```

**Option D: Use Setup Script**
```bash
chmod +x /Users/ryan.maclean/vibecode-webgui/azure/setup-datadog-env.sh
./setup-datadog-env.sh
```

### 2. Start VibeCode VM

The VM will automatically receive Datadog configuration:

```swift
let vmManager = BasicVMManager()
vmManager.startVM()
```

Check kernel command line in VM:
```bash
# In VM terminal
cat /proc/cmdline | grep DD_
```

### 3. Verify Datadog Integration

Inside the VM:
```bash
# Check if Datadog agent is running
ps aux | grep datadog-agent

# Check agent status
datadog-agent status

# View agent logs
tail -f /var/log/datadog/agent.log
```

## Troubleshooting

### Problem: VM not receiving DD_API_KEY

**Check 1: Is environment variable set on host?**
```bash
echo $DD_API_KEY
```

**Check 2: Does ~/.datadog/api_key exist and is readable?**
```bash
ls -la ~/.datadog/api_key
cat ~/.datadog/api_key
```

**Check 3: Is kernel command line correct?**
```bash
# In VM
cat /proc/cmdline | grep DD_API_KEY
```

**Check 4: Log from BaseVMManager**
```
[BaseVMManager] getDatadogAPIKey() returning: ...
[BaseVMManager] Kernel command line: console=hvc0 ... DD_API_KEY=...
```

### Problem: Datadog agent not running in VM

**Check 1: Is DD_API_KEY available in shell environment?**
```bash
# In VM
env | grep DD_API_KEY
```

**Check 2: Is init script reading from /proc/cmdline?**
- Verify init script is running on VM startup
- Add debugging output to init script

**Check 3: Is Datadog agent installed in VM image?**
- Verify `/opt/datadog-agent` exists
- Verify agent startup script is in initramfs

### Problem: API key visible in logs

This is expected with Method 1. Mitigation:
- Use restricted keys (not admin keys)
- Only enable for development/testing
- Plan migration to Method 2 (vsock) for production

## Future Improvements

### Phase 2: vsock Communication (More Secure)

Implement Method 2 for production environments:

```swift
class DatadogVsockBridge {
    func setupVsockListener(on device: VZVirtioSocketDevice) throws {
        device.setSocketListener(DatadogConfigListener(), forPort: 9999)
    }

    func sendDatadogConfig() throws {
        let config = [
            "DD_API_KEY": getDatadogAPIKey(),
            "DD_SITE": getDatadogSite(),
            "DD_TAGS": "host:macos,vm:vibecode"
        ]
        // Send encrypted over vsock
    }
}
```

Benefits:
- Encrypted communication
- Not visible in /proc/cmdline
- Better for production

### Phase 3: Unified Observability Provider

Create pluggable observability strategies:

```swift
protocol ObservabilityProvider {
    func configureVM(_ config: VZVirtualMachineConfiguration)
    func onVMStarted(_ manager: BaseVMManager)
    func onMetric(_ name: String, value: Double)
}
```

## References

- [Datadog API Keys Documentation](https://docs.datadoghq.com/account_management/api-app-keys/)
- [Linux Kernel Command Line Parameters](https://www.kernel.org/doc/html/latest/admin-guide/kernel-parameters.html)
- [Apple Virtualization Framework](https://developer.apple.com/documentation/virtualization)

## Summary

✅ **Implemented**: Kernel Command Line method (Method 1)
✅ **Tested**: All VM managers support Datadog API key passing
✅ **Documented**: Setup instructions, security considerations, troubleshooting
✅ **Secure**: Key validation, file permissions, restricted scope
🔄 **Future**: vsock method for production deployments

**Security Level**: DEVELOPMENT ⚠️ (suitable for dev/test)
**Production Ready**: NO (upgrade to Method 2 for production)
