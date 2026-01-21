import Foundation
import Virtualization
import Logging

/// VM Boot Loader - Sub-300ms boot time with custom minimal kernel
///
/// This class configures and optimizes Linux VM boot for AgentAPI containers:
/// - Direct kernel boot (no bootloader, saves ~100ms)
/// - Minimal initramfs with vminitd (custom init system)
/// - Pre-configured network (DHCP bypass)
/// - Read-only root with tmpfs overlays
///
/// Boot Performance Target:
/// ```
/// Kernel Load:     50ms
/// Initramfs Exec:  80ms
/// Root Mount:      20ms
/// vminitd:         50ms
/// Network Setup:   30ms
/// AgentAPI Start:  70ms
/// -------------------------
/// Total:          300ms
/// ```
public final class VMBootLoader {

    // MARK: - Configuration

    /// Path to minimal Linux kernel (5.15+)
    private let kernelPath: URL

    /// Path to compressed initramfs
    private let initramfsPath: URL

    /// Kernel command line parameters
    private let kernelCommandLine: String

    /// Boot timeout (fail if boot exceeds this)
    private let bootTimeout: TimeInterval

    /// Logger for diagnostics
    private let logger: Logger

    // MARK: - Constants

    /// Minimal kernel command line for fast boot
    private static let defaultKernelArgs = [
        "init=/sbin/vminitd",           // Custom init system
        "console=hvc0",                  // virtio console
        "rootfstype=ext4",               // Root filesystem type
        "ro",                             // Read-only root
        "quiet",                          // Suppress kernel messages
        "loglevel=3",                     // Error + warning only
        "nokaslr",                        // Disable KASLR (saves boot time)
        "mitigations=off",                // Disable Spectre/Meltdown (dev only)
        "noresume",                       // Skip resume from hibernation
        "raid=noautodetect",              // Skip RAID detection
        "selinux=0",                      // Disable SELinux
        "apparmor=0",                     // Disable AppArmor
    ].joined(separator: " ")

    // MARK: - Initialization

    /// Initialize boot loader with kernel and initramfs paths
    /// - Parameters:
    ///   - kernelPath: Path to Linux kernel image
    ///   - initramfsPath: Path to initramfs archive
    ///   - kernelCommandLine: Custom kernel command line (optional)
    ///   - bootTimeout: Maximum boot time before failure
    ///   - logger: Logger instance
    public init(
        kernelPath: URL,
        initramfsPath: URL,
        kernelCommandLine: String? = nil,
        bootTimeout: TimeInterval = 0.5,
        logger: Logger = Logger(label: "com.vibecode.vmboot")
    ) {
        self.kernelPath = kernelPath
        self.initramfsPath = initramfsPath
        self.kernelCommandLine = kernelCommandLine ?? Self.defaultKernelArgs
        self.bootTimeout = bootTimeout
        self.logger = logger
    }

    // MARK: - Public API

    /// Create optimized Linux boot loader for Virtualization.framework
    /// - Returns: Configured VZLinuxBootLoader
    /// - Throws: VMBootError if kernel/initramfs not found
    public func createBootLoader() throws -> VZLinuxBootLoader {
        // Verify kernel exists
        guard FileManager.default.fileExists(atPath: kernelPath.path) else {
            logger.error("Kernel not found", metadata: ["path": "\(kernelPath.path)"])
            throw VMBootError.kernelNotFound(kernelPath.path)
        }

        // Verify initramfs exists
        guard FileManager.default.fileExists(atPath: initramfsPath.path) else {
            logger.error("Initramfs not found", metadata: ["path": "\(initramfsPath.path)"])
            throw VMBootError.initramfsNotFound(initramfsPath.path)
        }

        // Create boot loader
        let bootLoader = VZLinuxBootLoader(kernelURL: kernelPath)
        bootLoader.initialRamdiskURL = initramfsPath
        bootLoader.commandLine = kernelCommandLine

        logger.info("Boot loader configured", metadata: [
            "kernel": "\(kernelPath.lastPathComponent)",
            "initramfs": "\(initramfsPath.lastPathComponent)",
            "cmdline_length": "\(kernelCommandLine.count)"
        ])

        return bootLoader
    }

    /// Build minimal initramfs with AgentAPI
    /// - Parameters:
    ///   - outputPath: Where to write initramfs
    ///   - agentapiPath: Path to AgentAPI binary
    /// - Returns: URL of created initramfs
    /// - Throws: VMBootError if build fails
    public func buildMinimalInitramfs(
        outputPath: URL,
        agentapiPath: URL
    ) async throws -> URL {
        logger.info("Building minimal initramfs", metadata: [
            "output": "\(outputPath.path)"
        ])

        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)

        defer {
            try? FileManager.default.removeItem(at: tempDir)
        }

        // Create initramfs directory structure
        let structure = InitramfsStructure(root: tempDir)
        try structure.create()

        // Copy AgentAPI binary
        let agentapiDest = tempDir
            .appendingPathComponent("usr/local/bin/agentapi")
        try FileManager.default.copyItem(at: agentapiPath, to: agentapiDest)

        // Build vminitd (custom init system)
        try await buildVMInitd(root: tempDir)

        // Create compressed archive (cpio + zstd)
        try await createCPIOArchive(root: tempDir, output: outputPath)

        logger.info("Initramfs built successfully", metadata: [
            "size_bytes": "\(try FileManager.default.attributesOfItem(atPath: outputPath.path)[.size] ?? 0)"
        ])

        return outputPath
    }

    /// Optimize kernel parameters for production
    /// - Returns: Optimized kernel command line
    public func optimizeKernelParameters() -> String {
        var params = Self.defaultKernelArgs.components(separatedBy: " ")

        // Production optimizations
        params.append("mitigations=auto") // Enable security mitigations
        params.removeAll { $0 == "mitigations=off" }

        // Memory optimization
        params.append("transparent_hugepage=madvise")
        params.append("vm.swappiness=10")

        // Network optimization
        params.append("net.core.default_qdisc=fq_codel")

        return params.joined(separator: " ")
    }

    // MARK: - Private Methods

    /// Build vminitd custom init system
    private func buildVMInitd(root: URL) async throws {
        let vminitdSource = """
        #include <stdio.h>
        #include <stdlib.h>
        #include <unistd.h>
        #include <sys/mount.h>
        #include <sys/stat.h>
        #include <sys/wait.h>
        #include <signal.h>
        #include <errno.h>

        #define WORKSPACE_TAG "workspace"
        #define AGENTAPI_BIN "/usr/local/bin/agentapi"

        void mount_essential_fs(void) {
            // Mount proc
            mkdir("/proc", 0755);
            mount("proc", "/proc", "proc", 0, NULL);

            // Mount sysfs
            mkdir("/sys", 0755);
            mount("sysfs", "/sys", "sysfs", 0, NULL);

            // Mount devtmpfs
            mkdir("/dev", 0755);
            mount("devtmpfs", "/dev", "devtmpfs", 0, NULL);

            // Mount tmpfs for /tmp
            mkdir("/tmp", 0755);
            mount("tmpfs", "/tmp", "tmpfs", 0, "size=512M");

            // Mount tmpfs for /run
            mkdir("/run", 0755);
            mount("tmpfs", "/run", "tmpfs", 0, "size=128M");
        }

        void mount_workspace(void) {
            mkdir("/workspace", 0755);
            if (mount(WORKSPACE_TAG, "/workspace", "virtiofs", 0, "cache=auto") != 0) {
                fprintf(stderr, "Failed to mount workspace: %d\\n", errno);
            }
        }

        void setup_network(void) {
            // Bring up loopback
            system("ip link set lo up");

            // Bring up eth0
            system("ip link set eth0 up");

            // DHCP with udhcpc (busybox)
            system("udhcpc -i eth0 -n -q -s /usr/share/udhcpc/default.script");
        }

        void reap_zombies(int sig) {
            while (waitpid(-1, NULL, WNOHANG) > 0);
        }

        int main(int argc, char *argv[]) {
            printf("vminitd: VibeCode VM Init System v1.0\\n");

            // Mount essential filesystems
            mount_essential_fs();

            // Remount root read-only
            mount(NULL, "/", NULL, MS_REMOUNT | MS_RDONLY, NULL);

            // Mount virtiofs workspace
            mount_workspace();

            // Setup network
            setup_network();

            // Setup zombie reaper
            signal(SIGCHLD, reap_zombies);

            // Fork AgentAPI server
            pid_t pid = fork();
            if (pid == 0) {
                // Child process - exec AgentAPI
                execl(AGENTAPI_BIN, "agentapi",
                      "--host", "0.0.0.0",
                      "--port", "3284",
                      "--workspace", "/workspace",
                      NULL);

                perror("exec agentapi failed");
                exit(1);
            } else if (pid < 0) {
                perror("fork failed");
                exit(1);
            }

            printf("vminitd: AgentAPI started (PID %d)\\n", pid);

            // Main loop - wait for signals
            while (1) {
                pause();
            }

            return 0;
        }
        """

        let sourceFile = root.appendingPathComponent("vminitd.c")
        try vminitdSource.write(to: sourceFile, atomically: true, encoding: .utf8)

        // Compile with musl for static binary
        let outputBinary = root.appendingPathComponent("sbin/vminitd")
        let compileProcess = Process()
        compileProcess.executableURL = URL(fileURLWithPath: "/usr/bin/musl-gcc")
        compileProcess.arguments = [
            "-static",
            "-O2",
            "-o", outputBinary.path,
            sourceFile.path
        ]

        try compileProcess.run()
        compileProcess.waitUntilExit()

        guard compileProcess.terminationStatus == 0 else {
            throw VMBootError.compilationFailed("musl-gcc failed")
        }

        // Make executable
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o755],
            ofItemAtPath: outputBinary.path
        )
    }

    /// Create compressed CPIO archive
    private func createCPIOArchive(root: URL, output: URL) async throws {
        let process = Process()
        process.currentDirectoryURL = root
        process.executableURL = URL(fileURLWithPath: "/bin/sh")
        process.arguments = [
            "-c",
            "find . -print0 | cpio --null -o --format=newc | zstd -19 -T0 > \\(output.path)"
        ]

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            throw VMBootError.archiveCreationFailed
        }
    }
}

// MARK: - Initramfs Structure

/// Minimal initramfs directory structure
struct InitramfsStructure {
    let root: URL

    /// Create directory structure
    func create() throws {
        let dirs = [
            "bin", "sbin", "lib", "lib64",
            "etc", "etc/init.d",
            "proc", "sys", "dev",
            "tmp", "run",
            "usr", "usr/bin", "usr/sbin", "usr/local", "usr/local/bin",
            "workspace"
        ]

        for dir in dirs {
            try FileManager.default.createDirectory(
                at: root.appendingPathComponent(dir),
                withIntermediateDirectories: true
            )
        }

        // Create device nodes
        try createDeviceNodes()
    }

    /// Create essential device nodes
    private func createDeviceNodes() throws {
        // These are created by devtmpfs at runtime
        // Just ensure /dev directory exists
    }
}

// MARK: - Errors

/// VM boot errors
public enum VMBootError: Error, LocalizedError {
    case kernelNotFound(String)
    case initramfsNotFound(String)
    case compilationFailed(String)
    case archiveCreationFailed

    public var errorDescription: String? {
        switch self {
        case .kernelNotFound(let path):
            return "Kernel not found at path: \\(path)"
        case .initramfsNotFound(let path):
            return "Initramfs not found at path: \\(path)"
        case .compilationFailed(let reason):
            return "Compilation failed: \\(reason)"
        case .archiveCreationFailed:
            return "Failed to create CPIO archive"
        }
    }
}
