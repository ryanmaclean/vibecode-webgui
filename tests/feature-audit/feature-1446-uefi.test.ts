import fs from 'fs';
import path from 'path';

describe('feature audit 1446: UEFI boot support', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const efiPath = path.join(repoRoot, 'platforms', 'macos', 'VibeCodeSwift', 'Sources', 'VM', 'EFIVariableStore.swift');

  it('uses VZEFIBootLoader in AVF config', () => {
    const content = fs.readFileSync(efiPath, 'utf-8');
    expect(content).toContain('VZEFIBootLoader');
  });
});
