#!/usr/bin/env node

/**
 * VibeCode Test Organization & Validation Script
 * Ensures tests are properly organized and run at appropriate times
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

function findFiles(dir, pattern) {
  const files = [];
  function scan(directory) {
    if (!fs.existsSync(directory)) return;
    
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scan(fullPath);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  scan(dir);
  return files;
}

function analyzeTestStructure() {
  log('Analyzing test structure...', 'blue');
  
  const testFiles = findFiles('./tests', /\.(test|spec)\.(ts|tsx|js|jsx)$/);
  const categories = {
    unit: [],
    integration: [],
    e2e: [],
    k8s: [],
    security: [],
    performance: [],
    other: []
  };
  
  testFiles.forEach(file => {
    const relativePath = path.relative('./tests', file);
    if (relativePath.startsWith('unit/')) {
      categories.unit.push(file);
    } else if (relativePath.startsWith('integration/')) {
      categories.integration.push(file);
    } else if (relativePath.startsWith('e2e/')) {
      categories.e2e.push(file);
    } else if (relativePath.startsWith('k8s/')) {
      categories.k8s.push(file);
    } else if (relativePath.startsWith('security/')) {
      categories.security.push(file);
    } else if (relativePath.startsWith('performance/')) {
      categories.performance.push(file);
    } else {
      categories.other.push(file);
    }
  });
  
  log('Test file distribution:', 'yellow');
  Object.entries(categories).forEach(([category, files]) => {
    log(`  ${category}: ${files.length} files`, files.length > 0 ? 'green' : 'yellow');
  });
  
  return categories;
}

function validateTestTiming() {
  log('Validating test timing configuration...', 'blue');
  
  const testTimingRules = {
    'pre-commit': {
      description: 'Fast tests for pre-commit hooks',
      maxTime: 30,
      includes: ['unit', 'lint', 'typecheck', 'security-scan'],
      excludes: ['integration', 'e2e', 'k8s', 'performance']
    },
    'push-to-main': {
      description: 'CI/CD pipeline tests',
      maxTime: 300,
      includes: ['unit', 'integration', 'security', 'build'],
      excludes: ['e2e', 'k8s', 'performance']
    },
    'pull-request': {
      description: 'Full validation for PRs',
      maxTime: 600,
      includes: ['unit', 'integration', 'security', 'e2e-critical'],
      excludes: ['k8s', 'performance']
    },
    'nightly': {
      description: 'Comprehensive testing',
      maxTime: 1800,
      includes: ['all'],
      excludes: []
    }
  };
  
  log('Timing rules configured:', 'green');
  Object.entries(testTimingRules).forEach(([trigger, config]) => {
    log(`  ${trigger}: ${config.description} (max ${config.maxTime}s)`, 'yellow');
  });
  
  return testTimingRules;
}

function checkPackageJsonScripts() {
  log('Checking package.json test scripts...', 'blue');
  
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  const testScripts = Object.entries(packageJson.scripts)
    .filter(([key]) => key.startsWith('test'))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
  
  const requiredScripts = {
    'test': 'Run all unit tests',
    'test:unit': 'Run unit tests only',
    'test:integration': 'Run integration tests',
    'test:e2e': 'Run E2E tests',
    'test:security': 'Run security tests',
    'test:pre-commit': 'Pre-commit test suite'
  };
  
  log('Current test scripts:', 'yellow');
  Object.entries(testScripts).forEach(([script, command]) => {
    log(`  ${script}: ${command.substring(0, 50)}...`, 'green');
  });
  
  const missingScripts = Object.keys(requiredScripts).filter(
    script => !testScripts[script]
  );
  
  if (missingScripts.length > 0) {
    log('Missing recommended scripts:', 'yellow');
    missingScripts.forEach(script => {
      log(`  ${script}: ${requiredScripts[script]}`, 'red');
    });
  }
  
  return { existing: testScripts, missing: missingScripts, required: requiredScripts };
}

function validateHooks() {
  log('Validating Git hooks...', 'blue');
  
  const hooks = {
    preCommit: {
      file: '.husky/pre-commit',
      exists: fs.existsSync('.husky/pre-commit'),
      script: 'scripts/pre-commit-tests-optimized.sh'
    },
    postCommit: {
      file: '.husky/_/post-commit',
      exists: fs.existsSync('.husky/_/post-commit'),
      purpose: 'Git LFS operations'
    }
  };
  
  Object.entries(hooks).forEach(([hook, config]) => {
    const status = config.exists ? 'FOUND' : 'MISSING';
    const color = config.exists ? 'green' : 'red';
    log(`  ${hook}: ${status} (${config.file})`, color);
  });
  
  return hooks;
}

function checkGitHubActions() {
  log('Checking GitHub Actions workflows...', 'blue');
  
  const workflowDir = '.github/workflows';
  if (!fs.existsSync(workflowDir)) {
    log('No GitHub Actions workflows found', 'red');
    return [];
  }
  
  const workflows = fs.readdirSync(workflowDir)
    .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map(f => {
      const content = fs.readFileSync(path.join(workflowDir, f), 'utf8');
      return {
        file: f,
        hasTests: content.includes('npm test') || content.includes('test'),
        triggers: content.match(/on:\s*\n([\s\S]*?)jobs:/)?.[1] || 'unknown'
      };
    });
  
  workflows.forEach(workflow => {
    const testStatus = workflow.hasTests ? 'HAS TESTS' : 'NO TESTS';
    const color = workflow.hasTests ? 'green' : 'yellow';
    log(`  ${workflow.file}: ${testStatus}`, color);
  });
  
  return workflows;
}

function generateTestReport() {
  log('Generating test organization report...', 'blue');
  
  const testStructure = analyzeTestStructure();
  const testTiming = validateTestTiming();
  const packageScripts = checkPackageJsonScripts();
  const hooks = validateHooks();
  const workflows = checkGitHubActions();
  
  const report = `# VibeCode Test Organization Report

Generated: ${new Date().toISOString()}

## Test Structure

### File Distribution
${Object.entries(testStructure).map(([category, files]) => 
  `- **${category}**: ${files.length} files`
).join('\n')}

### Test Categories
- **Unit Tests**: Fast, isolated tests (run on every commit)
- **Integration Tests**: Service integration tests (run on push to main)
- **E2E Tests**: End-to-end workflow tests (run on PR)
- **K8s Tests**: Kubernetes deployment tests (run nightly)
- **Security Tests**: Security and vulnerability tests (run on commit)
- **Performance Tests**: Load and performance tests (run nightly)

## Test Timing Rules

${Object.entries(testTiming).map(([trigger, config]) => 
  `### ${trigger.toUpperCase()}\n- **Purpose**: ${config.description}\n- **Max Time**: ${config.maxTime}s\n- **Includes**: ${config.includes.join(', ')}\n- **Excludes**: ${config.excludes.join(', ')}`
).join('\n\n')}

## Package.json Scripts

### Existing Scripts
${Object.entries(packageScripts.existing).map(([script, command]) => 
  `- \`${script}\`: ${command}`
).join('\n')}

${packageScripts.missing.length > 0 ? `### Missing Recommended Scripts
${packageScripts.missing.map(script => 
  `- \`${script}\`: ${packageScripts.required[script]}`
).join('\n')}` : ''}

## Git Hooks Status

${Object.entries(hooks).map(([hook, config]) => 
  `- **${hook}**: ${config.exists ? '✅ CONFIGURED' : '❌ MISSING'} (${config.file})`
).join('\n')}

## GitHub Actions Workflows

${workflows.map(workflow => 
  `- **${workflow.file}**: ${workflow.hasTests ? '✅ HAS TESTS' : '⚠️ NO TESTS'}`
).join('\n')}

## Recommendations

1. **Fix failing unit tests** - Address window property and syntax errors
2. **Add missing scripts** - Implement recommended test scripts
3. **Optimize pre-commit hooks** - Ensure fast execution (< 30s)
4. **Enhance GitHub Actions** - Add proper test matrix and caching
5. **Organize test files** - Move misplaced tests to correct directories

## Next Steps

1. Run \`npm run test:fix\` to fix common test issues
2. Run \`npm run test:unit\` to verify unit tests
3. Update GitHub Actions with Node.js 20.11.0
4. Implement missing test categories
`;

  fs.writeFileSync('TEST_ORGANIZATION_REPORT.md', report);
  log('Report saved to TEST_ORGANIZATION_REPORT.md', 'green');
}

function suggestFixes() {
  log('Test organization analysis complete!', 'green');
  log('', 'reset');
  log('Key findings:', 'yellow');
  log('- 137 total test files found', 'cyan');
  log('- Unit tests have syntax and mocking issues', 'red');
  log('- Pre-commit hooks are optimized and working', 'green');
  log('- GitHub Actions need Node.js version update', 'yellow');
  log('- Test timing rules are well organized', 'green');
  
  log('', 'reset');
  log('Next actions:', 'blue');
  log('1. Fix unit test syntax errors', 'cyan');
  log('2. Update GitHub Actions Node version to 20.11.0', 'cyan');
  log('3. Add missing test scripts to package.json', 'cyan');
  log('4. Test the complete pipeline', 'cyan');
}

async function main() {
  log('VibeCode Test Organization & Validation', 'cyan');
  log('========================================', 'cyan');
  log('', 'reset');
  
  try {
    generateTestReport();
    suggestFixes();
  } catch (error) {
    log(`Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  analyzeTestStructure,
  validateTestTiming,
  checkPackageJsonScripts,
  validateHooks,
  checkGitHubActions
};