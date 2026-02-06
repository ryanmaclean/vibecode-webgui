#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");

/**
 * AI Tooling Parity Analysis Script
 * Analyzes test results from CI matrix and generates parity report
 *
 * Usage: node analyze-tooling-parity.js <results-dir>
 */

const fs = require('fs');
const path = require('path');

// Initialize log aggregation
const logAggregation = new LogAggregation();


// Platform definitions
const PLATFORMS = [
  { id: 'darwin_arm64', name: 'macOS ARM64 (M-series)', runner: 'macos-14' },
  { id: 'darwin_x64', name: 'macOS x64 (Intel)', runner: 'macos-13' },
  { id: 'linux_amd64', name: 'Ubuntu AMD64', runner: 'ubuntu-24.04' },
  { id: 'linux_arm64', name: 'Ubuntu ARM64', runner: 'ubuntu-24.04-arm64' },
  { id: 'windows_x64', name: 'Windows x64', runner: 'windows-2025' }
];

// Test buckets
const TEST_TYPES = ['probe', 'smoke', 'functional', 'playwright'];

/**
 * Parse probe results
 */
function parseProbeResults(resultsDir) {
  const probes = {};

  PLATFORMS.forEach(platform => {
    const probeDirs = fs.readdirSync(resultsDir).filter(d => d.startsWith(`probe-${platform.id}`));

    if (probeDirs.length === 0) {
      probes[platform.id] = { status: 'MISSING', data: null };
      return;
    }

    const probeDir = path.join(resultsDir, probeDirs[0]);
    const probeFile = path.join(probeDir, `${platform.id}.json`);

    if (!fs.existsSync(probeFile)) {
      probes[platform.id] = { status: 'MISSING', data: null };
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(probeFile, 'utf8'));
      probes[platform.id] = { status: 'PASSED', data };
    } catch (err) {
      probes[platform.id] = { status: 'ERROR', data: null, error: err.message };
    }
  });

  return probes;
}

/**
 * Parse smoke test results
 */
function parseSmokeResults(resultsDir) {
  const smoke = {};

  PLATFORMS.forEach(platform => {
    const smokeDirs = fs.readdirSync(resultsDir).filter(d => d.startsWith(`smoke-${platform.id}`));

    if (smokeDirs.length === 0) {
      smoke[platform.id] = { status: 'MISSING' };
      return;
    }

    const smokeDir = path.join(resultsDir, smokeDirs[0], 'smoke');
    const smokeFile = path.join(smokeDir, `${platform.id}.txt`);

    if (!fs.existsSync(smokeFile)) {
      smoke[platform.id] = { status: 'MISSING' };
      return;
    }

    try {
      const content = fs.readFileSync(smokeFile, 'utf8');
      const status = content.includes('Status: PASSED') ? 'PASSED' : 'FAILED';
      smoke[platform.id] = { status, content };
    } catch (err) {
      smoke[platform.id] = { status: 'ERROR', error: err.message };
    }
  });

  return smoke;
}

/**
 * Parse functional test results
 */
function parseFunctionalResults(resultsDir) {
  const functional = {};

  PLATFORMS.forEach(platform => {
    const funcDirs = fs.readdirSync(resultsDir).filter(d => d.startsWith(`functional-${platform.id}`));

    if (funcDirs.length === 0) {
      functional[platform.id] = { status: 'MISSING' };
      return;
    }

    const funcDir = path.join(resultsDir, funcDirs[0], 'functional');
    const funcFile = path.join(funcDir, `${platform.id}.txt`);

    if (!fs.existsSync(funcFile)) {
      functional[platform.id] = { status: 'MISSING' };
      return;
    }

    try {
      const content = fs.readFileSync(funcFile, 'utf8');
      const status = content.includes('Overall Status: PASSED') ? 'PASSED' : 'FAILED';
      functional[platform.id] = { status, content };
    } catch (err) {
      functional[platform.id] = { status: 'ERROR', error: err.message };
    }
  });

  return functional;
}

/**
 * Parse Playwright test results
 */
function parsePlaywrightResults(resultsDir) {
  const playwright = {};

  // Playwright only runs on Linux platforms
  const linuxPlatforms = PLATFORMS.filter(p => p.id.startsWith('linux_'));

  linuxPlatforms.forEach(platform => {
    const pwDirs = fs.readdirSync(resultsDir).filter(d => d.startsWith(`playwright-${platform.id}`));

    if (pwDirs.length === 0) {
      playwright[platform.id] = { status: 'MISSING' };
      return;
    }

    const pwDir = path.join(resultsDir, pwDirs[0]);
    const latencyFile = path.join(pwDir, `latency-${platform.id}.txt`);

    if (!fs.existsSync(latencyFile)) {
      playwright[platform.id] = { status: 'MISSING' };
      return;
    }

    try {
      const content = fs.readFileSync(latencyFile, 'utf8');
      playwright[platform.id] = { status: 'PASSED', latencies: content };
    } catch (err) {
      playwright[platform.id] = { status: 'ERROR', error: err.message };
    }
  });

  return playwright;
}

/**
 * Check version parity across platforms
 */
function checkVersionParity(probes) {
  const versions = {};
  const tools = ['node', 'npm', 'python', 'git'];

  tools.forEach(tool => {
    versions[tool] = {};
    Object.keys(probes).forEach(platformId => {
      if (probes[platformId].status === 'PASSED' && probes[platformId].data) {
        versions[tool][platformId] = probes[platformId].data.versions[tool];
      }
    });
  });

  // Check if all versions match
  const mismatches = [];
  tools.forEach(tool => {
    const versionSet = new Set(Object.values(versions[tool]));
    if (versionSet.size > 1) {
      mismatches.push({ tool, versions: versions[tool] });
    }
  });

  return { versions, mismatches };
}

/**
 * Generate markdown report
 */
function generateReport(probes, smoke, functional, playwright) {
  const report = [];

  report.push('# AI Tooling Parity Report');
  report.push('');
  report.push(`**Generated:** ${new Date().toISOString()}`);
  report.push('');

  // Overall Status
  report.push('## Overall Status');
  report.push('');

  const allPassed = PLATFORMS.every(platform => {
    const probeOk = probes[platform.id]?.status === 'PASSED';
    const smokeOk = smoke[platform.id]?.status === 'PASSED';
    const funcOk = functional[platform.id]?.status === 'PASSED';
    return probeOk && smokeOk && funcOk;
  });

  if (allPassed) {
    report.push('✅ **ALL PLATFORMS PASSING**');
  } else {
    report.push('❌ **FAILURES DETECTED**');
  }
  report.push('');

  // Platform Matrix
  report.push('## Platform Test Matrix');
  report.push('');
  report.push('| Platform | Probe | Smoke | Functional | Playwright |');
  report.push('|----------|-------|-------|------------|------------|');

  PLATFORMS.forEach(platform => {
    const probeStatus = probes[platform.id]?.status || 'MISSING';
    const smokeStatus = smoke[platform.id]?.status || 'MISSING';
    const funcStatus = functional[platform.id]?.status || 'MISSING';
    const pwStatus = playwright[platform.id]?.status || 'N/A';

    const probeEmoji = probeStatus === 'PASSED' ? '✅' : probeStatus === 'FAILED' ? '❌' : '⚠️';
    const smokeEmoji = smokeStatus === 'PASSED' ? '✅' : smokeStatus === 'FAILED' ? '❌' : '⚠️';
    const funcEmoji = funcStatus === 'PASSED' ? '✅' : funcStatus === 'FAILED' ? '❌' : '⚠️';
    const pwEmoji = pwStatus === 'PASSED' ? '✅' : pwStatus === 'FAILED' ? '❌' : pwStatus === 'N/A' ? '-' : '⚠️';

    report.push(`| ${platform.name} | ${probeEmoji} ${probeStatus} | ${smokeEmoji} ${smokeStatus} | ${funcEmoji} ${funcStatus} | ${pwEmoji} ${pwStatus} |`);
  });
  report.push('');

  // Version Parity
  const { versions, mismatches } = checkVersionParity(probes);

  report.push('## Version Parity Analysis');
  report.push('');

  if (mismatches.length === 0) {
    report.push('✅ **All platforms have matching runtime versions**');
  } else {
    report.push('⚠️ **Version mismatches detected:**');
    report.push('');
    mismatches.forEach(({ tool, versions }) => {
      report.push(`### ${tool}`);
      Object.entries(versions).forEach(([platform, version]) => {
        const platformName = PLATFORMS.find(p => p.id === platform)?.name;
        report.push(`- ${platformName}: \`${version}\``);
      });
      report.push('');
    });
  }

  // Runtime Requirements
  report.push('## Minimum Runtime Requirements');
  report.push('');
  report.push('Based on verified installations across all platforms:');
  report.push('');

  Object.keys(versions).forEach(tool => {
    const versionList = [...new Set(Object.values(versions[tool]))];
    if (versionList.length > 0) {
      report.push(`- **${tool}**: ${versionList.join(', ')}`);
    }
  });
  report.push('');

  // Failure Details
  const failures = [];
  PLATFORMS.forEach(platform => {
    if (probes[platform.id]?.status === 'FAILED' || probes[platform.id]?.status === 'ERROR') {
      failures.push({ platform: platform.name, test: 'Runtime Probe', status: probes[platform.id] });
    }
    if (smoke[platform.id]?.status === 'FAILED' || smoke[platform.id]?.status === 'ERROR') {
      failures.push({ platform: platform.name, test: 'Smoke Tests', status: smoke[platform.id] });
    }
    if (functional[platform.id]?.status === 'FAILED' || functional[platform.id]?.status === 'ERROR') {
      failures.push({ platform: platform.name, test: 'Functional Tests', status: functional[platform.id] });
    }
  });

  if (failures.length > 0) {
    report.push('## Failure Details');
    report.push('');
    failures.forEach(failure => {
      report.push(`### ${failure.platform} - ${failure.test}`);
      report.push('```');
      if (failure.status.error) {
        report.push(`ERROR: ${failure.status.error}`);
      } else if (failure.status.content) {
        report.push(failure.status.content);
      } else {
        report.push('No details available');
      }
      report.push('```');
      report.push('');
    });
  }

  // Recommendations
  report.push('## Recommendations');
  report.push('');

  if (mismatches.length > 0) {
    report.push('1. **Standardize Runtime Versions**: Update CI runners to use consistent versions across platforms');
  }

  if (failures.length > 0) {
    report.push(`2. **Address ${failures.length} Platform Failure(s)**: Review detailed logs and fix installation issues`);
  }

  if (allPassed && mismatches.length === 0) {
    report.push('✅ All platforms are in parity. No action required.');
  }

  report.push('');
  report.push('---');
  report.push('*Report generated by AI Tooling Parity CI Matrix*');

  return report.join('\n');
}

/**
 * Main execution
 */
function main() {
  const resultsDir = process.argv[2];

  if (!resultsDir) {
    console.error('Usage: node analyze-tooling-parity.js <results-dir>');
    process.exit(1);
  }

  if (!fs.existsSync(resultsDir)) {
    console.error(`Error: Results directory not found: ${resultsDir}`);
    process.exit(1);
  }

  try {
    // Parse all test results
    const probes = parseProbeResults(resultsDir);
    const smoke = parseSmokeResults(resultsDir);
    const functional = parseFunctionalResults(resultsDir);
    const playwright = parsePlaywrightResults(resultsDir);

    // Generate report
    const report = generateReport(probes, smoke, functional, playwright);

    // Output to stdout
    console.log(report);

    // Exit code based on failures
    const hasFailures = PLATFORMS.some(platform => {
      return smoke[platform.id]?.status === 'FAILED' ||
             functional[platform.id]?.status === 'FAILED';
    });

    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error('Error generating parity report:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseProbeResults, parseSmokeResults, parseFunctionalResults, generateReport };
