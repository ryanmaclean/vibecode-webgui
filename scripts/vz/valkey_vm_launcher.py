#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Valkey VM Launcher - Using Swift with proper entitlements.

This compiles and runs the Swift code with virtualization entitlements.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional


# Package.swift template
PACKAGE_SWIFT = """\
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ValkeyVM",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "ValkeyVM",
            path: "Sources"
        )
    ]
)
"""

# Swift source template
MAIN_SWIFT = """\
import Foundation
import Virtualization

class ValkeyVM: NSObject, VZVirtualMachineDelegate {
    private var virtualMachine: VZVirtualMachine?
    private let vmDirectory: URL
    private var consoleLog: FileHandle?

    var isRunning: Bool = false

    init(vmDirectory: URL? = nil) {
        let vmDir = vmDirectory ?? URL(fileURLWithPath: NSString(string: "~/.vfkit/vms/valkey-vz").expandingTildeInPath)
        self.vmDirectory = vmDir

        let logDir = vmDir.appendingPathComponent("logs")
        try? FileManager.default.createDirectory(at: logDir, withIntermediateDirectories: true)
        let logFile = logDir.appendingPathComponent("console.log")
        FileManager.default.createFile(atPath: logFile.path, contents: nil)
        self.consoleLog = try? FileHandle(forWritingTo: logFile)

        super.init()
    }

    deinit {
        try? consoleLog?.close()
    }

    func createConfiguration() throws -> VZVirtualMachineConfiguration {
        let config = VZVirtualMachineConfiguration()

        config.cpuCount = 2
        config.memorySize = 1 * 1024 * 1024 * 1024

        let kernelPath = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel/vmlinuz").expandingTildeInPath
        let initramfsPath = NSString(string: "~/.vfkit/vms/vibecode-alpine/kernel/initramfs").expandingTildeInPath

        guard FileManager.default.fileExists(atPath: kernelPath) else {
            throw NSError(domain: "ValkeyVM", code: 1, userInfo: [NSLocalizedDescriptionKey: "Kernel not found"])
        }
        guard FileManager.default.fileExists(atPath: initramfsPath) else {
            throw NSError(domain: "ValkeyVM", code: 2, userInfo: [NSLocalizedDescriptionKey: "Initramfs not found"])
        }

        let bootloader = VZLinuxBootLoader(kernelURL: URL(fileURLWithPath: kernelPath))
        bootloader.initialRamdiskURL = URL(fileURLWithPath: initramfsPath)
        bootloader.commandLine = "console=hvc0 root=/dev/vda rw"
        config.bootLoader = bootloader

        let diskPath = vmDirectory.appendingPathComponent("disk/root.img").path
        guard FileManager.default.fileExists(atPath: diskPath) else {
            throw NSError(domain: "ValkeyVM", code: 3, userInfo: [NSLocalizedDescriptionKey: "Disk not found"])
        }

        let diskURL = URL(fileURLWithPath: diskPath)
        let diskAttachment = try VZDiskImageStorageDeviceAttachment(url: diskURL, readOnly: false)
        let disk = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
        config.storageDevices = [disk]

        let networkDevice = VZVirtioNetworkDeviceConfiguration()
        networkDevice.attachment = VZNATNetworkDeviceAttachment()
        config.networkDevices = [networkDevice]

        let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
        let outputPipe = Pipe()
        outputPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if !data.isEmpty {
                if let line = String(data: data, encoding: .utf8) {
                    print(line, terminator: "")
                }
                try? self?.consoleLog?.write(contentsOf: data)
            }
        }

        let inputPipe = Pipe()
        serialPort.attachment = VZFileHandleSerialPortAttachment(
            fileHandleForReading: inputPipe.fileHandleForReading,
            fileHandleForWriting: outputPipe.fileHandleForWriting
        )
        config.serialPorts = [serialPort]

        config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

        try config.validate()
        return config
    }

    func start() async throws {
        guard !isRunning else { return }

        print("Creating VM configuration...")
        let config = try createConfiguration()

        print("Creating virtual machine...")
        let vm = VZVirtualMachine(configuration: config)
        vm.delegate = self
        self.virtualMachine = vm

        print("Starting VM...")
        try await vm.start()

        isRunning = true
        print("VM started successfully!")
    }

    func stop() async throws {
        guard let vm = virtualMachine, isRunning else { return }

        print("Stopping VM...")
        try await vm.stop()

        isRunning = false
        print("VM stopped")
    }

    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("\\n=== Guest OS shut down ===")
        isRunning = false
    }

    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("\\n=== VM stopped with error: \\(error) ===")
        isRunning = false
    }
}

@main
struct ValkeyVMRunner {
    static func main() async {
        print("===========================================")
        print("Valkey VM - Virtualization Framework")
        print("===========================================")
        print("")

        let vm = ValkeyVM()

        do {
            try await vm.start()

            print("")
            print("VM is running! Console output above.")
            print("Log: ~/.vfkit/vms/valkey-vz/logs/console.log")
            print("")
            print("Press Ctrl+C to stop (or will auto-stop in 5 min)")
            print("")

            try await Task.sleep(for: .seconds(300))

            try await vm.stop()
            print("Test complete")

        } catch {
            print("Error: \\(error)")
            exit(1)
        }
    }
}
"""

# Entitlements plist
ENTITLEMENTS_PLIST = """\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.virtualization</key>
    <true/>
</dict>
</plist>
"""


def get_project_root() -> Path:
    """Get the project root directory."""
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent.parent


def get_build_dir() -> Path:
    """Get the build directory for Valkey VM."""
    return get_project_root() / ".build" / "vz"


def create_swift_project(build_dir: Path) -> bool:
    """Create the Swift package project.

    Returns:
        True if successful, False otherwise.
    """
    build_dir.mkdir(parents=True, exist_ok=True)

    # Write Package.swift
    package_file = build_dir / "Package.swift"
    package_file.write_text(PACKAGE_SWIFT)

    # Create Sources directory and write main.swift
    sources_dir = build_dir / "Sources"
    sources_dir.mkdir(exist_ok=True)

    main_file = sources_dir / "main.swift"
    main_file.write_text(MAIN_SWIFT)

    return True


def build_valkey_vm(build_dir: Path) -> bool:
    """Build the Valkey VM executable.

    Returns:
        True if build successful, False otherwise.
    """
    print("Building ValkeyVM...")

    try:
        result = subprocess.run(
            ["swift", "build", "-c", "release"],
            cwd=build_dir,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )

        # Filter out warnings
        if result.stdout:
            for line in result.stdout.split("\n"):
                if "warning:" not in line:
                    print(line)

        binary = build_dir / ".build" / "release" / "ValkeyVM"
        if not binary.exists():
            print("Build failed")
            if result.stderr:
                print(result.stderr)
            return False

        print("Build complete")
        return True

    except subprocess.TimeoutExpired:
        print("Build timed out")
        return False
    except FileNotFoundError:
        print("swift command not found")
        return False


def sign_with_entitlements(build_dir: Path) -> bool:
    """Sign the binary with virtualization entitlements.

    Returns:
        True if signing successful, False otherwise.
    """
    print("Signing with virtualization entitlement...")

    # Write entitlements file
    entitlements_file = build_dir / "entitlements.plist"
    entitlements_file.write_text(ENTITLEMENTS_PLIST)

    binary = build_dir / ".build" / "release" / "ValkeyVM"

    try:
        result = subprocess.run(
            [
                "codesign",
                "--entitlements", str(entitlements_file),
                "-f",
                "-s", "-",
                str(binary),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            print("Signing failed")
            if result.stderr:
                print(result.stderr)
            return False

        print("Signed with entitlements")
        return True

    except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
        print(f"Signing failed: {e}")
        return False


def launch_valkey_vm(build_dir: Path) -> int:
    """Launch the Valkey VM.

    Returns:
        Exit code from VM process.
    """
    print("=== Launching Valkey VM ===")
    print()

    binary = build_dir / ".build" / "release" / "ValkeyVM"

    try:
        result = subprocess.run(
            [str(binary)],
            cwd=build_dir,
        )
        return result.returncode
    except subprocess.SubprocessError as e:
        print(f"Failed to launch VM: {e}")
        return 1
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        return 0


def run_valkey_vm_launcher(build_dir: Optional[Path] = None) -> int:
    """Build and launch the Valkey VM.

    Args:
        build_dir: Build directory (uses default if None)

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    if build_dir is None:
        build_dir = get_build_dir()

    print("=== Valkey VM Launcher ===")
    print()

    # Create Swift project
    if not create_swift_project(build_dir):
        print("Failed to create Swift project")
        return 1

    # Build
    if not build_valkey_vm(build_dir):
        return 1
    print()

    # Sign
    if not sign_with_entitlements(build_dir):
        return 1
    print()

    # Launch
    return launch_valkey_vm(build_dir)


def main() -> int:
    """Main entry point."""
    return run_valkey_vm_launcher()


if __name__ == "__main__":
    sys.exit(main())