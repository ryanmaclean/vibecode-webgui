#!/usr/bin/env node
/**
 * Pre-commit check for Monaco Editor version
 * Prevents accidental downgrades
 */

const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');
const lockFile = fs.readFileSync(path.join(__dirname, '../.monaco-version-lock'), 'utf8');

// Extract expected version from lock file
const expectedVersion = lockFile.match(/MONACO_VERSION=(.+)/)?.[1];
const actualVersion = packageJson.dependencies['monaco-editor'];

// Check for incompatible packages
const hasCodeium = packageJson.dependencies['@codeium/react-code-editor'];

console.log('🔒 Checking Monaco Editor version...');
console.log(`Expected: ${expectedVersion}`);
console.log(`Actual: ${actualVersion}`);

let failed = false;

if (actualVersion !== expectedVersion) {
  console.error(`\n❌ ERROR: Monaco version mismatch!`);
  console.error(`Expected: ${expectedVersion}`);
  console.error(`Got: ${actualVersion}`);
  console.error(`\nIf you need to change Monaco version:`);
  console.error(`1. Update .monaco-version-lock`);
  console.error(`2. Run: node scripts/verify-monacopilot.js`);
  console.error(`3. Update tests and documentation`);
  failed = true;
}

if (hasCodeium) {
  console.error(`\n❌ ERROR: Incompatible package detected!`);
  console.error(`@codeium/react-code-editor is incompatible with Monaco ${expectedVersion}`);
  console.error(`Use Monacopilot instead - it's better and compatible.`);
  console.error(`\nTo fix: npm uninstall @codeium/react-code-editor`);
  failed = true;
}

if (failed) {
  console.error(`\n🛑 Commit blocked. Fix the issues above.\n`);
  process.exit(1);
}

console.log('✅ Monaco version check passed!\n');
process.exit(0);
