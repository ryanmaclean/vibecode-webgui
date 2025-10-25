# macOS Native VM - Integration Guide

## Overview

This guide provides detailed instructions for integrating the VibeCode macOS Native VM into various applications and workflows.

## Table of Contents

- [Command-Line Integration](#command-line-integration)
- [Tauri Application Integration](#tauri-application-integration)
- [LaunchAgent Service](#launchagent-service)
- [Menu Bar Application](#menu-bar-application)
- [Programmatic Control](#programmatic-control)
- [Docker Desktop Migration](#docker-desktop-migration)
- [Monitoring and Observability](#monitoring-and-observability)

## Command-Line Integration

### Basic Usage

```bash
# Start VM directly
./bin/vibecode-vm

# Start in background
./bin/vibecode-vm > ~/.vibecode/vm/vm.log 2>&1 &
VM_PID=$!

# Stop VM
kill $VM_PID
```

### Wrapper Script

Create a convenience script:

```bash
#!/bin/bash
# vibecode

COMMAND="${1:-start}"
VM_DIR="$HOME/.vibecode/vm"
PID_FILE="$VM_DIR/vibecode-vm.pid"

case "$COMMAND" in
    start)
        if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
            echo "VibeCode VM is already running (PID: $(cat "$PID_FILE"))"
            exit 0
        fi
        
        ./bin/vibecode-vm > "$VM_DIR/vm.log" 2>&1 &
        echo $! > "$PID_FILE"
        echo "VibeCode VM started (PID: $(cat "$PID_FILE"))"
        echo "Code-server available at: http://localhost:8080"
        ;;
    
    stop)
        if [ ! -f "$PID_FILE" ]; then
            echo "VibeCode VM is not running"
            exit 1
        fi
        
        PID=$(cat "$PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            rm "$PID_FILE"
            echo "VibeCode VM stopped"
        else
            rm "$PID_FILE"
            echo "VibeCode VM was not running"
        fi
        ;;
    
    status)
        if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
            echo "VibeCode VM is running (PID: $(cat "$PID_FILE"))"
            echo "Code-server: http://localhost:8080"
        else
            echo "VibeCode VM is not running"
            exit 1
        fi
        ;;
    
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    
    logs)
        tail -f "$VM_DIR/vm.log"
        ;;
    
    *)
        echo "Usage: $0 {start|stop|status|restart|logs}"
        exit 1
        ;;
esac
```

## Tauri Application Integration

### Integration Architecture

```
┌─────────────────────────────────────┐
│      Tauri Desktop Application      │
│  ┌───────────────────────────────┐  │
│  │      Frontend (React/Vue)     │  │
│  │  - VM status display          │  │
│  │  - Start/stop controls        │  │
│  │  - Settings panel             │  │
│  └──────────────┬────────────────┘  │
│                 │                    │
│  ┌──────────────▼────────────────┐  │
│  │      Tauri Backend (Rust)     │  │
│  │  - Command handlers           │  │
│  │  - Process management         │  │
│  │  - Event system               │  │
│  └──────────────┬────────────────┘  │
└─────────────────┼────────────────────┘
                  │
      ┌───────────▼───────────┐
      │  VMManager (Swift)    │
      │  - Subprocess wrapper │
      │  - Status monitoring  │
      └───────────┬───────────┘
                  │
      ┌───────────▼───────────┐
      │   vibecode-vm binary  │
      │   (Virtualization.fw) │
      └───────────────────────┘
```

### Rust Backend Implementation

Create `src-tauri/src/vm_manager.rs`:

```rust
use std::process::{Command, Child, Stdio};
use std::sync::{Arc, Mutex};
use tauri::State;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VMStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub uptime: Option<u64>,
    pub code_server_url: String,
}

pub struct VMManager {
    process: Arc<Mutex<Option<Child>>>,
    binary_path: String,
}

impl VMManager {
    pub fn new(binary_path: String) -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            binary_path,
        }
    }
    
    pub fn start(&self) -> Result<u32, String> {
        let mut process_guard = self.process.lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        
        if let Some(child) = &*process_guard {
            if let Some(pid) = child.id() {
                return Ok(pid);
            }
        }
        
        let child = Command::new(&self.binary_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start VM: {}", e))?;
        
        let pid = child.id();
        *process_guard = Some(child);
        
        Ok(pid)
    }
    
    pub fn stop(&self) -> Result<(), String> {
        let mut process_guard = self.process.lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        
        if let Some(mut child) = process_guard.take() {
            child.kill()
                .map_err(|e| format!("Failed to stop VM: {}", e))?;
            child.wait()
                .map_err(|e| format!("Failed to wait for VM: {}", e))?;
            Ok(())
        } else {
            Err("VM is not running".to_string())
        }
    }
    
    pub fn status(&self) -> VMStatus {
        let process_guard = self.process.lock().unwrap();
        
        if let Some(child) = &*process_guard {
            VMStatus {
                running: true,
                pid: Some(child.id()),
                uptime: None, // TODO: Calculate from start time
                code_server_url: "http://localhost:8080".to_string(),
            }
        } else {
            VMStatus {
                running: false,
                pid: None,
                uptime: None,
                code_server_url: "http://localhost:8080".to_string(),
            }
        }
    }
}
```

### Tauri Commands

Add to `src-tauri/src/main.rs`:

```rust
mod vm_manager;
use vm_manager::{VMManager, VMStatus};

#[tauri::command]
fn start_vm(state: State<VMManager>) -> Result<u32, String> {
    state.start()
}

#[tauri::command]
fn stop_vm(state: State<VMManager>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
fn vm_status(state: State<VMManager>) -> VMStatus {
    state.status()
}

fn main() {
    let vm_binary_path = std::env::current_dir()
        .unwrap()
        .join("bin/vibecode-vm")
        .to_string_lossy()
        .to_string();
    
    tauri::Builder::default()
        .manage(VMManager::new(vm_binary_path))
        .invoke_handler(tauri::generate_handler![
            start_vm,
            stop_vm,
            vm_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Frontend Integration (React)

```typescript
// src/components/VMControl.tsx
import { invoke } from '@tauri-apps/api/tauri';
import { useState, useEffect } from 'react';

interface VMStatus {
  running: boolean;
  pid?: number;
  code_server_url: string;
}

export function VMControl() {
  const [status, setStatus] = useState<VMStatus>({
    running: false,
    code_server_url: 'http://localhost:8080'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async () => {
    try {
      const vmStatus = await invoke<VMStatus>('vm_status');
      setStatus(vmStatus);
    } catch (error) {
      console.error('Failed to get VM status:', error);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      await invoke('start_vm');
      await updateStatus();
    } catch (error) {
      console.error('Failed to start VM:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await invoke('stop_vm');
      await updateStatus();
    } catch (error) {
      console.error('Failed to stop VM:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCodeServer = () => {
    window.open(status.code_server_url, '_blank');
  };

  return (
    <div className="vm-control">
      <h2>VibeCode VM</h2>
      
      <div className="status">
        <span className={status.running ? 'status-running' : 'status-stopped'}>
          {status.running ? '● Running' : '○ Stopped'}
        </span>
        {status.pid && <span>PID: {status.pid}</span>}
      </div>

      <div className="controls">
        {!status.running ? (
          <button onClick={handleStart} disabled={loading}>
            Start VM
          </button>
        ) : (
          <>
            <button onClick={handleStop} disabled={loading}>
              Stop VM
            </button>
            <button onClick={openCodeServer}>
              Open Code-Server
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

## LaunchAgent Service

### Installation

```bash
# Automatic installation
./scripts/macos-vm/install.sh

# Manual installation
cat > ~/Library/LaunchAgents/com.vibecode.vm.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibecode.vm</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/bin/vibecode-vm</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/yourusername/.vibecode/vm/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/yourusername/.vibecode/vm/stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOF

# Load service
launchctl load ~/Library/LaunchAgents/com.vibecode.vm.plist
```

### Service Management

```bash
# Start service
launchctl start com.vibecode.vm

# Stop service
launchctl stop com.vibecode.vm

# Check status
launchctl list | grep vibecode

# View logs
tail -f ~/.vibecode/vm/stdout.log
tail -f ~/.vibecode/vm/stderr.log

# Unload service
launchctl unload ~/Library/LaunchAgents/com.vibecode.vm.plist
```

## Menu Bar Application

### SwiftUI Menu Bar App

Create a minimal menu bar application:

```swift
import SwiftUI
import Cocoa

@main
struct VibeCodeMenuBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem?
    var vmProcess: Process?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create menu bar item
        statusItem = NSStatusBar.system.statusItem(
            withLength: NSStatusItem.variableLength
        )
        
        if let button = statusItem?.button {
            button.image = NSImage(
                systemSymbolName: "bolt.circle",
                accessibilityDescription: "VibeCode VM"
            )
        }
        
        setupMenu()
    }
    
    func setupMenu() {
        let menu = NSMenu()
        
        // Status item
        let statusItem = NSMenuItem(
            title: isVMRunning() ? "VM Running" : "VM Stopped",
            action: nil,
            keyEquivalent: ""
        )
        statusItem.isEnabled = false
        menu.addItem(statusItem)
        
        menu.addItem(NSMenuItem.separator())
        
        // Start/Stop
        if isVMRunning() {
            menu.addItem(NSMenuItem(
                title: "Stop VM",
                action: #selector(stopVM),
                keyEquivalent: ""
            ))
            menu.addItem(NSMenuItem(
                title: "Open Code-Server",
                action: #selector(openCodeServer),
                keyEquivalent: ""
            ))
        } else {
            menu.addItem(NSMenuItem(
                title: "Start VM",
                action: #selector(startVM),
                keyEquivalent: ""
            ))
        }
        
        menu.addItem(NSMenuItem.separator())
        
        // Quit
        menu.addItem(NSMenuItem(
            title: "Quit",
            action: #selector(quit),
            keyEquivalent: "q"
        ))
        
        statusItem?.menu = menu
    }
    
    @objc func startVM() {
        let vmBinary = Bundle.main.bundleURL
            .deletingLastPathComponent()
            .appendingPathComponent("bin/vibecode-vm")
        
        vmProcess = Process()
        vmProcess?.executableURL = vmBinary
        
        try? vmProcess?.run()
        setupMenu()
    }
    
    @objc func stopVM() {
        vmProcess?.terminate()
        vmProcess = nil
        setupMenu()
    }
    
    @objc func openCodeServer() {
        NSWorkspace.shared.open(URL(string: "http://localhost:8080")!)
    }
    
    @objc func quit() {
        stopVM()
        NSApplication.shared.terminate(nil)
    }
    
    func isVMRunning() -> Bool {
        vmProcess?.isRunning ?? false
    }
}
```

## Docker Desktop Migration

### Migration Script

```bash
#!/bin/bash
# migrate-from-docker.sh

echo "🚀 Migrating from Docker Desktop to VibeCode Native VM"
echo ""

# 1. Export Docker volumes (if needed)
echo "📦 Exporting Docker volumes..."
docker volume ls -q | while read volume; do
    echo "  Exporting $volume..."
    docker run --rm -v "$volume:/data" -v "$PWD:/backup" \
        alpine tar czf "/backup/${volume}.tar.gz" /data
done

# 2. Stop Docker Desktop
echo "🛑 Stopping Docker Desktop..."
osascript -e 'quit app "Docker"'
sleep 5

# 3. Install VibeCode VM
echo "⚙️  Installing VibeCode VM..."
./scripts/macos-vm/install.sh

# 4. Start VibeCode VM
echo "🚀 Starting VibeCode VM..."
./bin/vibecode-vm &
VM_PID=$!
sleep 5

# 5. Verify VM is running
if kill -0 $VM_PID 2>/dev/null; then
    echo "✅ VibeCode VM is running!"
    echo "📍 Code-server: http://localhost:8080"
else
    echo "❌ Failed to start VM"
    exit 1
fi

echo ""
echo "✅ Migration complete!"
echo ""
echo "Next steps:"
echo "  1. Access code-server: http://localhost:8080"
echo "  2. Import Docker volumes if needed"
echo "  3. Optional: Uninstall Docker Desktop"
```

### Performance Comparison

```bash
#!/bin/bash
# compare-performance.sh

echo "📊 Performance Comparison: Docker Desktop vs VibeCode VM"
echo ""

# Docker Desktop
echo "Testing Docker Desktop..."
osascript -e 'quit app "Docker"'
sleep 5

DOCKER_START=$(date +%s.%N)
open -a Docker
# Wait for Docker to be ready
while ! docker info &>/dev/null; do
    sleep 1
done
DOCKER_END=$(date +%s.%N)
DOCKER_BOOT=$(echo "$DOCKER_END - $DOCKER_START" | bc)

DOCKER_MEM=$(ps aux | grep -i docker | awk '{sum+=$6} END {print sum/1024}')

# VibeCode VM
echo "Testing VibeCode VM..."
osascript -e 'quit app "Docker"'
sleep 5

VIBECODE_START=$(date +%s.%N)
./bin/vibecode-vm > /tmp/vm.log 2>&1 &
VM_PID=$!

while ! grep -q "VM started successfully" /tmp/vm.log; do
    sleep 0.1
done
VIBECODE_END=$(date +%s.%N)
VIBECODE_BOOT=$(echo "$VIBECODE_END - $VIBECODE_START" | bc)

VIBECODE_MEM=$(ps -o rss= -p $VM_PID | awk '{print $1/1024}')

kill $VM_PID

# Results
echo ""
echo "Results:"
echo "--------"
printf "Boot Time:\n"
printf "  Docker Desktop: %.2fs\n" $DOCKER_BOOT
printf "  VibeCode VM:    %.2fs\n" $VIBECODE_BOOT
printf "  Improvement:    %.1fx faster\n" $(echo "$DOCKER_BOOT / $VIBECODE_BOOT" | bc -l)
echo ""
printf "Memory Usage:\n"
printf "  Docker Desktop: %.0f MB\n" $DOCKER_MEM
printf "  VibeCode VM:    %.0f MB\n" $VIBECODE_MEM
printf "  Savings:        %.0f MB (%.0f%%)\n" \
    $(echo "$DOCKER_MEM - $VIBECODE_MEM" | bc) \
    $(echo "($DOCKER_MEM - $VIBECODE_MEM) / $DOCKER_MEM * 100" | bc)
```

## Monitoring and Observability

### Prometheus Metrics Export

Extend the VM to export Prometheus metrics:

```swift
// Add to VMManager
import Network

class MetricsServer {
    private let listener: NWListener?
    
    init(port: UInt16 = 9090) {
        listener = try? NWListener(using: .tcp, on: NWEndpoint.Port(integerLiteral: port))
        listener?.newConnectionHandler = handleConnection
        listener?.start(queue: .main)
    }
    
    private func handleConnection(_ connection: NWConnection) {
        connection.start(queue: .main)
        
        let metrics = """
        # HELP vibecode_vm_boot_time_seconds VM boot time
        # TYPE vibecode_vm_boot_time_seconds gauge
        vibecode_vm_boot_time_seconds \(getBootTime())
        
        # HELP vibecode_vm_memory_bytes VM memory usage
        # TYPE vibecode_vm_memory_bytes gauge
        vibecode_vm_memory_bytes \(getMemoryUsage())
        
        # HELP vibecode_vm_uptime_seconds VM uptime
        # TYPE vibecode_vm_uptime_seconds counter
        vibecode_vm_uptime_seconds \(getUptime())
        """
        
        let response = """
        HTTP/1.1 200 OK\r
        Content-Type: text/plain\r
        Content-Length: \(metrics.count)\r
        \r
        \(metrics)
        """
        
        connection.send(
            content: response.data(using: .utf8),
            completion: .contentProcessed { _ in
                connection.cancel()
            }
        )
    }
}
```

### Datadog Integration

```bash
# Add Datadog custom metrics
cat > ~/.vibecode/vm/datadog-agent-config.yaml << 'EOF'
logs:
  - type: file
    path: /Users/*/.vibecode/vm/stdout.log
    service: vibecode-vm
    source: vibecode
    tags:
      - env:local
      - platform:macos

metrics:
  - type: gauge
    name: vibecode.vm.boot_time
    value: 1.8
    tags:
      - platform:macos
      - hypervisor:virtualization.framework
EOF
```

## Best Practices

1. **Process Management**: Always use proper process lifecycle management
2. **Error Handling**: Catch and handle VM startup failures gracefully
3. **User Feedback**: Provide clear status indicators in UI
4. **Resource Cleanup**: Ensure VM is stopped when app quits
5. **Logging**: Maintain separate logs for debugging
6. **Configuration**: Allow users to customize VM resources
7. **Updates**: Check for VM binary updates periodically

## Troubleshooting

### VM Won't Start in Tauri App

```bash
# Check binary permissions
chmod +x bin/vibecode-vm

# Verify path in Tauri app
ls -l "$(pwd)/bin/vibecode-vm"

# Check Tauri console for errors
# Enable console in tauri.conf.json
```

### Menu Bar App Issues

```bash
# Ensure binary is in app bundle
# Resources/bin/vibecode-vm

# Check entitlements
codesign -d --entitlements - VibeCode.app
```

## Related Documentation

- [API Reference](API.md)
- [Benchmarking Guide](BENCHMARKING.md)
- [User Guide](README.md)

## License

MIT - See root LICENSE file
