#!/usr/bin/env node

/**
 * VibeCode Quick Start Orchestration Script
 *
 * Provides a streamlined onboarding experience that gets users
 * to a productive state in under 5 minutes.
 *
 * Orchestrates:
 * 1. First-run detection
 * 2. Development environment setup (if needed)
 * 3. Service launch
 * 4. Onboarding wizard opening
 * 5. Time-to-completion tracking
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const firstRun = require('./check-first-run.js');

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

// Logging utilities with structured output
const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  error: (msg) => console.error(`${colors.red}✗ ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.blue}${colors.bold}▶ ${msg}${colors.reset}`),
  section: (msg) => {
    console.log('\n' + colors.magenta + '═'.repeat(60));
    console.log(`  ${msg}`);
    console.log('═'.repeat(60) + colors.reset);
  }
};

/**
 * Parse command-line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    help: args.includes('--help') || args.includes('-h'),
    skipSetup: args.includes('--skip-setup'),
    skipLaunch: args.includes('--skip-launch')
  };
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
${colors.bold}VibeCode Quick Start${colors.reset}

${colors.cyan}USAGE:${colors.reset}
  node scripts/quickstart.js [OPTIONS]
  npm run quickstart [-- OPTIONS]

${colors.cyan}OPTIONS:${colors.reset}
  --dry-run, -n      Show execution plan without running
  --skip-setup       Skip development environment setup
  --skip-launch      Skip service launch (setup only)
  --help, -h         Show this help message

${colors.cyan}DESCRIPTION:${colors.reset}
  Streamlined onboarding that gets you productive in under 5 minutes.

  For first-time users:
    1. Checks Node.js version and dependencies
    2. Sets up development environment (.env, etc.)
    3. Launches VibeCode services
    4. Opens onboarding wizard
    5. Tracks time-to-completion

  For returning users:
    - Skips setup steps
    - Launches services directly

${colors.cyan}EXAMPLES:${colors.reset}
  ${colors.yellow}# Run complete quick-start flow${colors.reset}
  npm run quickstart

  ${colors.yellow}# Preview what will happen${colors.reset}
  npm run quickstart -- --dry-run

  ${colors.yellow}# Setup environment only (no launch)${colors.reset}
  npm run quickstart -- --skip-launch
`);
}

/**
 * Check if Node.js version meets requirements
 */
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  if (majorVersion < 18) {
    log.error(`Node.js 18+ is required (current: ${nodeVersion})`);
    log.info('Please upgrade Node.js or use nvm:');
    log.info('  nvm install 20.11.0');
    log.info('  nvm use 20.11.0');
    return false;
  }

  if (majorVersion >= 25) {
    log.warn(`Node.js ${nodeVersion} is not fully tested`);
    log.info('Recommended version: 20.11.0');
  }

  return true;
}

/**
 * Run setup-development.js for first-time setup
 */
function runSetup(dryRun) {
  const setupScript = path.join(__dirname, 'setup-development.js');

  if (!fs.existsSync(setupScript)) {
    log.warn('Setup script not found, skipping setup');
    return true;
  }

  if (dryRun) {
    log.info('Would run: node scripts/setup-development.js');
    log.info('  - Check Node.js version compatibility');
    log.info('  - Setup environment file (.env template)');
    log.info('  - Fix Tailwind CSS v4 configuration');
    log.info('  - Check Docker configuration');
    log.info('  - Verify optional dependencies');
    log.info('  - Validate setup completion');
    return true;
  }

  try {
    log.step('Running development environment setup...');
    execSync(`node "${setupScript}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    log.success('Development environment setup completed');
    return true;
  } catch (error) {
    log.error('Setup failed: ' + error.message);
    return false;
  }
}

/**
 * Launch VibeCode services
 */
function launchServices(dryRun) {
  const launcherScript = path.join(__dirname, '..', 'launcher.js');

  if (!fs.existsSync(launcherScript)) {
    log.warn('Launcher script not found, skipping service launch');
    return true;
  }

  if (dryRun) {
    log.info('Would run: node launcher.js');
    log.info('Would open: http://localhost:3000');
    return true;
  }

  try {
    log.step('Launching VibeCode services...');
    log.info('Starting frontend on http://localhost:3000');
    log.info('Press Ctrl+C to stop all services');

    // Spawn launcher in background
    const launcher = spawn('node', [launcherScript], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      detached: false
    });

    launcher.on('error', (error) => {
      log.error('Failed to launch services: ' + error.message);
    });

    // Wait a moment for services to start
    return new Promise((resolve) => {
      setTimeout(() => {
        log.success('Services launched');
        resolve(true);
      }, 2000);
    });
  } catch (error) {
    log.error('Launch failed: ' + error.message);
    return false;
  }
}

/**
 * Open onboarding wizard
 */
function openOnboarding(dryRun) {
  const onboardingUrl = 'http://localhost:3000/onboarding?mode=quick';

  if (dryRun) {
    log.info(`Would open: ${onboardingUrl}`);
    return true;
  }

  try {
    log.step('Opening onboarding wizard...');
    const platform = process.platform;
    let command;

    if (platform === 'darwin') {
      command = `open "${onboardingUrl}"`;
    } else if (platform === 'linux') {
      command = `xdg-open "${onboardingUrl}"`;
    } else if (platform === 'win32') {
      command = `start "${onboardingUrl}"`;
    } else {
      log.warn('Unable to open browser automatically on this platform');
      log.info(`Please open: ${onboardingUrl}`);
      return true;
    }

    execSync(command, { stdio: 'ignore' });
    log.success(`Onboarding wizard opened at ${onboardingUrl}`);
    return true;
  } catch (error) {
    log.warn('Could not open browser automatically');
    log.info(`Please open: ${onboardingUrl}`);
    return true;
  }
}

/**
 * Show execution plan in dry-run mode
 */
function showExecutionPlan(isFirst) {
  log.section('Quick Start Execution Plan');

  console.log(`
${colors.cyan}First-time user:${colors.reset} ${isFirst ? 'Yes' : 'No'}

${colors.cyan}Steps to execute:${colors.reset}
`);

  let stepNum = 1;

  console.log(`  ${stepNum++}. ${colors.yellow}Check Node.js version${colors.reset}`);
  console.log(`      Verify Node.js 18+ is installed\n`);

  if (isFirst) {
    console.log(`  ${stepNum++}. ${colors.yellow}Run development setup${colors.reset}`);
    console.log(`      Execute: node scripts/setup-development.js`);
    console.log(`      - Check Node.js version compatibility`);
    console.log(`      - Setup environment file (.env template)`);
    console.log(`      - Fix Tailwind CSS v4 configuration`);
    console.log(`      - Check Docker configuration`);
    console.log(`      - Verify optional dependencies (sharp, lightningcss)`);
    console.log(`      - Validate setup completion`);
    console.log(`      - Display next steps\n`);
  }

  console.log(`  ${stepNum++}. ${colors.yellow}Install dependencies${colors.reset}`);
  console.log(`      Run: npm install\n`);

  console.log(`  ${stepNum++}. ${colors.yellow}Launch VibeCode services${colors.reset}`);
  console.log(`      - Start frontend (http://localhost:3000)`);
  console.log(`      - Start backend services (if available)\n`);

  if (isFirst) {
    console.log(`  ${stepNum++}. ${colors.yellow}Open onboarding wizard${colors.reset}`);
    console.log(`      Open: http://localhost:3000/onboarding?mode=quick\n`);
  }

  console.log(`  ${stepNum++}. ${colors.yellow}Track completion time${colors.reset}`);
  console.log(`      Target: Under 5 minutes\n`);

  console.log(`${colors.cyan}Estimated time:${colors.reset} ${isFirst ? '4-5 minutes' : '1-2 minutes'}`);
  console.log(`${colors.cyan}Services:${colors.reset} Frontend${isFirst ? ', Onboarding Wizard' : ''}`);

  if (isFirst) {
    console.log(`${colors.cyan}Output:${colors.reset} Sample project at ~/vibecode-sample`);
  }

  console.log(`\n${colors.green}Run without --dry-run to execute${colors.reset}\n`);
}

/**
 * Track and display elapsed time
 */
function formatElapsedTime(startTime) {
  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Main orchestration function
 */
async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const startTime = Date.now();

  log.section('VibeCode Quick Start');

  // Step 1: Check if this is the first run
  log.step('Checking first-run status...');
  const isFirst = firstRun.isFirstRun();

  if (isFirst) {
    log.info('First-time user detected');
    if (!args.dryRun) {
      firstRun.createFirstRunMarker();
    }
  } else {
    log.info('Welcome back!');
  }

  // Dry-run mode: show plan and exit
  if (args.dryRun) {
    showExecutionPlan(isFirst);
    process.exit(0);
  }

  // Step 2: Check Node.js version
  log.step('Checking Node.js version...');
  if (!checkNodeVersion()) {
    process.exit(1);
  }
  log.success(`Node.js ${process.version} is compatible`);

  // Step 3: Run setup for first-time users
  if (isFirst && !args.skipSetup) {
    if (!runSetup(args.dryRun)) {
      log.error('Setup failed. Please fix errors and try again.');
      process.exit(1);
    }
  } else if (args.skipSetup) {
    log.info('Skipping setup (--skip-setup flag)');
  }

  // Step 4: Install dependencies
  log.step('Installing dependencies...');
  try {
    execSync('npm install', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    log.success('Dependencies installed');
  } catch (error) {
    log.error('Failed to install dependencies');
    log.error(error.message);
    process.exit(1);
  }

  // Step 5: Launch services
  if (!args.skipLaunch) {
    await launchServices(args.dryRun);

    // Step 6: Open onboarding for first-time users
    if (isFirst) {
      // Wait a bit more for services to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      openOnboarding(args.dryRun);
    }
  } else {
    log.info('Skipping service launch (--skip-launch flag)');
  }

  // Step 7: Show completion summary
  const elapsed = formatElapsedTime(startTime);
  log.section('Quick Start Complete');
  log.success(`Total time: ${elapsed}`);

  if (isFirst) {
    console.log(`
${colors.cyan}Next steps:${colors.reset}
  1. Complete the onboarding wizard (http://localhost:3000/onboarding)
  2. Try AI code completion in the sample project
  3. Explore VibeCode features

${colors.cyan}Useful commands:${colors.reset}
  ${colors.yellow}npm run dev${colors.reset}       Start development server
  ${colors.yellow}npm run build${colors.reset}     Build for production
  ${colors.yellow}npm test${colors.reset}          Run tests

${colors.green}Happy coding with VibeCode! 🚀${colors.reset}
`);
  } else {
    console.log(`
${colors.cyan}Services running:${colors.reset}
  Frontend: ${colors.yellow}http://localhost:3000${colors.reset}

${colors.green}VibeCode is ready! 🚀${colors.reset}
`);
  }

  // Keep process running if we launched services
  if (!args.skipLaunch) {
    log.info('Press Ctrl+C to stop all services');
  }
}

// Run main function
if (require.main === module) {
  main().catch((error) => {
    log.error('Quick start failed: ' + error.message);
    console.error(error);
    process.exit(1);
  });
}

// Export for testing
module.exports = {
  checkNodeVersion,
  parseArgs,
  formatElapsedTime
};
