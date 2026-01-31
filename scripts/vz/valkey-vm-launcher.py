#!/usr/bin/env python3
"""Valkey VM Launcher - Using Swift with proper entitlements.

This compiles and runs the Swift code with virtualization entitlements.
"""

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class VMConfig:
    """Configuration for the VM launcher."""

    script_dir: Path
    project_dir: Path
    build_dir: Path

    @classmethod
    def from_script_path(cls, script_path: Path) -> "VMConfig":
        """Create config from script path."""
        script_dir = script_path.parent.resolve()
        project_dir = (script_dir / "../..").resolve()
        build_dir = project_dir / ".build" / "vz"
        return cls(
            script_dir=script_dir,
            project_dir=project_dir,
            build_dir=build_dir,
        )


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


def run_command(
    cmd: list[str],
    cwd: Path | None = None,
    check: bool = True,
    capture_output: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return the result."""
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        text=True,
        capture_output=capture_output,
    )


def create_build_directory(config: VMConfig) -> None:
    """Create the build directory structure."""
    config.build_dir.mkdir(parents=True, exist_ok=True)
    sources_dir = config.build_dir / "Sources"
    sources_dir.mkdir(parents=True, exist_ok=True)


def write_package_swift(config: VMConfig) -> None:
    """Write the Package.swift file."""
    package_path = config.build_dir / "Package.swift"
    package_path.write_text(PACKAGE_SWIFT)


def write_main_swift(config: VMConfig) -> None:
    """Write the main.swift source file."""
    main_path = config.build_dir / "Sources" / "main.swift"
    main_path.write_text(MAIN_SWIFT)


def write_entitlements(config: VMConfig) -> Path:
    """Write the entitlements plist file."""
    entitlements_path = config.build_dir / "entitlements.plist"
    entitlements_path.write_text(ENTITLEMENTS_PLIST)
    return entitlements_path


def build_swift_project(config: VMConfig) -> bool:
    """Build the Swift project."""
    print("Building ValkeyVM...")

    result = run_command(
        ["swift", "build", "-c", "release"],
        cwd=config.build_dir,
        check=False,
        capture_output=True,
    )

    # Filter out warnings from output
    if result.stdout:
        for line in result.stdout.splitlines():
            if "warning:" not in line:
                print(line)

    if result.stderr:
        for line in result.stderr.splitlines():
            if "warning:" not in line:
                print(line, file=sys.stderr)

    binary_path = config.build_dir / ".build" / "release" / "ValkeyVM"
    if not binary_path.exists():
        print("Build failed")
        return False

    print("Build complete")
    print()
    return True


def sign_with_entitlements(config: VMConfig, entitlements_path: Path) -> bool:
    """Sign the binary with virtualization entitlements."""
    print("Signing with virtualization entitlement...")

    binary_path = config.build_dir / ".build" / "release" / "ValkeyVM"

    result = run_command(
        [
            "codesign",
            "--entitlements",
            str(entitlements_path),
            "-f",
            "-s",
            "-",
            str(binary_path),
        ],
        check=False,
    )

    if result.returncode != 0:
        print("Signing failed")
        return False

    print("Signed with entitlements")
    print()
    return True


def launch_vm(config: VMConfig) -> int:
    """Launch the Valkey VM."""
    print("=== Launching Valkey VM ===")
    print()

    binary_path = config.build_dir / ".build" / "release" / "ValkeyVM"

    result = run_command([str(binary_path)], check=False)
    return result.returncode


def main() -> int:
    """Main entry point."""
    print("=== Valkey VM Launcher ===")
    print()

    # Get configuration
    script_path = Path(__file__).resolve()
    config = VMConfig.from_script_path(script_path)

    # Create build directory
    create_build_directory(config)

    # Write Swift package files
    write_package_swift(config)
    write_main_swift(config)

    # Build the project
    if not build_swift_project(config):
        return 1

    # Write and apply entitlements
    entitlements_path = write_entitlements(config)
    if not sign_with_entitlements(config, entitlements_path):
        return 1

    # Launch the VM
    return launch_vm(config)


if __name__ == "__main__":
    sys.exit(main())
