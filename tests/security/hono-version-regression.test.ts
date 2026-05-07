import fs from 'node:fs';
import path from 'node:path';

function parseVersion(version: string): [number, number, number] {
  const normalized = version.replace(/^[^\d]*/, '').split('-')[0];
  const [major = '0', minor = '0', patch = '0'] = normalized.split('.');
  return [Number(major), Number(minor), Number(patch)];
}

function isAtLeast(version: string, minimum: string): boolean {
  const [vMajor, vMinor, vPatch] = parseVersion(version);
  const [mMajor, mMinor, mPatch] = parseVersion(minimum);

  if (vMajor !== mMajor) return vMajor > mMajor;
  if (vMinor !== mMinor) return vMinor > mMinor;
  return vPatch >= mPatch;
}

describe('hono vulnerability regression guard', () => {
  const minimumSafeVersion = '4.12.16';
  const repoRoot = path.resolve(__dirname, '../../');

  it('pins hono override to a non-vulnerable version range', () => {
    const packageJsonPath = path.join(repoRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      overrides?: Record<string, string>;
    };

    expect(packageJson.overrides?.hono).toBeDefined();
    expect(isAtLeast(packageJson.overrides?.hono ?? '', minimumSafeVersion)).toBe(true);
  });

  it('locks hono to a non-vulnerable version in package-lock', () => {
    const lockPath = path.join(repoRoot, 'package-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as {
      packages?: Record<string, { version?: string }>;
    };

    const lockedVersion = lock.packages?.['node_modules/hono']?.version;
    expect(lockedVersion).toBeDefined();
    expect(isAtLeast(lockedVersion ?? '', minimumSafeVersion)).toBe(true);
  });
});