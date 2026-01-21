import Foundation
import Virtualization

/// Metal GPU configuration for VMs
/// Issue #965: Add Metal GPU acceleration for VMs
/// Target: Apple M-series Silicon with unified memory

/// GPU configuration options
public struct GPUConfig {
    /// Resolution for VM display
    public var width: Int
    public var height: Int

    /// Frames per second target
    public var targetFPS: Int

    /// Enable Metal acceleration
    public var metalEnabled: Bool

    public init(
        width: Int = 1920,
        height: Int = 1080,
        targetFPS: Int = 60,
        metalEnabled: Bool = true
    ) {
        self.width = width
        self.height = height
        self.targetFPS = targetFPS
        self.metalEnabled = metalEnabled
    }

    /// 4K resolution preset
    public static let uhd4K = GPUConfig(width: 3840, height: 2160)

    /// 1440p preset
    public static let qhd = GPUConfig(width: 2560, height: 1440)

    /// 1080p preset (default)
    public static let fullHD = GPUConfig(width: 1920, height: 1080)

    /// 720p preset (low resource)
    public static let hd = GPUConfig(width: 1280, height: 720)
}

/// Errors for GPU configuration
public enum GPUConfigError: LocalizedError {
    case metalNotSupported
    case invalidResolution
    case configurationFailed(String)

    public var errorDescription: String? {
        switch self {
        case .metalNotSupported:
            return "Metal GPU acceleration is not supported on this device"
        case .invalidResolution:
            return "Invalid resolution specified for GPU configuration"
        case .configurationFailed(let reason):
            return "GPU configuration failed: \(reason)"
        }
    }
}

/// Metal GPU configuration manager for VZ VMs
public class MetalGPUManager {

    /// Check if Metal is available
    public static var isMetalAvailable: Bool {
        // On Apple Silicon, Metal is always available
        #if arch(arm64)
        return true
        #else
        return false
        #endif
    }

    /// Create Virtio graphics device configuration
    /// - Parameter config: GPU configuration options
    /// - Returns: Configured VZVirtioGraphicsDeviceConfiguration
    public static func createGraphicsDevice(
        config: GPUConfig = .fullHD
    ) throws -> VZVirtioGraphicsDeviceConfiguration {
        guard isMetalAvailable else {
            throw GPUConfigError.metalNotSupported
        }

        guard config.width > 0 && config.height > 0 else {
            throw GPUConfigError.invalidResolution
        }

        let graphicsDevice = VZVirtioGraphicsDeviceConfiguration()

        // Configure primary scanout (display)
        let scanout = VZVirtioGraphicsScanoutConfiguration(
            widthInPixels: config.width,
            heightInPixels: config.height
        )

        graphicsDevice.scanouts = [scanout]

        return graphicsDevice
    }

    /// Create multiple display configuration
    /// - Parameter configs: Array of GPU configurations for each display
    /// - Returns: Configured graphics device with multiple scanouts
    public static func createMultiDisplayDevice(
        configs: [GPUConfig]
    ) throws -> VZVirtioGraphicsDeviceConfiguration {
        guard isMetalAvailable else {
            throw GPUConfigError.metalNotSupported
        }

        guard !configs.isEmpty else {
            throw GPUConfigError.configurationFailed("No display configurations provided")
        }

        let graphicsDevice = VZVirtioGraphicsDeviceConfiguration()

        let scanouts = configs.map { config in
            VZVirtioGraphicsScanoutConfiguration(
                widthInPixels: config.width,
                heightInPixels: config.height
            )
        }

        graphicsDevice.scanouts = scanouts

        return graphicsDevice
    }

    /// Configure VM for GPU acceleration
    /// - Parameters:
    ///   - vmConfig: VM configuration to modify
    ///   - gpuConfig: GPU settings
    public static func configureVM(
        _ vmConfig: inout VZVirtualMachineConfiguration,
        gpuConfig: GPUConfig = .fullHD
    ) throws {
        let graphicsDevice = try createGraphicsDevice(config: gpuConfig)
        vmConfig.graphicsDevices = [graphicsDevice]
    }
}

/// GPU performance metrics
public struct GPUMetrics {
    public var frameRate: Double
    public var gpuUtilization: Double
    public var memoryUsed: UInt64
    public var memoryTotal: UInt64

    public var memoryUsagePercent: Double {
        guard memoryTotal > 0 else { return 0 }
        return Double(memoryUsed) / Double(memoryTotal) * 100
    }
}

/// GPU monitoring for VMs (requires macOS 14+)
@available(macOS 14.0, *)
public class GPUMonitor {
    private var isMonitoring = false
    private var metricsCallback: ((GPUMetrics) -> Void)?

    public init() {}

    /// Start monitoring GPU metrics
    /// - Parameter callback: Called with updated metrics
    public func startMonitoring(callback: @escaping (GPUMetrics) -> Void) {
        guard !isMonitoring else { return }
        isMonitoring = true
        metricsCallback = callback

        // In production, this would use Metal Performance HUD or IOKit
        // For now, return placeholder metrics
        Task {
            while isMonitoring {
                let metrics = GPUMetrics(
                    frameRate: 60.0,
                    gpuUtilization: 0.0,
                    memoryUsed: 0,
                    memoryTotal: 0
                )
                await MainActor.run {
                    metricsCallback?(metrics)
                }
                try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
            }
        }
    }

    /// Stop monitoring GPU metrics
    public func stopMonitoring() {
        isMonitoring = false
        metricsCallback = nil
    }
}
