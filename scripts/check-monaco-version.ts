#!/usr/bin/env node
/**
 * Pre-commit check for Monaco Editor version
 * Prevents accidental downgrades
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import packageJson from '../package.json' assert { type: 'json' };

const lockFile = readFileSync(path.join(process.cwd(), '.monaco-version-lock'), 'utf8');

function readExpectedVersion(): string | undefined {
  return lockFile.match(/MONACO_VERSION=(.+)/)?.[1];
}

function readActualVersion(): string | undefined {
  return packageJson.dependencies?.['monaco-editor'];
}

function hasIncompatibleCodeium(): boolean {
  return Boolean(packageJson.dependencies?.['@codeium/react-code-editor']);
}

function main() {
  const expectedVersion = readExpectedVersion();
  const actualVersion = readActualVersion();

  console.log('🔒 Checking Monaco Editor version...');
  console.log(`Expected: ${expectedVersion ?? 'unknown'}`);
  console.log(`Actual: ${actualVersion ?? 'unknown'}`);

  let failed = false;

  if (!expectedVersion) {
    console.error('\n❌ ERROR: Unable to determine expected Monaco version.');
    console.error('Ensure .monaco-version-lock contains MONACO_VERSION=...');
    failed = true;
  }

  if (expectedVersion && actualVersion && actualVersion !== expectedVersion) {
    console.error('\n❌ ERROR: Monaco version mismatch!');
    console.error(`Expected: ${expectedVersion}`);
    console.error(`Got: ${actualVersion}`);
    console.error('\nIf you need to change Monaco version:');
    console.error('1. Update .monaco-version-lock');
    console.error('2. Run: node scripts/verify-monacopilot.js');
    console.error('3. Update tests and documentation');
    failed = true;
  }

  if (hasIncompatibleCodeium()) {
    console.error('\n❌ ERROR: Incompatible package detected!');
    console.error('@codeium/react-code-editor is incompatible with our Monaco build.');
    console.error('Use Monacopilot instead - it is maintained and compatible.');
    console.error('\nTo fix: npm uninstall @codeium/react-code-editor');
    failed = true;
  }

  if (failed) {
    console.error('\n🛑 Commit blocked. Fix the issues above.\n');
    process.exit(1);
  }

  console.log('✅ Monaco version check passed!\n');
  process.exit(0);
}

main();
