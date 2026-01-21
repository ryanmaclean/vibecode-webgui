/**
 * vfkit Bootstrap Module
 * Issue #956: First-boot VM initialization using vfkit
 *
 * Uses vfkit for initial EFI setup, then hands off to Virtualization.framework
 */

import { spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

/**
 * VM boot state
 */
export type BootState = 'uninitialized' | 'first-boot' | 'ready';

/**
 * VM configuration for vfkit bootstrap
 */
export interface VMBootConfig {
  name: string;
  vmPath: string;
  diskPath: string;
  efiVarsPath: string;
  cpus: number;
  memoryMB: number;
  cloudInitIso?: string;
}

/**
 * Bootstrap result
 */
export interface BootstrapResult {
  success: boolean;
  state: BootState;
  message: string;
  efiInitialized: boolean;
}

/**
 * Check if VM needs first-boot initialization
 */
export function checkBootState(config: VMBootConfig): BootState {
  const { efiVarsPath, diskPath } = config;

  // Check if disk exists
  if (!existsSync(diskPath)) {
    return 'uninitialized';
  }

  // Check if EFI vars exist and have been initialized
  if (!existsSync(efiVarsPath)) {
    return 'first-boot';
  }

  // Check if EFI vars file has content (not just zeros)
  try {
    const stats = statSync(efiVarsPath);
    if (stats.size < 1024) {
      return 'first-boot';
    }

    // TODO: Could add more sophisticated check for valid EFI content
    return 'ready';
  } catch {
    return 'first-boot';
  }
}

/**
 * Run command with vfkit
 */
function runVfkit(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('vfkit', args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', data => stdout += data);
    proc.stderr.on('data', data => stderr += data);
    proc.on('close', code => resolve({ exitCode: code || 0, stdout, stderr }));
    proc.on('error', reject);
  });
}

/**
 * Create cloud-init ISO for first boot
 */
export async function createCloudInitISO(
  outputPath: string,
  userData: string,
  metaData: string = 'instance-id: first-boot'
): Promise<boolean> {
  const { writeFileSync, mkdirSync } = await import('fs');
  const tmpDir = join('/tmp', `cloud-init-${Date.now()}`);

  try {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, 'user-data'), userData);
    writeFileSync(join(tmpDir, 'meta-data'), metaData);

    // Create ISO using hdiutil (macOS)
    const result = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
      const proc = spawn('hdiutil', [
        'makehybrid',
        '-o', outputPath,
        '-hfs',
        '-joliet',
        '-iso',
        '-default-volume-name', 'cidata',
        tmpDir
      ]);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', data => stdout += data);
      proc.stderr.on('data', data => stderr += data);
      proc.on('close', code => resolve({ exitCode: code || 0, stdout, stderr }));
      proc.on('error', reject);
    });

    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Bootstrap VM with vfkit for first-boot initialization
 */
export async function bootstrapWithVfkit(config: VMBootConfig): Promise<BootstrapResult> {
  const state = checkBootState(config);

  if (state === 'ready') {
    return {
      success: true,
      state: 'ready',
      message: 'VM already initialized, ready for Virtualization.framework',
      efiInitialized: true,
    };
  }

  if (state === 'uninitialized') {
    return {
      success: false,
      state: 'uninitialized',
      message: 'VM disk not found, create disk first',
      efiInitialized: false,
    };
  }

  // Prepare cloud-init for bootloader installation
  const cloudInitUserData = `#cloud-config
runcmd:
  - apk update
  - apk add grub grub-efi efibootmgr
  - mkdir -p /boot/efi
  - mount /dev/vda1 /boot/efi || true
  - grub-install --target=arm64-efi --efi-directory=/boot/efi --bootloader-id=alpine --no-nvram || true
  - grub-mkconfig -o /boot/grub/grub.cfg || true
  - sync
  - poweroff
`;

  const cloudInitIso = config.cloudInitIso || join(config.vmPath, 'cloud-init.iso');

  // Create cloud-init ISO if needed
  if (!existsSync(cloudInitIso)) {
    const created = await createCloudInitISO(cloudInitIso, cloudInitUserData);
    if (!created) {
      return {
        success: false,
        state: 'first-boot',
        message: 'Failed to create cloud-init ISO',
        efiInitialized: false,
      };
    }
  }

  // Build vfkit command
  const vfkitArgs = [
    '--cpus', String(config.cpus),
    '--memory', String(config.memoryMB),
    '--bootloader', `efi,variable-store=${config.efiVarsPath},create`,
    '--device', `virtio-blk,path=${config.diskPath}`,
    '--device', `virtio-blk,path=${cloudInitIso}`,
    '--device', 'virtio-net,nat',
  ];

  try {
    // Run vfkit for first boot (will auto-shutdown after cloud-init)
    const result = await runVfkit(vfkitArgs);

    if (result.exitCode === 0) {
      return {
        success: true,
        state: 'ready',
        message: 'First boot completed, EFI initialized',
        efiInitialized: true,
      };
    } else {
      return {
        success: false,
        state: 'first-boot',
        message: `vfkit exited with code ${result.exitCode}: ${result.stderr}`,
        efiInitialized: false,
      };
    }
  } catch (error) {
    return {
      success: false,
      state: 'first-boot',
      message: `vfkit error: ${error}`,
      efiInitialized: false,
    };
  }
}

/**
 * Check if vfkit is available
 */
export async function isVfkitAvailable(): Promise<boolean> {
  try {
    const result = await runVfkit(['--version']);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get recommended boot method based on VM state
 */
export function getBootMethod(config: VMBootConfig): 'vfkit' | 'virtualization-framework' {
  const state = checkBootState(config);
  return state === 'ready' ? 'virtualization-framework' : 'vfkit';
}
