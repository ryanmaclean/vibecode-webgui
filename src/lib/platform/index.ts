/**
 * Platform Detection and Configuration Module
 *
 * This module provides comprehensive platform detection and configuration
 * for VibeCode across Linux, macOS, and Windows.
 */

export {
  // Types
  type OperatingSystem,
  type Architecture,
  type DisplayServer,
  type LinuxDistroInfo,
  type PlatformCapabilities,
  type PlatformInfo,

  // Detection functions
  detectOS,
  detectArch,
  getLinuxDistroInfo,
  detectDesktopEnvironment,
  detectDisplayServer,
  detectCapabilities,

  // Capability checks
  checkKvmAvailable,
  checkHypervisorAvailable,
  checkWslAvailable,
  checkAllRequirements,

  // Environment detection
  isTauriEnvironment,
  isElectronEnvironment,
  isBrowserEnvironment,

  // Main functions
  getPlatformInfo,
  getSetupInstructions,

  // Singleton
  platform,
} from './detect';
