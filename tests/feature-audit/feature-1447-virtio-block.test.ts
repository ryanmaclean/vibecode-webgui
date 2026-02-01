import fs from 'fs';
import path from 'path';

describe('feature audit 1447: virtio block devices', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const vzManagerPath = path.join(repoRoot, 'platforms', 'macos', 'Sources', 'VibeCode', 'Virtualization', 'VZManager.swift');

  it('configures VZVirtioBlockDeviceConfiguration', () => {
    const content = fs.readFileSync(vzManagerPath, 'utf-8');
    expect(content).toContain('VZVirtioBlockDeviceConfiguration');
  });
});
