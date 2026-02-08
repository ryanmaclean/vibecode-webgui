/**
 * Tests for Platform Detection Module
 */

import * as os from 'os';
import * as fs from 'fs';

// Must mock before imports
jest.mock('os');
jest.mock('fs');
jest.mock('child_process', () => ({
  execFileSync: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execFileSync: mockedExecFileSync } = require('child_process') as { execFileSync: jest.Mock };

const mockedOs = os as jest.Mocked<typeof os>;
const mockedFs = fs as jest.Mocked<typeof fs>;

import {
  detectOS,
  detectArch,
  getLinuxDistroInfo,
  detectDesktopEnvironment,
  detectDisplayServer,
  checkKvmAvailable,
  checkHypervisorAvailable,
  checkWslAvailable,
  detectCapabilities,
  isTauriEnvironment,
  isElectronEnvironment,
  isBrowserEnvironment,
  getPlatformInfo,
  checkAllRequirements,
  getSetupInstructions,
} from '../detect';

describe('Platform Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.XDG_CURRENT_DESKTOP;
    delete process.env.DESKTOP_SESSION;
    delete process.env.WAYLAND_DISPLAY;
    delete process.env.DISPLAY;
    delete process.env.XDG_SESSION_TYPE;
    delete process.env.TAURI_ENV_PLATFORM;
  });

  // ==== detectOS ====

  describe('detectOS', () => {
    it('returns linux for linux platform', () => {
      mockedOs.platform.mockReturnValue('linux');
      expect(detectOS()).toBe('linux');
    });

    it('returns macos for darwin platform', () => {
      mockedOs.platform.mockReturnValue('darwin');
      expect(detectOS()).toBe('macos');
    });

    it('returns windows for win32 platform', () => {
      mockedOs.platform.mockReturnValue('win32');
      expect(detectOS()).toBe('windows');
    });

    it('returns unknown for unsupported platform', () => {
      mockedOs.platform.mockReturnValue('freebsd' as any);
      expect(detectOS()).toBe('unknown');
    });
  });

  // ==== detectArch ====

  describe('detectArch', () => {
    it('returns x64 for x64 arch', () => {
      mockedOs.arch.mockReturnValue('x64');
      expect(detectArch()).toBe('x64');
    });

    it('returns arm64 for arm64 arch', () => {
      mockedOs.arch.mockReturnValue('arm64');
      expect(detectArch()).toBe('arm64');
    });

    it('returns unknown for unsupported arch', () => {
      mockedOs.arch.mockReturnValue('ia32' as any);
      expect(detectArch()).toBe('unknown');
    });
  });

  // ==== getLinuxDistroInfo ====

  describe('getLinuxDistroInfo', () => {
    it('returns undefined on non-linux', () => {
      mockedOs.platform.mockReturnValue('darwin');
      expect(getLinuxDistroInfo()).toBeUndefined();
    });

    it('returns undefined if /etc/os-release missing', () => {
      mockedOs.platform.mockReturnValue('linux');
      mockedFs.existsSync.mockReturnValue(false);
      expect(getLinuxDistroInfo()).toBeUndefined();
    });

    it('parses Ubuntu os-release correctly', () => {
      mockedOs.platform.mockReturnValue('linux');
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(
        'NAME="Ubuntu"\nVERSION_ID="22.04"\nID=ubuntu\nVERSION_CODENAME=jammy\nPRETTY_NAME="Ubuntu 22.04.3 LTS"\n'
      );

      const info = getLinuxDistroInfo();
      expect(info).toEqual({
        id: 'ubuntu',
        name: 'Ubuntu',
        version: '22.04',
        versionCodename: 'jammy',
        prettyName: 'Ubuntu 22.04.3 LTS',
      });
    });

    it('handles missing fields gracefully', () => {
      mockedOs.platform.mockReturnValue('linux');
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('ID=alpine\n');

      const info = getLinuxDistroInfo();
      expect(info).toEqual({
        id: 'alpine',
        name: 'Linux',
        version: 'unknown',
        versionCodename: undefined,
        prettyName: 'Linux',
      });
    });

    it('returns undefined on fs error', () => {
      mockedOs.platform.mockReturnValue('linux');
      mockedFs.existsSync.mockImplementation(() => { throw new Error('perm'); });
      expect(getLinuxDistroInfo()).toBeUndefined();
    });
  });

  // ==== detectDesktopEnvironment ====

  describe('detectDesktopEnvironment', () => {
    it('returns undefined on non-linux', () => {
      mockedOs.platform.mockReturnValue('darwin');
      expect(detectDesktopEnvironment()).toBeUndefined();
    });

    it('detects from XDG_CURRENT_DESKTOP', () => {
      mockedOs.platform.mockReturnValue('linux');
      process.env.XDG_CURRENT_DESKTOP = 'GNOME';
      expect(detectDesktopEnvironment()).toBe('GNOME');
    });

    it('detects from DESKTOP_SESSION', () => {
      mockedOs.platform.mockReturnValue('linux');
      process.env.DESKTOP_SESSION = 'plasma';
      expect(detectDesktopEnvironment()).toBe('plasma');
    });

    it('detects from running processes', () => {
      mockedOs.platform.mockReturnValue('linux');
      mockedExecFileSync.mockImplementation((cmd: any, args: any) => {
        if (args && args[1] === 'gnome-shell') return '1234\n';
        throw new Error('not found');
      });
      expect(detectDesktopEnvironment()).toBe('GNOME');
    });

    it('returns undefined when no DE detected', () => {
      mockedOs.platform.mockReturnValue('linux');
      mockedExecFileSync.mockImplementation(() => { throw new Error('not found'); });
      expect(detectDesktopEnvironment()).toBeUndefined();
    });
  });

  // ==== detectDisplayServer ====

  describe('detectDisplayServer', () => {
    it('returns unknown on non-linux', () => {
      mockedOs.platform.mockReturnValue('darwin');
      expect(detectDisplayServer()).toBe('unknown');
    });

    it('detects wayland', () => {
      mockedOs.platform.mockReturnValue('linux');
      process.env.WAYLAND_DISPLAY = 'wayland-0';
      expect(detectDisplayServer()).toBe('wayland');
    });

    it('detects x11', () => {
      mockedOs.platform.mockReturnValue('linux');
      process.env.DISPLAY = ':0';
      expect(detectDisplayServer()).toBe('x11');
    });

    it('detects tty', () => {
      mockedOs.platform.mockReturnValue('linux');
      process.env.XDG_SESSION_TYPE = 'tty';
      expect(detectDisplayServer()).toBe('tty');
    });

    it('returns unknown when no display env', () => {
      mockedOs.platform.mockReturnValue('linux');
      expect(detectDisplayServer()).toBe('unknown');
    });
  });

  // ==== KVM / Hypervisor / WSL ====

  describe('checkKvmAvailable', () => {
    it('returns false on non-linux', () => {
      mockedOs.platform.mockReturnValue('darwin');
      expect(checkKvmAvailable()).toBe(false);
    });

    it('returns false when /dev/kvm missing', () => {
      mockedOs.platform.mockReturnValue('linux');
      mockedFs.existsSync.mockReturnValue(false);
      expect(checkKvmAvailable()).toBe(false);
    });

    it('returns true when /dev/kvm accessible', () => {
      mockedOs.platform.mockReturnValue('linux');
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.accessSync.mockReturnValue(undefined);
      expect(checkKvmAvailable()).toBe(true);
    });

    it('returns false when /dev/kvm not accessible', () => {
      mockedOs.platform.mockReturnValue('linux');
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.accessSync.mockImplementation(() => { throw new Error('EACCES'); });
      expect(checkKvmAvailable()).toBe(false);
    });
  });

  describe('checkHypervisorAvailable', () => {
    it('returns false on non-macos', () => {
      mockedOs.platform.mockReturnValue('linux');
      expect(checkHypervisorAvailable()).toBe(false);
    });

    it('returns true when kern.hv_support is 1', () => {
      mockedOs.platform.mockReturnValue('darwin');
      mockedExecFileSync.mockReturnValue('1\n');
      expect(checkHypervisorAvailable()).toBe(true);
    });

    it('returns false on error', () => {
      mockedOs.platform.mockReturnValue('darwin');
      mockedExecFileSync.mockImplementation(() => { throw new Error('fail'); });
      expect(checkHypervisorAvailable()).toBe(false);
    });
  });

  describe('checkWslAvailable', () => {
    it('returns false on non-windows', () => {
      mockedOs.platform.mockReturnValue('linux');
      expect(checkWslAvailable()).toBe(false);
    });

    it('returns true when wsl --version succeeds', () => {
      mockedOs.platform.mockReturnValue('win32');
      mockedExecFileSync.mockReturnValue('WSL version: 2.0.0\n');
      expect(checkWslAvailable()).toBe(true);
    });

    it('returns false when wsl not available', () => {
      mockedOs.platform.mockReturnValue('win32');
      mockedExecFileSync.mockImplementation(() => { throw new Error('not found'); });
      expect(checkWslAvailable()).toBe(false);
    });
  });

  // ==== Environment Detection ====

  describe('isTauriEnvironment', () => {
    it('returns false in Node environment without Tauri', () => {
      expect(isTauriEnvironment()).toBe(false);
    });

    it('returns true with TAURI_ENV_PLATFORM set', () => {
      process.env.TAURI_ENV_PLATFORM = 'macos';
      expect(isTauriEnvironment()).toBe(true);
    });
  });

  describe('isElectronEnvironment', () => {
    it('returns false without electron in process.versions', () => {
      expect(isElectronEnvironment()).toBe(false);
    });
  });

  describe('isBrowserEnvironment', () => {
    it('returns true when window exists without Tauri/Electron', () => {
      expect(isBrowserEnvironment()).toBe(true); // window is defined in test
    });
  });

  // ==== detectCapabilities ====

  describe('detectCapabilities', () => {
    it('detects available commands', () => {
      mockedOs.platform.mockReturnValue('darwin');
      mockedExecFileSync.mockImplementation((cmd: any, args: any) => {
        if (cmd === 'which') {
          if (args[0] === 'docker') return '/usr/local/bin/docker\n';
          if (args[0] === 'node') return '/usr/local/bin/node\n';
          if (args[0] === 'git') return '/usr/bin/git\n';
        }
        if (cmd === 'docker' || cmd === 'node') return 'version\n';
        if (cmd === 'sysctl') return '1\n';
        throw new Error('not found');
      });

      const caps = detectCapabilities();
      expect(caps.hasDocker).toBe(true);
      expect(caps.hasNode).toBe(true);
      expect(caps.hasGit).toBe(true);
    });
  });

  // ==== getPlatformInfo ====

  describe('getPlatformInfo', () => {
    it('returns complete platform info for macOS', () => {
      mockedOs.platform.mockReturnValue('darwin');
      mockedOs.arch.mockReturnValue('arm64');
      mockedExecFileSync.mockImplementation(() => { throw new Error('not found'); });

      const info = getPlatformInfo();
      expect(info.os).toBe('macos');
      expect(info.arch).toBe('arm64');
      expect(info.distro).toBeUndefined();
      expect(info.capabilities).toBeDefined();
    });
  });

  // ==== checkAllRequirements ====

  describe('checkAllRequirements', () => {
    it('reports missing tools', () => {
      mockedOs.platform.mockReturnValue('darwin');
      mockedOs.arch.mockReturnValue('arm64');
      mockedExecFileSync.mockImplementation(() => { throw new Error('not found'); });

      const result = checkAllRequirements();
      expect(result.satisfied).toBe(false);
      expect(result.missing).toContain('Docker');
      expect(result.missing).toContain('Node.js');
      expect(result.missing).toContain('Git');
    });
  });

  // ==== getSetupInstructions ====

  describe('getSetupInstructions', () => {
    it('generates macOS instructions', () => {
      mockedOs.platform.mockReturnValue('darwin');
      mockedOs.arch.mockReturnValue('arm64');
      mockedExecFileSync.mockImplementation(() => { throw new Error('not found'); });

      const instructions = getSetupInstructions();
      expect(instructions).toContain('macOS Setup');
      expect(instructions).toContain('brew install');
    });

    it('generates Linux instructions for Ubuntu', () => {
      mockedOs.platform.mockReturnValue('linux');
      mockedOs.arch.mockReturnValue('x64');
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(
        'ID=ubuntu\nNAME="Ubuntu"\nVERSION_ID="22.04"\nPRETTY_NAME="Ubuntu 22.04"\n'
      );
      mockedExecFileSync.mockImplementation(() => { throw new Error('not found'); });

      const instructions = getSetupInstructions();
      expect(instructions).toContain('Linux');
      expect(instructions).toContain('apt');
    });

    it('generates Windows instructions', () => {
      mockedOs.platform.mockReturnValue('win32');
      mockedOs.arch.mockReturnValue('x64');
      mockedExecFileSync.mockImplementation(() => { throw new Error('not found'); });

      const instructions = getSetupInstructions();
      expect(instructions).toContain('Windows Setup');
    });

    it('handles unknown platform', () => {
      mockedOs.platform.mockReturnValue('freebsd' as any);
      mockedOs.arch.mockReturnValue('x64');
      mockedExecFileSync.mockImplementation(() => { throw new Error('not found'); });

      const instructions = getSetupInstructions();
      expect(instructions).toContain('Unknown platform');
    });
  });
});
