#!/usr/bin/env node

/**
 * Verification Script: Environment Permissions Panel Integration
 *
 * This script verifies that the EnvironmentPermissionsPanel is properly
 * integrated into the Settings page and functions correctly.
 */

const http = require('http');

const BASE_URL = 'http://localhost:3007';
const SETTINGS_URL = `${BASE_URL}/settings`;

console.log('='.repeat(70));
console.log('Environment Permissions Panel Integration Verification');
console.log('='.repeat(70));
console.log('');

/**
 * Fetch HTML content from a URL
 */
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';

      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        console.log(`Following redirect to: ${res.headers.location}`);
        fetchHTML(res.headers.location.startsWith('http') ? res.headers.location : BASE_URL + res.headers.location)
          .then(resolve)
          .catch(reject);
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({ status: res.statusCode, html: data });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Verify the settings page loads
 */
async function verifyPageLoads() {
  console.log('1. Verifying Settings Page Loads');
  console.log('-'.repeat(70));

  try {
    const { status, html } = await fetchHTML(SETTINGS_URL);

    if (status === 200) {
      console.log('✅ Settings page loads successfully (HTTP 200)');
      return html;
    } else {
      console.log(`❌ Settings page returned HTTP ${status}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Failed to load settings page: ${error.message}`);
    return null;
  }
}

/**
 * Verify the Environment tab exists
 */
function verifyEnvironmentTab(html) {
  console.log('');
  console.log('2. Verifying Environment Tab');
  console.log('-'.repeat(70));

  // Check for environment tab trigger
  const hasEnvironmentTab = html.includes('value="environment"') ||
                            html.includes("value='environment'");

  if (hasEnvironmentTab) {
    console.log('✅ Environment tab found in settings');
  } else {
    console.log('❌ Environment tab not found in settings');
    return false;
  }

  return true;
}

/**
 * Verify EnvironmentPermissionsPanel components are present
 */
function verifyEnvironmentComponents(html) {
  console.log('');
  console.log('3. Verifying Environment Permissions Components');
  console.log('-'.repeat(70));

  const checks = [
    {
      name: 'Global Settings section',
      patterns: ['Global Settings', 'Environment Detection', 'Permission System']
    },
    {
      name: 'Environment tabs (Dev/Staging/Prod)',
      patterns: ['Development', 'Staging', 'Production']
    },
    {
      name: 'Permission controls',
      patterns: ['Default Permission', 'Fallback Environment']
    }
  ];

  let allPassed = true;

  checks.forEach(check => {
    const found = check.patterns.some(pattern => html.includes(pattern));
    if (found) {
      console.log(`✅ ${check.name} found`);
    } else {
      console.log(`❌ ${check.name} not found`);
      allPassed = false;
    }
  });

  return allPassed;
}

/**
 * Main verification function
 */
async function main() {
  try {
    // Step 1: Verify page loads
    const html = await verifyPageLoads();
    if (!html) {
      console.log('');
      console.log('⚠️  Cannot proceed with verification - page did not load');
      process.exit(1);
    }

    // Step 2: Verify environment tab
    const hasTab = verifyEnvironmentTab(html);

    // Step 3: Verify environment components
    const hasComponents = verifyEnvironmentComponents(html);

    // Summary
    console.log('');
    console.log('='.repeat(70));
    console.log('Verification Summary');
    console.log('='.repeat(70));

    if (hasTab && hasComponents) {
      console.log('✅ All checks passed!');
      console.log('');
      console.log('Manual Verification Steps:');
      console.log('1. Open http://localhost:3007/settings in your browser');
      console.log('2. Click the "Environment" tab');
      console.log('3. Verify the following:');
      console.log('   - Global settings toggles (Detection, Permissions, Badge, etc.)');
      console.log('   - Environment tabs (Development, Staging, Production)');
      console.log('   - Permission controls for each environment');
      console.log('   - Can toggle settings and see changes');
      console.log('   - Save button works and persists changes');
      console.log('');
      process.exit(0);
    } else {
      console.log('❌ Some checks failed');
      console.log('');
      console.log('Please review the integration and ensure:');
      console.log('- EnvironmentPermissionsPanel is imported in SettingsPanel.tsx');
      console.log('- Environment tab is added to TabsList');
      console.log('- TabsContent for environment includes EnvironmentPermissionsPanel');
      console.log('');
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('❌ Verification failed with error:');
    console.error(error);
    process.exit(1);
  }
}

main();
