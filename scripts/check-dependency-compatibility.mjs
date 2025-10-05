#!/usr/bin/env node

/**
 * Dependency Compatibility Checker
 *
 * Performs comprehensive dependency compatibility testing to catch issues
 * before they reach CI/CD pipelines. Converts CommonJS usage to native ESM so
 * eslint can enforce modern module standards without suppressing rules.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

class DependencyCompatibilityChecker {
  constructor() {
    this.results = {
      conflicts: [],
      security: [],
      outdated: [],
      phantom: [],
      peer: [],
      errors: []
    };
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };

    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  async checkDependencyConflicts() {
    this.log('🔍 Checking for dependency conflicts...', 'info');

    try {
      execSync('npm ls --depth=0', { encoding: 'utf8', stdio: 'pipe' });
      this.log('✅ No dependency conflicts found', 'success');
    } catch (error) {
      const conflicts = error.stdout?.match(/npm ERR!.*$/gm) || [];
      this.results.conflicts = conflicts;

      if (conflicts.length > 0) {
        this.log(`❌ Found ${conflicts.length} dependency conflicts`, 'error');
        conflicts.forEach(conflict => this.log(`  ${conflict}`, 'error'));
      }
    }
  }

  async checkSecurityVulnerabilities() {
    this.log('🔒 Checking for security vulnerabilities...', 'info');

    try {
      execSync('npm audit --audit-level=moderate', { encoding: 'utf8', stdio: 'pipe' });
      this.log('✅ No security vulnerabilities found', 'success');
    } catch (error) {
      const auditOutput = error.stdout || '';
      const vulnerabilities = auditOutput.match(/(\d+) vulnerabilities?/);

      if (vulnerabilities) {
        const count = vulnerabilities[1];
        this.log(`⚠️  Found ${count} security vulnerabilities`, 'warning');
        this.results.security.push(auditOutput);
      }
    }
  }

  async checkOutdatedDependencies() {
    this.log('📦 Checking for outdated dependencies...', 'info');

    try {
      execSync('which ncu', { stdio: 'pipe' });
    } catch {
      this.log('Installing npm-check-updates...', 'info');
      execSync('npm install -g npm-check-updates', { stdio: 'inherit' });
    }

    try {
      const output = execSync('ncu --format json', { encoding: 'utf8', stdio: 'pipe' });
      const outdated = JSON.parse(output);

      if (Object.keys(outdated).length === 0) {
        this.log('✅ All dependencies are up to date', 'success');
      } else {
        this.log(`📋 Found ${Object.keys(outdated).length} outdated dependencies:`, 'warning');
        Object.entries(outdated).forEach(([pkg, version]) => {
          this.log(`  ${pkg}: ${version}`, 'warning');
        });
        this.results.outdated = outdated;
      }
    } catch (error) {
      this.log('❌ Failed to check outdated dependencies', 'error');
      this.results.errors.push('outdated-check-failed');
      if (error.stdout) {
        this.log(error.stdout, 'error');
      }
    }
  }

  async checkPeerDependencies() {
    this.log('🔗 Checking peer dependencies...', 'info');

    try {
      execSync('npm ls --depth=1', { encoding: 'utf8', stdio: 'pipe' });
      this.log('✅ All peer dependencies satisfied', 'success');
    } catch (error) {
      const peerIssues = error.stdout?.match(/(UNMET|missing|invalid).*$/gm) || [];

      if (peerIssues.length > 0) {
        this.log(`⚠️  Found ${peerIssues.length} peer dependency issues:`, 'warning');
        peerIssues.forEach(issue => this.log(`  ${issue}`, 'warning'));
        this.results.peer = peerIssues;
      }
    }
  }

  async checkPhantomDependencies() {
    this.log('👻 Checking for phantom dependencies...', 'info');

    const backupNodeModules = fs.existsSync('node_modules.backup');

    try {
      if (fs.existsSync('node_modules') && !backupNodeModules) {
        execSync('mv node_modules node_modules.backup');
      }

      execSync('npm ci --omit=dev --omit=optional', { stdio: 'pipe' });
      execSync('npm run build', { stdio: 'pipe' });

      this.log('✅ No phantom dependencies detected', 'success');
    } catch (error) {
      this.log('❌ Phantom dependencies detected - build failed with prod-only deps', 'error');
      this.results.phantom.push('build-failed-prod-only');

      if (error.stdout) {
        this.log('Build error output:', 'error');
        console.log(error.stdout);
      }
    } finally {
      if (fs.existsSync('node_modules')) {
        execSync('rm -rf node_modules');
      }
      if (fs.existsSync('node_modules.backup')) {
        execSync('mv node_modules.backup node_modules');
      } else {
        execSync('npm ci', { stdio: 'inherit' });
      }
    }
  }

  async checkTypeScriptCompatibility() {
    this.log('📝 Checking TypeScript compatibility...', 'info');

    try {
      execSync('npm run type-check', { stdio: 'pipe' });
      this.log('✅ TypeScript compatibility check passed', 'success');
    } catch (error) {
      this.log('❌ TypeScript compatibility issues found', 'error');
      this.results.errors.push('typescript-check-failed');

      if (error.stdout) {
        console.log(error.stdout);
      }
    }
  }

  async validateLockfile() {
    this.log('🔒 Validating package-lock.json...', 'info');

    try {
      execSync('npm ci --dry-run', { stdio: 'pipe' });

      const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
      const version = packageLock.lockfileVersion;

      if (version !== 3) {
        this.log(`⚠️  Lockfile version is ${version}, consider updating to version 3`, 'warning');
      } else {
        this.log('✅ Lockfile validation passed', 'success');
      }
    } catch (error) {
      this.log('❌ Lockfile validation failed', 'error');
      this.results.errors.push('lockfile-validation-failed');
      if (error.stdout) {
        this.log(error.stdout, 'error');
      }
    }
  }

  generateReport() {
    this.log('\n📊 DEPENDENCY COMPATIBILITY REPORT', 'info');
    this.log('='.repeat(50), 'info');

    const hasIssues =
      this.results.conflicts.length > 0 ||
      this.results.security.length > 0 ||
      this.results.peer.length > 0 ||
      this.results.phantom.length > 0 ||
      this.results.errors.length > 0;

    if (!hasIssues) {
      this.log('🎉 All dependency compatibility checks passed!', 'success');
    } else {
      this.log('⚠️  Issues found:', 'warning');

      if (this.results.conflicts.length > 0) {
        this.log(`  • ${this.results.conflicts.length} dependency conflicts`, 'error');
      }

      if (this.results.security.length > 0) {
        this.log('  • Security vulnerabilities detected', 'error');
      }

      if (this.results.peer.length > 0) {
        this.log(`  • ${this.results.peer.length} peer dependency issues`, 'warning');
      }

      if (this.results.phantom.length > 0) {
        this.log('  • Phantom dependencies detected', 'error');
      }

      if (this.results.errors.length > 0) {
        this.log(`  • ${this.results.errors.length} other errors`, 'error');
      }
    }

    if (this.results.outdated && Object.keys(this.results.outdated).length > 0) {
      this.log(`\n📋 ${Object.keys(this.results.outdated).length} outdated dependencies available for update`, 'info');
    }

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        conflicts: this.results.conflicts.length,
        security: this.results.security.length > 0,
        peer_issues: this.results.peer.length,
        phantom: this.results.phantom.length,
        outdated: Object.keys(this.results.outdated || {}).length,
        errors: this.results.errors.length
      },
      details: this.results
    };

    fs.writeFileSync('dependency-compatibility-report.json', JSON.stringify(report, null, 2));
    this.log('\n📄 Detailed report saved to dependency-compatibility-report.json', 'info');

    return !hasIssues;
  }

  async run() {
    this.log('🚀 Starting dependency compatibility check...', 'info');

    await this.checkDependencyConflicts();
    await this.checkSecurityVulnerabilities();
    await this.checkOutdatedDependencies();
    await this.checkPeerDependencies();
    await this.validateLockfile();
    await this.checkTypeScriptCompatibility();

    if (!process.env.CI && !process.argv.includes('--skip-phantom')) {
      await this.checkPhantomDependencies();
    } else if (process.argv.includes('--skip-phantom')) {
      this.log('⏭️  Skipping phantom dependency check (--skip-phantom)', 'info');
    } else {
      this.log('⏭️  Skipping phantom dependency check (CI environment)', 'info');
    }

    const success = this.generateReport();

    if (!success && !process.argv.includes('--no-exit')) {
      process.exit(1);
    }

    return success;
  }
}

export default DependencyCompatibilityChecker;

const invokedUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
const isDirectExecution = invokedUrl === import.meta.url;

if (isDirectExecution) {
  const checker = new DependencyCompatibilityChecker();
  checker.run().catch(error => {
    console.error('❌ Dependency compatibility check failed:', error);
    process.exit(1);
  });
}
