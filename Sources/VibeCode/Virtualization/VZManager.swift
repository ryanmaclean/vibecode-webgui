// VZManager.swift
// VibeCode - macOS 26 Tahoe Exclusive
//
// Direct Virtualization.framework integration for custom VMs

import Foundation
import Virtualization

@available(macOS 26.0, *)
@MainActor
public class VZManager: NSObject, ObservableObject {

    // MARK: - Published Properties

    @Published public private(set) var virtualMachines: [ManagedVM] = []
    @Published public private(set) var status: VMStatus = .idle

    // MARK: - VM Status

    public enum VMStatus {
        case idle
        case creating
        case starting
        case running
        case stopping
        case stopped
        case error(Error)
    }

    public enum VMError: LocalizedError {
        case configurationInvalid
        case diskImageNotFound
        case startupFailed(String)

        public var errorDescription: String? {
            switch self {
            case .configurationInvalid:
                return "VM configuration is invalid"
            case .diskImageNotFound:
                return "Disk image not found"
            case .startupFailed(let message):
                return "VM startup failed: \(message)"
            }
        }
    }

    // MARK: - Managed VM Model

    public struct ManagedVM: Identifiable {
        public let id: UUID
        public let name: String
        public let type: VMType
        public var status: VMStatus
        public let cpus: Int
        public let memory: UInt64
        public let created: Date

        var virtualMachine: VZVirtualMachine?

        public enum VMType {
            case development
            case production
            case custom
        }
    }

    // MARK: - VM Configuration Builder

    public class VMConfigurationBuilder {
        private var cpuCount: Int = 4
        private var memorySize: UInt64 = 8 * 1024 * 1024 * 1024 // 8GB
        private var diskURL: URL?
        private var additionalDisks: [URL] = []
        private var enableRosetta: Bool = false

        public init() {}

        public func cpus(_ count: Int) -> Self {
            self.cpuCount = count
            return self
        }

        public func memory(_ gigabytes: Int) -> Self {
            self.memorySize = UInt64(gigabytes) * 1024 * 1024 * 1024
            return self
        }

        public func disk(_ url: URL) -> Self {
            self.diskURL = url
            return self
        }

        public func additionalDisk(_ url: URL) -> Self {
            self.additionalDisks.append(url)
            return self
        }

        public func withRosetta() -> Self {
            self.enableRosetta = true
            return self
        }

        public func build() throws -> VZVirtualMachineConfiguration {
            let config = VZVirtualMachineConfiguration()

            // CPU Configuration (Apple silicon native)
            config.cpuCount = cpuCount

            // Memory Configuration
            config.memorySize = memorySize

            // Boot Loader (EFI for Linux)
            let bootLoader = VZEFIBootLoader()
            config.bootLoader = bootLoader

            // Storage Devices
            var storageDevices: [VZStorageDeviceConfiguration] = []

            // Main disk
            if let diskURL = diskURL {
                let diskAttachment = try VZDiskImageStorageDeviceAttachment(
                    url: diskURL,
                    readOnly: false
                )
                let diskConfig = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
                storageDevices.append(diskConfig)
            }

            // Additional disks
            for diskURL in additionalDisks {
                let diskAttachment = try VZDiskImageStorageDeviceAttachment(
                    url: diskURL,
                    readOnly: false
                )
                let diskConfig = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
                storageDevices.append(diskConfig)
            }

            config.storageDevices = storageDevices

            // Network Configuration (NAT)
            let networkDevice = VZVirtioNetworkDeviceConfiguration()
            networkDevice.attachment = VZNATNetworkDeviceAttachment()
            config.networkDevices = [networkDevice]

            // Graphics (for console access)
            let graphicsDevice = VZVirtioGraphicsDeviceConfiguration()
            graphicsDevice.scanouts = [
                VZVirtioGraphicsScanoutConfiguration(
                    widthInPixels: 1920,
                    heightInPixels: 1080
                )
            ]
            config.graphicsDevices = [graphicsDevice]

            // Audio (optional)
            let audioDevice = VZVirtioSoundDeviceConfiguration()
            let audioStream = VZVirtioSoundDeviceOutputStreamConfiguration()
            audioStream.sink = VZHostAudioOutputStreamSink()
            audioDevice.streams = [audioStream]
            config.audioDevices = [audioDevice]

            // Entropy (for random number generation)
            config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

            // Memory Balloon (dynamic memory)
            config.memoryBalloonDevices = [VZVirtioTraditionalMemoryBalloonDeviceConfiguration()]

            // Rosetta 2 for Linux (x86_64 compatibility)
            if enableRosetta {
                #if arch(arm64)
                let rosetta = VZLinuxRosettaDirectoryShare()
                let rosettaShare = VZVirtioFileSystemDeviceConfiguration(tag: "rosetta")
                rosettaShare.share = rosetta
                config.directorySharingDevices = [rosettaShare]
                #endif
            }

            // Validate configuration
            try config.validate()

            return config
        }
    }

    // MARK: - VM Creation

    public func createDevelopmentVM(
        name: String,
        diskURL: URL,
        cpus: Int = 4,
        memoryGB: Int = 8
    ) async throws -> ManagedVM {
        status = .creating

        do {
            let config = try VMConfigurationBuilder()
                .cpus(cpus)
                .memory(memoryGB)
                .disk(diskURL)
                .withRosetta()
                .build()

            let vm = VZVirtualMachine(configuration: config)

            let managed = ManagedVM(
                id: UUID(),
                name: name,
                type: .development,
                status: .stopped,
                cpus: cpus,
                memory: UInt64(memoryGB) * 1024 * 1024 * 1024,
                created: Date(),
                virtualMachine: vm
            )

            virtualMachines.append(managed)
            status = .idle

            return managed

        } catch {
            status = .error(VMError.configurationInvalid)
            throw error
        }
    }

    // MARK: - VM Lifecycle

    public func startVM(_ id: UUID) async throws {
        guard let index = virtualMachines.firstIndex(where: { $0.id == id }),
              let vm = virtualMachines[index].virtualMachine else {
            throw VMError.startupFailed("VM not found")
        }

        status = .starting
        virtualMachines[index].status = .starting

        do {
            try await vm.start()

            virtualMachines[index].status = .running
            status = .running

        } catch {
            virtualMachines[index].status = .error(error)
            status = .error(VMError.startupFailed(error.localizedDescription))
            throw error
        }
    }

    public func stopVM(_ id: UUID) async throws {
        guard let index = virtualMachines.firstIndex(where: { $0.id == id }),
              let vm = virtualMachines[index].virtualMachine else {
            return
        }

        status = .stopping
        virtualMachines[index].status = .stopping

        do {
            try await vm.stop()

            virtualMachines[index].status = .stopped
            status = .stopped

        } catch {
            virtualMachines[index].status = .error(error)
            status = .error(error)
            throw error
        }
    }

    public func pauseVM(_ id: UUID) async throws {
        guard let index = virtualMachines.firstIndex(where: { $0.id == id }),
              let vm = virtualMachines[index].virtualMachine else {
            return
        }

        try await vm.pause()
    }

    public func resumeVM(_ id: UUID) async throws {
        guard let index = virtualMachines.firstIndex(where: { $0.id == id }),
              let vm = virtualMachines[index].virtualMachine else {
            return
        }

        try await vm.resume()
    }
}

// MARK: - VZVirtualMachineDelegate

@available(macOS 26.0, *)
extension VZManager: VZVirtualMachineDelegate {
    nonisolated public func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        Task { @MainActor in
            if let index = virtualMachines.firstIndex(where: { $0.virtualMachine === virtualMachine }) {
                virtualMachines[index].status = .stopped
            }
        }
    }

    nonisolated public func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        Task { @MainActor in
            if let index = virtualMachines.firstIndex(where: { $0.virtualMachine === virtualMachine }) {
                virtualMachines[index].status = .error(error)
            }
        }
    }
}

// MARK: - Utility Extensions

@available(macOS 26.0, *)
extension VZManager {
    /// Get VM by ID
    public func getVM(_ id: UUID) -> ManagedVM? {
        return virtualMachines.first(where: { $0.id == id })
    }

    /// Delete VM
    public func deleteVM(_ id: UUID) async throws {
        // Stop VM if running
        if let vm = getVM(id), vm.status == .running {
            try await stopVM(id)
        }

        // Remove from list
        virtualMachines.removeAll(where: { $0.id == id })
    }
}
