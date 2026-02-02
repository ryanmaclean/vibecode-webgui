import fs from 'fs';
import path from 'path';

describe('feature audit 1448: NAT networking', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const configPath = path.join(repoRoot, 'platforms', 'macos', 'vz-swift', 'Sources', 'VibeCodeVM', 'NetworkConfig.swift');

  it('uses VZNATNetworkDeviceAttachment for networking', () => {
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('VZNATNetworkDeviceAttachment');
  });
});
