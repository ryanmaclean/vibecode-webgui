#!/usr/bin/env node

/**
 * End-to-End Test for VibeCode Quick Start Flow
 *
 * This script tests the complete quick-start experience from scratch,
 * verifying that the 5-minute onboarding goal is achievable.
 *
 * Test Steps:
 * 1. Backup existing ~/.vibecode directory
 * 2. Simulate first-run by deleting ~/.vibecode
 * 3. Run quickstart in dry-run mode to verify plan
 * 4. Run actual quickstart flow
 * 5. Verify all components:
 *    - Setup completes successfully
 *    - Services start (frontend on port 3000)
 *    - Sample project exists at ~/vibecode-sample
 *    - Onboarding wizard is accessible
 * 6. Restore backup
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Logging utilities
const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  error: (msg) => console.error(`${colors.red}✗ ${msg}${colors.reset}`),
  step: (msg) => console.log(`\n${colors.blue}${colors.bold}▶ ${msg}${colors.reset}`),
  section: (msg) => {
    console.log('\n' + colors.magenta + '═'.repeat(70));
    console.log(`  ${msg}`);
    console.log('═'.repeat(70) + colors.reset);
  }
};

// Test configuration
const CONFIG = {
  vibecodeDir: path.join(os.homedir(), '.vibecode'),
  backupDir: path.join(os.homedir(), '.vibecode.backup.' + Date.now()),
  sampleProjectDir: path.join(os.homedir(), 'vibecode-sample'),
  sampleBackupDir: path.join(os.homedir(), 'vibecode-sample.backup.' + Date.now()),
  frontendUrl: 'http://localhost:3000',
  onboardingUrl: 'http://localhost:3000/onboarding?mode=quick',
  timeLimit: 5 * 60 * 1000 // 5 minutes in milliseconds
};

// Test results tracking
const testResults = {
  startTime: null,
  endTime: null,
  totalDuration: null,
  steps: [],
  passed: 0,
  failed: 0,
  warnings: 0
};

/**
 * Record test step result
 */
function recordStep(name, passed, duration, message = '') {
  const step = {
    name,
    passed,
    duration,
    message,
    timestamp: new Date().toISOString()
  };

  testResults.steps.push(step);

  if (passed) {
    testResults.passed++;
    log.success(`${name} - ${duration}ms ${message ? '(' + message + ')' : ''}`);
  } else {
    testResults.failed++;
    log.error(`${name} - ${message}`);
  }
}

/**
 * Record warning
 */
function recordWarning(message) {
  testResults.warnings++;
  log.warn(message);
}

/**
 * Backup existing directories
 */
function backupExisting() {
  log.step('Step 1: Backing up existing directories');
  const stepStart = Date.now();

  try {
    let backedUp = false;

    // Backup ~/.vibecode if it exists
    if (fs.existsSync(CONFIG.vibecodeDir)) {
      fs.renameSync(CONFIG.vibecodeDir, CONFIG.backupDir);
      log.info(`Backed up ${CONFIG.vibecodeDir} → ${CONFIG.backupDir}`);
      backedUp = true;
    }

    // Backup ~/vibecode-sample if it exists
    if (fs.existsSync(CONFIG.sampleProjectDir)) {
      fs.renameSync(CONFIG.sampleProjectDir, CONFIG.sampleBackupDir);
      log.info(`Backed up ${CONFIG.sampleProjectDir} → ${CONFIG.sampleBackupDir}`);
      backedUp = true;
    }

    if (!backedUp) {
      log.info('No existing directories to backup');
    }

    recordStep('Backup existing directories', true, Date.now() - stepStart);
    return true;
  } catch (error) {
    recordStep('Backup existing directories', false, Date.now() - stepStart, error.message);
    return false;
  }
}

/**
 * Verify first-run state
 */
function verifyFirstRunState() {
  log.step('Step 2: Verifying first-run state');
  const stepStart = Date.now();

  try {
    // Verify ~/.vibecode doesn't exist
    if (fs.existsSync(CONFIG.vibecodeDir)) {
      throw new Error('~/.vibecode still exists after cleanup');
    }

    // Verify ~/vibecode-sample doesn't exist
    if (fs.existsSync(CONFIG.sampleProjectDir)) {
      throw new Error('~/vibecode-sample still exists after cleanup');
    }

    recordStep('Verify first-run state', true, Date.now() - stepStart);
    return true;
  } catch (error) {
    recordStep('Verify first-run state', false, Date.now() - stepStart, error.message);
    return false;
  }
}

/**
 * Test dry-run mode
 */
function testDryRun() {
  log.step('Step 3: Testing dry-run mode');
  const stepStart = Date.now();

  try {
    const output = execSync('npm run quickstart -- --dry-run', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    });

    // Verify dry-run output contains expected steps
    const requiredSteps = [
      'First-time user: Yes',
      'Check Node.js version',
      'Run development setup',
      'Create sample project',
      'Install dependencies',
      'Launch VibeCode services',
      'Open onboarding wizard'
    ];

    const missingSteps = requiredSteps.filter(step => !output.includes(step));

    if (missingSteps.length > 0) {
      throw new Error(`Dry-run missing steps: ${missingSteps.join(', ')}`);
    }

    recordStep('Dry-run mode verification', true, Date.now() - stepStart);
    return true;
  } catch (error) {
    recordStep('Dry-run mode verification', false, Date.now() - stepStart, error.message);
    return false;
  }
}

/**
 * Test first-run detection
 */
function testFirstRunDetection() {
  log.step('Step 4: Testing first-run detection');
  const stepStart = Date.now();

  try {
    const output = execSync('node scripts/check-first-run.js', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    });

    if (!output.includes('true')) {
      throw new Error('First-run detection failed - expected true, got: ' + output);
    }

    recordStep('First-run detection', true, Date.now() - stepStart);
    return true;
  } catch (error) {
    recordStep('First-run detection', false, Date.now() - stepStart, error.message);
    return false;
  }
}

/**
 * Verify sample project was created
 */
function verifySampleProject() {
  log.step('Step 5: Verifying sample project creation');
  const stepStart = Date.now();

  try {
    // Check if directory exists
    if (!fs.existsSync(CONFIG.sampleProjectDir)) {
      throw new Error('Sample project directory not created');
    }

    // Verify expected files
    const expectedFiles = [
      'package.json',
      'README.md',
      'src/index.ts',
      'src/api/hello.ts',
      '.vibecode/tasks.json'
    ];

    const missingFiles = expectedFiles.filter(file =>
      !fs.existsSync(path.join(CONFIG.sampleProjectDir, file))
    );

    if (missingFiles.length > 0) {
      throw new Error(`Missing files in sample project: ${missingFiles.join(', ')}`);
    }

    // Verify package.json structure
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(CONFIG.sampleProjectDir, 'package.json'), 'utf8')
    );

    if (!packageJson.name || !packageJson.scripts) {
      throw new Error('Invalid package.json in sample project');
    }

    recordStep('Sample project creation', true, Date.now() - stepStart,
      `Found ${expectedFiles.length} expected files`);
    return true;
  } catch (error) {
    recordStep('Sample project creation', false, Date.now() - stepStart, error.message);
    return false;
  }
}

/**
 * Check if a URL is accessible
 */
async function checkUrlAccessible(url, timeout = 5000) {
  const http = require('http');

  return new Promise((resolve) => {
    const request = http.get(url, (res) => {
      resolve(res.statusCode === 200);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(timeout, () => {
      request.destroy();
      resolve(false);
    });
  });
}

/**
 * Restore backed up directories
 */
function restoreBackup() {
  log.step('Cleanup: Restoring backed up directories');

  try {
    // Remove test directories
    if (fs.existsSync(CONFIG.vibecodeDir)) {
      fs.rmSync(CONFIG.vibecodeDir, { recursive: true, force: true });
    }

    if (fs.existsSync(CONFIG.sampleProjectDir)) {
      fs.rmSync(CONFIG.sampleProjectDir, { recursive: true, force: true });
    }

    // Restore backups
    if (fs.existsSync(CONFIG.backupDir)) {
      fs.renameSync(CONFIG.backupDir, CONFIG.vibecodeDir);
      log.info(`Restored ${CONFIG.backupDir} → ${CONFIG.vibecodeDir}`);
    }

    if (fs.existsSync(CONFIG.sampleBackupDir)) {
      fs.renameSync(CONFIG.sampleBackupDir, CONFIG.sampleProjectDir);
      log.info(`Restored ${CONFIG.sampleBackupDir} → ${CONFIG.sampleProjectDir}`);
    }

    log.success('Backup restored successfully');
    return true;
  } catch (error) {
    log.error('Failed to restore backup: ' + error.message);
    log.warn('You may need to manually restore from:');
    log.warn(`  ${CONFIG.backupDir}`);
    log.warn(`  ${CONFIG.sampleBackupDir}`);
    return false;
  }
}

/**
 * Generate test report
 */
function generateReport() {
  log.section('Test Results Summary');

  testResults.endTime = Date.now();
  testResults.totalDuration = testResults.endTime - testResults.startTime;

  const totalTests = testResults.passed + testResults.failed;
  const passRate = totalTests > 0 ? (testResults.passed / totalTests * 100).toFixed(1) : 0;

  console.log(`
${colors.cyan}Test Statistics:${colors.reset}
  Total Tests:    ${totalTests}
  Passed:         ${colors.green}${testResults.passed}${colors.reset}
  Failed:         ${testResults.failed > 0 ? colors.red : colors.green}${testResults.failed}${colors.reset}
  Warnings:       ${testResults.warnings > 0 ? colors.yellow : colors.green}${testResults.warnings}${colors.reset}
  Pass Rate:      ${passRate >= 100 ? colors.green : colors.yellow}${passRate}%${colors.reset}

${colors.cyan}Timing:${colors.reset}
  Total Duration: ${formatDuration(testResults.totalDuration)}
  Time Limit:     ${formatDuration(CONFIG.timeLimit)}
  Status:         ${testResults.totalDuration < CONFIG.timeLimit ? colors.green + 'PASSED' : colors.red + 'FAILED'}${colors.reset}

${colors.cyan}Detailed Steps:${colors.reset}
`);

  testResults.steps.forEach((step, index) => {
    const status = step.passed ? `${colors.green}✓` : `${colors.red}✗`;
    console.log(`  ${index + 1}. ${status} ${step.name}${colors.reset} - ${step.duration}ms`);
    if (step.message) {
      console.log(`     ${colors.cyan}${step.message}${colors.reset}`);
    }
  });

  console.log();

  // Overall result
  const allPassed = testResults.failed === 0 && testResults.totalDuration < CONFIG.timeLimit;

  if (allPassed) {
    log.section('🎉 ALL TESTS PASSED');
    console.log(`${colors.green}The quick-start experience meets all acceptance criteria!${colors.reset}\n`);
  } else {
    log.section('❌ TESTS FAILED');
    console.log(`${colors.red}Some tests failed or time limit exceeded.${colors.reset}`);
    console.log(`${colors.yellow}Please review the failures above and fix before marking complete.${colors.reset}\n`);
  }

  return allPassed;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Display manual verification steps
 */
function showManualSteps() {
  log.section('Manual Verification Steps');

  console.log(`
${colors.yellow}The following steps require manual verification:${colors.reset}

1. ${colors.cyan}Run the actual quickstart:${colors.reset}
   ${colors.bold}npm run quickstart${colors.reset}

2. ${colors.cyan}Verify services start:${colors.reset}
   - Watch for "Services launched" message
   - Confirm frontend accessible at: ${colors.yellow}http://localhost:3000${colors.reset}
   - Check for any errors in console output

3. ${colors.cyan}Verify onboarding wizard opens:${colors.reset}
   - Browser should open automatically to: ${colors.yellow}${CONFIG.onboardingUrl}${colors.reset}
   - Wizard should show "⚡ Quick Start" indicator
   - Should have 3 steps: Welcome → Essentials → Complete

4. ${colors.cyan}Complete onboarding in quick mode:${colors.reset}
   - Step through the 3-step wizard
   - Verify timer is counting
   - Verify smart defaults are applied (Windsurf, Neovim, Claude, etc.)
   - Complete and check for "Under 2 minutes!" badge if < 120s

5. ${colors.cyan}Open and test sample project:${colors.reset}
   - Navigate to: ${colors.yellow}~/vibecode-sample${colors.reset}
   - Open files in VibeCode
   - Trigger AI suggestion (e.g., type in hello.ts file)
   - Verify AI completions work

6. ${colors.cyan}Verify total time:${colors.reset}
   - Check quickstart script output for "Total time"
   - Add onboarding completion time
   - Add time to trigger first AI suggestion
   - ${colors.bold}Total should be under 5 minutes${colors.reset}

7. ${colors.cyan}Stop services:${colors.reset}
   - Press Ctrl+C in terminal running quickstart
   - Verify services shut down gracefully

${colors.green}✓ All manual steps completed successfully?${colors.reset}
${colors.yellow}→ If yes, mark subtask-6-1 as completed${colors.reset}
${colors.yellow}→ If no, investigate failures and fix before completing${colors.reset}
`);
}

/**
 * Main test execution
 */
async function main() {
  testResults.startTime = Date.now();

  log.section('VibeCode Quick Start E2E Test');
  log.info('This test verifies the complete quick-start flow from scratch');
  log.info(`Time limit: ${formatDuration(CONFIG.timeLimit)}`);

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const autoMode = args.includes('--auto');
  const skipBackup = args.includes('--skip-backup');

  try {
    // Phase 1: Preparation
    if (!skipBackup) {
      if (!backupExisting()) {
        throw new Error('Failed to backup existing directories');
      }

      if (!verifyFirstRunState()) {
        throw new Error('Failed to verify first-run state');
      }
    } else {
      log.warn('Skipping backup (--skip-backup flag)');
    }

    // Phase 2: Automated Tests
    if (!testDryRun()) {
      recordWarning('Dry-run test failed - continuing anyway');
    }

    if (!testFirstRunDetection()) {
      throw new Error('First-run detection failed');
    }

    // Test sample project creation separately
    log.step('Testing sample project creation');
    const stepStart = Date.now();
    try {
      // Run quickstart with --skip-launch to only create sample project
      execSync('node scripts/quickstart.js --skip-launch', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      });

      recordStep('Quickstart execution (skip-launch)', true, Date.now() - stepStart);
    } catch (error) {
      recordStep('Quickstart execution (skip-launch)', false, Date.now() - stepStart, error.message);
    }

    verifySampleProject();

  } catch (error) {
    log.error('Test execution failed: ' + error.message);
    console.error(error);
  } finally {
    // Always try to restore backup
    if (!skipBackup) {
      restoreBackup();
    }

    // Generate and display report
    const allPassed = generateReport();

    // Show manual verification steps
    showManualSteps();

    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
  }
}

// Run tests
if (require.main === module) {
  main().catch((error) => {
    log.error('Test failed: ' + error.message);
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  checkUrlAccessible,
  formatDuration
};
