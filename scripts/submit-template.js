#!/usr/bin/env node

/**
 * Template Submission Script
 * Helps community contributors submit environment templates
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { validateTemplate } = require('./validate-template.js');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'cyan') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return result ? result.trim() : '';
  } catch (error) {
    if (!options.allowFailure) {
      throw error;
    }
    return null;
  }
}

function showHelp() {
  log('\nTemplate Submission Helper', 'blue');
  log('===========================\n', 'blue');

  log('Usage:', 'cyan');
  log('  node scripts/submit-template.js <template-path> [options]\n');

  log('Arguments:', 'cyan');
  log('  template-path    Path to your template directory (required)');
  log('                   Example: config/templates/python/my-template\n');

  log('Options:', 'cyan');
  log('  --help           Show this help message');
  log('  --no-branch      Skip creating a new git branch');
  log('  --no-commit      Skip committing changes (validation only)');
  log('  --branch-name    Custom branch name (default: template/<template-name>)\n');

  log('Examples:', 'cyan');
  log('  # Validate and submit a new template');
  log('  node scripts/submit-template.js config/templates/python/my-ml-template\n');

  log('  # Validate only (no git operations)');
  log('  node scripts/submit-template.js config/templates/react/my-app --no-commit\n');

  log('  # Use custom branch name');
  log('  node scripts/submit-template.js config/templates/go/my-service --branch-name feature/new-go-template\n');

  log('What this script does:', 'yellow');
  log('  1. Validates your template structure and metadata');
  log('  2. Creates a new git branch for your submission');
  log('  3. Stages and commits your template files');
  log('  4. Provides instructions for creating a pull request\n');
}

function checkGitRepository() {
  log('Checking git repository...', 'blue');

  try {
    runCommand('git rev-parse --git-dir', { silent: true });
    log('Git repository found ✓', 'green');
    return true;
  } catch (error) {
    log('ERROR: Not in a git repository', 'red');
    log('Please initialize git first:', 'yellow');
    log('  git init', 'yellow');
    log('  git remote add origin <repository-url>', 'yellow');
    return false;
  }
}

function checkGitStatus() {
  log('Checking git status...', 'blue');

  try {
    const status = runCommand('git status --porcelain', { silent: true });

    // Check if there are uncommitted changes outside of the template directory
    if (status) {
      log('WARNING: You have uncommitted changes in your working directory', 'yellow');
      log('This script will only commit template files', 'yellow');
    }

    return true;
  } catch (error) {
    log('WARNING: Could not check git status', 'yellow');
    return false;
  }
}

function createBranch(branchName) {
  log(`\nCreating branch: ${branchName}`, 'blue');

  try {
    // Check if branch already exists
    const branches = runCommand('git branch --list', { silent: true });
    if (branches.includes(branchName)) {
      log(`Branch "${branchName}" already exists`, 'yellow');

      // Ask if we should switch to it or create a new one
      log('Switching to existing branch...', 'yellow');
      runCommand(`git checkout ${branchName}`, { silent: true });
      log(`Switched to branch: ${branchName} ✓`, 'green');
      return true;
    }

    // Create and switch to new branch
    runCommand(`git checkout -b ${branchName}`, { silent: true });
    log(`Created and switched to branch: ${branchName} ✓`, 'green');
    return true;

  } catch (error) {
    log('ERROR: Failed to create branch', 'red');
    log(error.message, 'red');
    return false;
  }
}

function commitTemplate(templatePath) {
  log('\nCommitting template files...', 'blue');

  const absolutePath = path.resolve(templatePath);
  const templateName = path.basename(absolutePath);

  try {
    // Stage all files in the template directory
    runCommand(`git add "${templatePath}"`, { silent: true });

    // Check if there are files to commit
    const staged = runCommand('git diff --cached --name-only', { silent: true });
    if (!staged) {
      log('No changes to commit (template files may already be committed)', 'yellow');
      return true;
    }

    log('Staged files:', 'cyan');
    staged.split('\n').forEach(file => {
      log(`  ${file}`, 'cyan');
    });

    // Create commit message
    const commitMessage = `Add ${templateName} environment template

This template provides:
- Pre-configured environment for ${templateName}
- Monitoring and resource configuration
- Documentation and usage examples

Co-Authored-By: Community Contributor <community@vibecode.dev>`;

    // Commit the changes
    runCommand(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { silent: false });

    log('\nTemplate committed successfully ✓', 'green');
    return true;

  } catch (error) {
    log('ERROR: Failed to commit template', 'red');
    log(error.message, 'red');
    return false;
  }
}

function showNextSteps(branchName, templatePath) {
  const templateName = path.basename(path.resolve(templatePath));

  log('\n' + '='.repeat(60), 'cyan');
  log('Template Submission Ready! 🎉', 'green');
  log('='.repeat(60), 'cyan');

  log('\nNext steps:', 'blue');
  log('  1. Push your branch to GitHub:', 'cyan');
  log(`     git push -u origin ${branchName}\n`, 'yellow');

  log('  2. Create a Pull Request:', 'cyan');
  log('     - Go to your repository on GitHub', 'yellow');
  log('     - Click "Compare & pull request"', 'yellow');
  log('     - Use the template contribution PR template', 'yellow');
  log('     - Fill in the checklist and description\n', 'yellow');

  log('  3. Wait for review:', 'cyan');
  log('     - Maintainers will review your template', 'yellow');
  log('     - Address any feedback or requested changes', 'yellow');
  log('     - Once approved, your template will be merged!\n', 'yellow');

  log('PR Title Suggestion:', 'cyan');
  log(`  Add ${templateName} environment template\n`, 'yellow');

  log('Thank you for contributing to VibeCode! 🚀', 'green');
  log('='.repeat(60) + '\n', 'cyan');
}

function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options = {
    help: args.includes('--help'),
    noBranch: args.includes('--no-branch'),
    noCommit: args.includes('--no-commit'),
    branchName: null,
    templatePath: null
  };

  // Get custom branch name if provided
  const branchNameIndex = args.indexOf('--branch-name');
  if (branchNameIndex !== -1 && args[branchNameIndex + 1]) {
    options.branchName = args[branchNameIndex + 1];
  }

  // Get template path (first non-option argument)
  for (const arg of args) {
    if (!arg.startsWith('--') && arg !== options.branchName) {
      options.templatePath = arg;
      break;
    }
  }

  // Show help if requested or no arguments
  if (options.help || args.length === 0) {
    showHelp();
    process.exit(0);
  }

  // Validate template path
  if (!options.templatePath) {
    log('ERROR: Template path is required', 'red');
    log('Usage: node scripts/submit-template.js <template-path>', 'yellow');
    log('Use --help for more information', 'yellow');
    process.exit(1);
  }

  // Start submission workflow
  log('\n' + '='.repeat(60), 'cyan');
  log('VibeCode Template Submission Workflow', 'blue');
  log('='.repeat(60) + '\n', 'cyan');

  // Step 1: Validate template
  log('Step 1: Validating template...', 'blue');
  log('---\n');

  const isValid = validateTemplate(options.templatePath);
  if (!isValid) {
    log('\nSubmission aborted due to validation errors', 'red');
    log('Please fix the errors above and try again', 'yellow');
    process.exit(1);
  }

  // Exit here if --no-commit is specified
  if (options.noCommit) {
    log('\nValidation complete! (--no-commit specified)', 'green');
    log('No git operations performed', 'yellow');
    process.exit(0);
  }

  // Step 2: Check git repository
  log('\nStep 2: Checking git repository...', 'blue');
  log('---\n');

  if (!checkGitRepository()) {
    process.exit(1);
  }

  checkGitStatus();

  // Step 3: Create branch (unless --no-branch)
  if (!options.noBranch) {
    log('\nStep 3: Creating git branch...', 'blue');
    log('---\n');

    const templateName = path.basename(path.resolve(options.templatePath));
    const branchName = options.branchName || `template/${templateName}`;

    if (!createBranch(branchName)) {
      log('\nFailed to create branch', 'red');
      log('You can continue manually or use --no-branch', 'yellow');
      process.exit(1);
    }

    options.actualBranchName = branchName;
  } else {
    // Get current branch name
    try {
      options.actualBranchName = runCommand('git branch --show-current', { silent: true });
    } catch (error) {
      options.actualBranchName = 'current';
    }
  }

  // Step 4: Commit template
  log('\nStep 4: Committing template...', 'blue');
  log('---\n');

  if (!commitTemplate(options.templatePath)) {
    log('\nFailed to commit template', 'red');
    process.exit(1);
  }

  // Step 5: Show next steps
  showNextSteps(options.actualBranchName, options.templatePath);
}

if (require.main === module) {
  main();
}

module.exports = { showHelp, checkGitRepository, createBranch, commitTemplate };
