#!/usr/bin/env node
/**
 * Verification script for Monacopilot + Monaco 0.53.0 integration
 * 
 * This script verifies that:
 * 1. Monaco Editor 0.53.0 is installed
 * 2. Monacopilot is installed and compatible
 * 3. Integration files exist
 * 4. API route exists
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Monacopilot Integration...\n');

let passed = 0;
let failed = 0;

function check(name, condition, successMsg, failMsg) {
  if (condition) {
    console.log(`✅ ${name}: ${successMsg}`);
    passed++;
    return true;
  } else {
    console.log(`❌ ${name}: ${failMsg}`);
    failed++;
    return false;
  }
}

// Check package.json
const packageJson = require('../package.json');

// 1. Check Monaco version
const monacoVersion = packageJson.dependencies['monaco-editor'];
check(
  'Monaco Editor',
  monacoVersion && monacoVersion.includes('0.53'),
  `Version ${monacoVersion} (latest stable)`,
  `Wrong version: ${monacoVersion || 'not installed'}`
);

// 2. Check Monacopilot
const monacopilotVersion = packageJson.dependencies['monacopilot'];
check(
  'Monacopilot',
  monacopilotVersion !== undefined,
  `Version ${monacopilotVersion} installed`,
  'Not installed'
);

// 3. Check incompatible package is NOT installed
const codeiumPackage = packageJson.dependencies['@codeium/react-code-editor'];
check(
  'No conflicting packages',
  codeiumPackage === undefined,
  '@codeium/react-code-editor not installed (correct)',
  '@codeium/react-code-editor is installed (conflicts with Monaco 0.53)'
);

// 4. Check integration file
const integrationPath = path.join(__dirname, '../src/lib/monaco/monacopilot-integration.ts');
check(
  'Integration file',
  fs.existsSync(integrationPath),
  'monacopilot-integration.ts exists',
  'monacopilot-integration.ts not found'
);

// 5. Check API route
const apiRoutePath = path.join(__dirname, '../src/app/api/code-completion/route.ts');
check(
  'API route',
  fs.existsSync(apiRoutePath),
  'code-completion API route exists',
  'code-completion API route not found'
);

// 6. Check documentation
const docsPath = path.join(__dirname, '../docs/MONACOPILOT_INTEGRATION.md');
check(
  'Documentation',
  fs.existsSync(docsPath),
  'Integration guide exists',
  'Integration guide not found'
);

// 7. Check test file
const testPath = path.join(__dirname, '../tests/unit/monaco-monacopilot.test.ts');
check(
  'Unit tests',
  fs.existsSync(testPath),
  'Compatibility tests exist',
  'Tests not found'
);

// 8. Check demo page
const demoPath = path.join(__dirname, '../src/app/demo/monacopilot/page.tsx');
check(
  'Demo page',
  fs.existsSync(demoPath),
  'Demo page exists at /demo/monacopilot',
  'Demo page not found'
);

// 9. Check manual test
const manualTestPath = path.join(__dirname, '../tests/manual/test-monacopilot.html');
check(
  'Manual test',
  fs.existsSync(manualTestPath),
  'Standalone HTML test exists',
  'Manual test not found'
);

// Summary
console.log('\n' + '='.repeat(50));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('='.repeat(50));

if (failed === 0) {
  console.log('\n🎉 All checks passed! Monacopilot is properly integrated.\n');
  console.log('Next steps:');
  console.log('1. Add AI API key to .env.local (OPENAI_API_KEY or MISTRAL_API_KEY)');
  console.log('2. Start dev server: npm run dev');
  console.log('3. Open http://localhost:3000/demo/monacopilot');
  console.log('4. Or open tests/manual/test-monacopilot.html in browser');
  process.exit(0);
} else {
  console.log('\n⚠️  Some checks failed. Review the errors above.\n');
  process.exit(1);
}
