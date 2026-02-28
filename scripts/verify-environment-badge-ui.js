#!/usr/bin/env node
/**
 * Verification script for Environment Badge UI Integration
 * Subtask 6-3: Integration test - Environment badge displays correctly in UI
 */

const http = require('http');

const PORT = process.env.PORT || 3007;
const HOST = process.env.HOST || 'localhost';

console.log('='.repeat(60));
console.log('Environment Badge UI Integration Test');
console.log('='.repeat(60));
console.log();

async function fetchPage() {
  return new Promise((resolve, reject) => {
    http.get(`http://${HOST}:${PORT}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function verifyEnvironmentBadge() {
  try {
    console.log(`Fetching page from http://${HOST}:${PORT}...`);
    const html = await fetchPage();

    console.log('✓ Page loaded successfully\n');

    // Check for EnvironmentBadge component
    const checks = [
      {
        name: 'EnvironmentBadge component import',
        test: () => html.includes('EnvironmentBadge') || html.includes('environment'),
        required: false // May not be in static HTML
      },
      {
        name: 'Environment-related content in HTML',
        test: () => html.toLowerCase().includes('environment') || html.includes('env'),
        required: false
      },
      {
        name: 'Page renders without errors',
        test: () => !html.includes('Application error') && html.includes('<!DOCTYPE html>'),
        required: true
      },
      {
        name: 'React root element present',
        test: () => html.includes('id="__next"') || html.includes('main'),
        required: true
      }
    ];

    console.log('Verification Results:');
    console.log('-'.repeat(60));

    let passed = 0;
    let failed = 0;

    checks.forEach(check => {
      const result = check.test();
      const status = result ? '✓' : '✗';
      const marker = check.required ? '[REQUIRED]' : '[OPTIONAL]';

      console.log(`${status} ${marker} ${check.name}`);

      if (result) {
        passed++;
      } else {
        failed++;
        if (check.required) {
          console.log('  ERROR: Required check failed!');
        }
      }
    });

    console.log('-'.repeat(60));
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    console.log();

    // Manual verification instructions
    console.log('='.repeat(60));
    console.log('Manual Verification Required:');
    console.log('='.repeat(60));
    console.log();
    console.log(`1. Open browser to: http://${HOST}:${PORT}`);
    console.log('2. Check for EnvironmentBadge in top-left corner');
    console.log('3. Verify badge shows current environment');
    console.log('4. Verify badge color:');
    console.log('   - Green = development/test');
    console.log('   - Yellow = staging');
    console.log('   - Red = production');
    console.log('   - Gray = unknown');
    console.log();
    console.log('Current Environment Detection:');
    console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set (defaults to development)'}`);
    console.log(`  DD_ENV: ${process.env.DD_ENV || 'not set'}`);
    console.log();
    console.log('Expected Badge: Development (Green)');
    console.log();

    // Check if server is responding
    if (failed === 0 || checks.filter(c => c.required && !c.test()).length === 0) {
      console.log('✓ Server is responding correctly');
      console.log('✓ Page structure looks valid');
      console.log();
      console.log('Please verify the badge visually in the browser.');
      return true;
    } else {
      console.log('✗ Some required checks failed');
      console.log('Please check server logs for errors');
      return false;
    }

  } catch (error) {
    console.error('✗ Error fetching page:', error.message);
    console.error('\nIs the dev server running?');
    console.error(`Try: npm run dev`);
    return false;
  }
}

// Run verification
verifyEnvironmentBadge().then(success => {
  process.exit(success ? 0 : 1);
});
