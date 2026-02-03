#!/usr/bin/env python3
"""Valkey VM Launcher - Using Swift with proper entitlements.

This compiles and runs the Swift code with virtualization entitlements.
"""

from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from textwrap import dedent


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    green: str = "\033[0;32m"
    red: str = "\033[0;31m"
    reset: str = "\033[0m"


COLORS = Colors()


def get_paths() -> tuple[Path, Path]:
    """Get project and build directories."""
    script_dir = Path(__file__).resolve().parent
    project_dir = script_dir.parent.parent
    build_dir = project_dir / ".build" / "vz"
    return project_dir, build_dir


def print_success(message: str) -> None:
    """Print green success message."""
    print(f"{COLORS.green}✅ {message}{COLORS.reset}")


def print_error(message: str) -> None:
    """Print red error message."""
    print(f"{COLORS.red}✗ {message}{COLORS.reset}")


def get_package_swift() -> str:
    """Get the Package.swift content."""
    return dedent("""\
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
    """)


def get_main_swift() -> str:
    """Get the main.swift source code."""
    return dedent("""\
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
                print("✅ VM started successfully!")
            }

            func stop() async throws {
                guard let vm = virtualMachine, isRunning else { return }

                print("Stopping VM...")
                try await vm.stop()

                isRunning = false
                print("✅ VM stopped")
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
                    print("✅ Test complete")

                } catch {
                    print("✗ Error: \\(error)")
                    exit(1)
                }
            }
        }
    """)


def get_entitlements_plist() -> str:
    """Get the entitlements.plist content."""
    return dedent("""\
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
            <key>com.apple.security.virtualization</key>
            <true/>
        </dict>
        </plist>
    """)


def create_swift_package(build_dir: Path) -> None:
    """Create the Swift package structure.

    Args:
        build_dir: Directory to create the package in.
    """
    # Create directories
    build_dir.mkdir(parents=True, exist_ok=True)
    sources_dir = build_dir / "Sources"
    sources_dir.mkdir(exist_ok=True)

    # Write Package.swift
    package_swift = build_dir / "Package.swift"
    package_swift.write_text(get_package_swift())

    # Write main.swift
    main_swift = sources_dir / "main.swift"
    main_swift.write_text(get_main_swift())


def build_swift_package(build_dir: Path) -> bool:
    """Build the Swift package.

    Args:
        build_dir: Directory containing the Swift package.

    Returns:
        True if build succeeded, False otherwise.
    """
    print("Building ValkeyVM...")

    result = subprocess.run(
        ["swift", "build", "-c", "release"],
        cwd=build_dir,
        capture_output=True,
        text=True,
    )

    # Print output without warnings
    if result.stdout:
        for line in result.stdout.split("\n"):
            if "warning:" not in line and line.strip():
                print(line)

    executable = build_dir / ".build" / "release" / "ValkeyVM"
    if not executable.exists():
        print_error("Build failed")
        if result.stderr:
            # Print errors (not warnings)
            for line in result.stderr.split("\n"):
                if "warning:" not in line and line.strip():
                    print(line)
        return False

    print_success("Build complete")
    print()
    return True


def sign_with_entitlements(build_dir: Path) -> bool:
    """Sign the executable with virtualization entitlements.

    Args:
        build_dir: Directory containing the built executable.

    Returns:
        True if signing succeeded, False otherwise.
    """
    # Create entitlements file
    entitlements_path = build_dir / "entitlements.plist"
    entitlements_path.write_text(get_entitlements_plist())

    executable = build_dir / ".build" / "release" / "ValkeyVM"

    print("Signing with virtualization entitlement...")

    result = subprocess.run(
        [
            "codesign",
            "--entitlements", str(entitlements_path),
            "-f", "-s", "-",
            str(executable),
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print_error(f"Signing failed: {result.stderr}")
        return False

    print_success("Signed with entitlements")
    print()
    return True


def launch_vm(build_dir: Path) -> int:
    """Launch the Valkey VM.

    Args:
        build_dir: Directory containing the built executable.

    Returns:
        Exit code from the VM process.
    """
    print("=== Launching Valkey VM ===")
    print()

    executable = build_dir / ".build" / "release" / "ValkeyVM"

    result = subprocess.run([str(executable)])
    return result.returncode


def main() -> int:
    """Main entry point."""
    print("=== Valkey VM Launcher ===")
    print()

    _, build_dir = get_paths()

    # Create Swift package
    create_swift_package(build_dir)

    # Build
    if not build_swift_package(build_dir):
        return 1

    # Sign with entitlements
    if not sign_with_entitlements(build_dir):
        return 1

    # Launch
    return launch_vm(build_dir)


if __name__ == "__main__":
    sys.exit(main())
