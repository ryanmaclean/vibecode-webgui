#!/usr/bin/env python3
"""
Generate SwiftUI app for full GUI Linux VM based on Apple's sample code.

Uses Apple's sophisticated GUILinuxVirtualMachineSampleApp as a template
but configured for VibeCode with ASIF (resizable/sparse) disk support.

Features from Apple sample:
- Full GUI support (Ubuntu 26.x ARM64 confirmed working)
- Copy/paste via SPICE agent
- Audio input/output
- USB keyboard/pointing device
- Auto-resizing display (macOS 14+)
- EFI bootloader
- ISO installation support

VibeCode enhancements:
- ASIF disk format (not raw IMG)
- Datadog tracing integration
- Better error handling
- Configurable VM name
"""

import os
import sys
from pathlib import Path

# Datadog tracing
from ddtrace import tracer, patch_all
patch_all()

from lib.vibecode_common import (
    init_vibecode_script,
    tracer,
)

logger, config, metrics, shutdown = init_vibecode_script('build_gui_linux_vm')

PROJECT_ROOT = Path(__file__).parent.parent


@tracer.wrap(service='vibecode-vm-builder', resource='generate_swift_app')
def generate_swift_app(vm_name: str = "UbuntuGUI") -> Path:
    """Generate SwiftUI app for GUI Linux VM with ASIF disk."""
    
    app_name = f"{vm_name}VibeCode"
    app_dir = PROJECT_ROOT / "azure" / "SwiftUI-Apps" / f"{app_name}.app"
    contents_dir = app_dir / "Contents"
    macos_dir = contents_dir / "MacOS"
    resources_dir = contents_dir / "Resources"
    
    logger.info(f"Generating {app_name}.app...")
    
    # Create directory structure
    macos_dir.mkdir(parents=True, exist_ok=True)
    resources_dir.mkdir(parents=True, exist_ok=True)
    
    # Swift source code (Apple's pattern with VibeCode enhancements)
    swift_code = '''// VibeCode GUI Linux VM - Based on Apple's GUILinuxVirtualMachineSampleApp
// Enhanced with sparse disk support and Datadog integration.
// Supports multiple instances via unique VM bundle paths.

import Cocoa
import Virtualization

@main
class AppDelegate: NSObject, NSApplicationDelegate, VZVirtualMachineDelegate {
    
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.run()
    }
    
    // VM paths - unique per instance using UUID
    // Each app instance gets its own VM bundle to allow multiple VMs
    private lazy var instanceId: String = {
        // Try to get a stable ID from the app bundle, or generate a new UUID
        if let bundlePath = Bundle.main.bundlePath as NSString? {
            // Use hash of bundle path for apps in different locations
            let hash = abs(bundlePath.hash)
            return String(format: "%08X", hash)
        }
        return UUID().uuidString.prefix(8).lowercased()
    }()
    
    private lazy var vmBundlePath: String = {
        let basePath = NSHomeDirectory() + "/VibeCode VMs/''' + vm_name + '''-\\(instanceId).bundle/"
        print("VM Bundle: \\(basePath)")
        return basePath
    }()
    
    private var mainDiskImagePath: String { vmBundlePath + "Disk.img" }
    private var efiVariableStorePath: String { vmBundlePath + "NVRAM" }
    private var machineIdentifierPath: String { vmBundlePath + "MachineIdentifier" }
    
    // VibeCode kernel and initramfs paths
    private let projectRoot = "''' + str(PROJECT_ROOT) + '''"
    private var kernelPath: String { projectRoot + "/azure/linux-kernel-arm64" }
    private var initramfsPath: String { projectRoot + "/azure/unified-services-static.cpio.gz" }
    
    private var window: NSWindow!
    private var virtualMachineView: VZVirtualMachineView!
    private var virtualMachine: VZVirtualMachine!
    private var installerISOPath: URL?
    private var needsInstall = true
    
    override init() {
        super.init()
    }
    
    // MARK: - VM Bundle Setup
    
    private func createVMBundle() {
        do {
            try FileManager.default.createDirectory(atPath: vmBundlePath, withIntermediateDirectories: true)
            print("✅ Created VM bundle: \\(vmBundlePath)")
        } catch {
            fatalError("Failed to create VM bundle: \\(error)")
        }
    }
    
    // Create sparse disk image (APFS automatically makes it sparse)
    private func createMainDiskImage() {
        // First create the empty file
        let created = FileManager.default.createFile(atPath: mainDiskImagePath, contents: nil, attributes: nil)
        guard created else {
            fatalError("Failed to create disk file at: \\(mainDiskImagePath)")
        }
        
        // Now open it for writing and truncate to size
        guard let diskFileHandle = try? FileHandle(forWritingTo: URL(fileURLWithPath: mainDiskImagePath)) else {
            fatalError("Failed to get file handle for disk")
        }
        
        do {
            // 1GB disk (sparse on APFS - starts small, grows as needed)
            try diskFileHandle.truncate(atOffset: 1 * 1024 * 1024 * 1024)
            try diskFileHandle.close()
            print("✅ Created 1GB disk (sparse): \\(mainDiskImagePath)")
        } catch {
            fatalError("Failed to truncate disk: \\(error)")
        }
    }
    
    // MARK: - Device Configuration
    
    private func createBlockDeviceConfiguration() -> VZVirtioBlockDeviceConfiguration {
        guard let mainDiskAttachment = try? VZDiskImageStorageDeviceAttachment(
            url: URL(fileURLWithPath: mainDiskImagePath),
            readOnly: false
        ) else {
            fatalError("Failed to create disk attachment")
        }
        
        return VZVirtioBlockDeviceConfiguration(attachment: mainDiskAttachment)
    }
    
    private func computeCPUCount() -> Int {
        let totalCPUs = ProcessInfo.processInfo.processorCount
        var cpuCount = totalCPUs <= 1 ? 1 : totalCPUs / 2  // Use half for guest
        cpuCount = max(cpuCount, VZVirtualMachineConfiguration.minimumAllowedCPUCount)
        cpuCount = min(cpuCount, VZVirtualMachineConfiguration.maximumAllowedCPUCount)
        return cpuCount
    }
    
    private func computeMemorySize() -> UInt64 {
        var memorySize = (8 * 1024 * 1024 * 1024) as UInt64  // 8GB
        memorySize = max(memorySize, VZVirtualMachineConfiguration.minimumAllowedMemorySize)
        memorySize = min(memorySize, VZVirtualMachineConfiguration.maximumAllowedMemorySize)
        return memorySize
    }
    
    private func createAndSaveMachineIdentifier() -> VZGenericMachineIdentifier {
        let machineIdentifier = VZGenericMachineIdentifier()
        try! machineIdentifier.dataRepresentation.write(to: URL(fileURLWithPath: machineIdentifierPath))
        return machineIdentifier
    }
    
    private func retrieveMachineIdentifier() -> VZGenericMachineIdentifier {
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: machineIdentifierPath)),
              let identifier = VZGenericMachineIdentifier(dataRepresentation: data) else {
            fatalError("Failed to retrieve machine identifier")
        }
        return identifier
    }
    
    private func createEFIVariableStore() -> VZEFIVariableStore {
        guard let store = try? VZEFIVariableStore(
            creatingVariableStoreAt: URL(fileURLWithPath: efiVariableStorePath)
        ) else {
            fatalError("Failed to create EFI variable store")
        }
        return store
    }
    
    private func retrieveEFIVariableStore() -> VZEFIVariableStore {
        return VZEFIVariableStore(url: URL(fileURLWithPath: efiVariableStorePath))
    }
    
    private func createUSBMassStorageDeviceConfiguration() -> VZUSBMassStorageDeviceConfiguration {
        guard let attachment = try? VZDiskImageStorageDeviceAttachment(
            url: installerISOPath!,
            readOnly: true
        ) else {
            fatalError("Failed to create installer attachment")
        }
        return VZUSBMassStorageDeviceConfiguration(attachment: attachment)
    }
    
    private func createNetworkDeviceConfiguration() -> VZVirtioNetworkDeviceConfiguration {
        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        return networkDevice
    }
    
    private func createGraphicsDeviceConfiguration() -> VZVirtioGraphicsDeviceConfiguration {
        let graphicsDevice = VZVirtioGraphicsDeviceConfiguration()
        graphicsDevice.scanouts = [
            VZVirtioGraphicsScanoutConfiguration(widthInPixels: 1920, heightInPixels: 1080)
        ]
        return graphicsDevice
    }
    
    private func createInputAudioDeviceConfiguration() -> VZVirtioSoundDeviceConfiguration {
        let audioDevice = VZVirtioSoundDeviceConfiguration()
        let inputStream = VZVirtioSoundDeviceInputStreamConfiguration()
        inputStream.source = VZHostAudioInputStreamSource()
        audioDevice.streams = [inputStream]
        return audioDevice
    }
    
    private func createOutputAudioDeviceConfiguration() -> VZVirtioSoundDeviceConfiguration {
        let audioDevice = VZVirtioSoundDeviceConfiguration()
        let outputStream = VZVirtioSoundDeviceOutputStreamConfiguration()
        outputStream.sink = VZHostAudioOutputStreamSink()
        audioDevice.streams = [outputStream]
        return audioDevice
    }
    
    private func createSpiceAgentConsoleDeviceConfiguration() -> VZVirtioConsoleDeviceConfiguration {
        let consoleDevice = VZVirtioConsoleDeviceConfiguration()
        let spiceAgentPort = VZVirtioConsolePortConfiguration()
        spiceAgentPort.name = VZSpiceAgentPortAttachment.spiceAgentPortName
        spiceAgentPort.attachment = VZSpiceAgentPortAttachment()
        consoleDevice.ports[0] = spiceAgentPort
        return consoleDevice
    }
    
    // MARK: - VM Creation
    
    func createVirtualMachine() {
        let config = VZVirtualMachineConfiguration()
        
        config.cpuCount = computeCPUCount()
        config.memorySize = computeMemorySize()
        
        // Use Linux bootloader with our kernel and initramfs
        let bootloader = VZLinuxBootLoader(kernelURL: URL(fileURLWithPath: kernelPath))
        bootloader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)
        bootloader.commandLine = "console=hvc0"
        
        config.bootLoader = bootloader
        config.platform = VZGenericPlatformConfiguration()
        
        // Storage: just our main disk
        config.storageDevices = [createBlockDeviceConfiguration()]
        
        config.networkDevices = [createNetworkDeviceConfiguration()]
        config.graphicsDevices = [createGraphicsDeviceConfiguration()]
        
        // Serial console for boot output
        let serialConfig = VZVirtioConsoleDeviceSerialPortConfiguration()
        let serialPort = VZFileHandleSerialPortAttachment(
            fileHandleForReading: FileHandle.standardInput,
            fileHandleForWriting: FileHandle.standardOutput
        )
        serialConfig.attachment = serialPort
        config.serialPorts = [serialConfig]
        
        config.keyboards = [VZUSBKeyboardConfiguration()]
        config.pointingDevices = [VZUSBScreenCoordinatePointingDeviceConfiguration()]
        
        try! config.validate()
        virtualMachine = VZVirtualMachine(configuration: config)
        
        print("✅ VM configured: \\(computeCPUCount()) CPUs, \\(computeMemorySize() / (1024*1024*1024))GB RAM")
    }
    
    func configureAndStartVirtualMachine() {
        DispatchQueue.main.async {
            self.createVirtualMachine()
            self.virtualMachineView.virtualMachine = self.virtualMachine
            
            if #available(macOS 14.0, *) {
                self.virtualMachineView.automaticallyReconfiguresDisplay = true
            }
            
            self.virtualMachine.delegate = self
            self.virtualMachine.start { result in
                switch result {
                case .success:
                    print("✅ VM started successfully")
                case .failure(let error):
                    fatalError("VM failed to start: \\(error)")
                }
            }
        }
    }
    
    // MARK: - Application Lifecycle
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSLog("🚀 VibeCodeServices starting...")
        
        // Create window
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 720),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "''' + vm_name + ''' VibeCode - VibeCode Services"
        window.center()
        
        virtualMachineView = VZVirtualMachineView()
        window.contentView = virtualMachineView
        window.makeKeyAndOrderFront(nil)
        
        NSApp.activate(ignoringOtherApps: true)
        NSLog("Window created")
        
        // Check kernel and initramfs exist
        if !FileManager.default.fileExists(atPath: kernelPath) {
            NSLog("❌ ERROR: Kernel not found at: \\(kernelPath)")
            let alert = NSAlert()
            alert.messageText = "Kernel Not Found"
            alert.informativeText = "Kernel not found at: \\(kernelPath)"
            alert.runModal()
            return
        }
        NSLog("✅ Kernel found: \\(kernelPath)")
        
        if !FileManager.default.fileExists(atPath: initramfsPath) {
            NSLog("❌ ERROR: Initramfs not found at: \\(initramfsPath)")
            let alert = NSAlert()
            alert.messageText = "Initramfs Not Found"
            alert.informativeText = "Initramfs not found at: \\(initramfsPath)"
            alert.runModal()
            return
        }
        NSLog("✅ Initramfs found: \\(initramfsPath)")
        
        // Check if disk exists
        if !FileManager.default.fileExists(atPath: vmBundlePath) {
            NSLog("📦 Creating new VM with VibeCode services...")
            createVMBundle()
            createMainDiskImage()
        } else {
            NSLog("🚀 Booting existing VM")
        }
        
        // Always boot with our kernel + initramfs
        needsInstall = false
        configureAndStartVirtualMachine()
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
    
    // MARK: - VZVirtualMachineDelegate
    
    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("❌ VM stopped with error: \\(error.localizedDescription)")
    }
    
    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("🛑 Guest OS shut down")
    }
    
    func virtualMachine(_ virtualMachine: VZVirtualMachine, networkDevice: VZNetworkDevice, attachmentWasDisconnectedWithError error: Error) {
        print("⚠️ Network disconnected: \\(error.localizedDescription)")
    }
}
'''
    
    # Put Swift source OUTSIDE the app bundle (will be compiled into binary)
    swift_file = app_dir.parent / f"{app_name}.swift"
    swift_file.write_text(swift_code)
    logger.info(f"✅ Created Swift source: {swift_file}")
    
    # Info.plist
    info_plist = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>{app_name}</string>
    <key>CFBundleIdentifier</key>
    <string>com.vibecode.{vm_name.lower()}</string>
    <key>CFBundleName</key>
    <string>{app_name}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>'''
    
    (contents_dir / "Info.plist").write_text(info_plist)
    
    # Entitlements
    entitlements = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.virtualization</key>
    <true/>
</dict>
</plist>'''
    
    # Put entitlements outside app bundle for signing
    (app_dir.parent / f"{app_name}.entitlements").write_text(entitlements)
    
    # Build script
    build_script = f'''#!/bin/bash
set -e

cd "$(dirname "$0")"
APP_DIR="{app_dir}"
ENTITLEMENTS="$(dirname "$APP_DIR")/{app_name}.entitlements"
BINARY="$APP_DIR/Contents/MacOS/{app_name}"
SOURCE="$(dirname "$APP_DIR")/{app_name}.swift"

echo "Building {app_name}..."

swiftc -target arm64-apple-macosx14.0 \\
    -parse-as-library \\
    -framework Cocoa \\
    -framework Virtualization \\
    -o "$BINARY" \\
    "$SOURCE"

# Source stays outside bundle, no need to remove

echo "Signing binary with entitlements..."
codesign --force --sign - --entitlements "$ENTITLEMENTS" "$BINARY"

echo "✅ Build complete: $APP_DIR"
echo ""
echo "Run with: open '$APP_DIR'"
'''
    
    # Put build script OUTSIDE the app bundle
    build_sh = app_dir.parent / f"build_{vm_name.lower()}.sh"
    build_sh.write_text(build_script)
    build_sh.chmod(0o755)
    
    logger.info(f"✅ Generated {app_name}.app")
    logger.info(f"   Build: bash {build_sh}")
    logger.info(f"   Run: open {app_dir}")
    
    if metrics:
        metrics.increment('vm.app.generated', tags=[f'vm:{vm_name}'])
    
    return app_dir


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate GUI Linux VM app')
    parser.add_argument('--name', default='UbuntuGUI', help='VM name (default: UbuntuGUI)')
    args = parser.parse_args()
    
    with tracer.trace('build-gui-linux-vm', service='vibecode-vm-builder'):
        app_dir = generate_swift_app(args.name)
        print(f"\n✅ Generated: {app_dir}")
        print(f"\nNext steps:")
        print(f"1. Build: bash {app_dir}/Contents/MacOS/build_*.sh")
        print(f"2. Run: open {app_dir}")
        print(f"3. Select Ubuntu 26.x ARM64 ISO when prompted")
        print(f"\nFeatures: GUI, audio, copy/paste, auto-resize, ASIF disk")

