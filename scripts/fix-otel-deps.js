#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * OpenTelemetry Dependencies Resolver
 * 
 * This script identifies and resolves OpenTelemetry dependency version conflicts
 * and missing dependencies that cause warnings.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Initialize log aggregation
const logAggregation = new LogAggregation();


console.log('🔍 Analyzing OpenTelemetry dependencies...\n');

// Read current package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Current OpenTelemetry dependencies
const currentOtelDeps = {};
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

Object.keys(dependencies).forEach(dep => {
  if (dep.startsWith('@opentelemetry/')) {
    currentOtelDeps[dep] = dependencies[dep];
  }
});

console.log('📦 Current OpenTelemetry dependencies:');
Object.entries(currentOtelDeps).forEach(([dep, version]) => {
  console.log(`  ${dep}: ${version}`);
});

// Recommended OpenTelemetry version (latest stable)
const OTEL_VERSION = '0.53.0';

// Required OpenTelemetry packages for complete instrumentation
const requiredOtelPackages = {
  '@opentelemetry/api': '1.9.0',
  '@opentelemetry/sdk-node': '0.53.0',
  '@opentelemetry/core': '1.26.0',
  '@opentelemetry/instrumentation': '0.53.0',
  '@opentelemetry/auto-instrumentations-node': '0.50.0',
  
  // Exporters
  '@opentelemetry/exporter-otlp-http': '0.53.0',
  '@opentelemetry/exporter-prometheus': '0.53.0',
  '@opentelemetry/exporter-jaeger': '1.26.0',
  
  // Core instrumentations
  '@opentelemetry/instrumentation-http': '0.53.0',
  '@opentelemetry/instrumentation-express': '0.41.0',
  '@opentelemetry/instrumentation-fs': '0.14.0',
  '@opentelemetry/instrumentation-dns': '0.38.0',
  
  // Additional useful instrumentations
  '@opentelemetry/instrumentation-pg': '0.43.0',
  '@opentelemetry/instrumentation-redis': '0.41.0',
  '@opentelemetry/instrumentation-fetch': '0.53.0',
  '@opentelemetry/instrumentation-undici': '0.5.0',
  
  // Semantic conventions
  '@opentelemetry/semantic-conventions': '1.27.0',
  
  // Resources
  '@opentelemetry/resource-detector-aws': '1.5.2',
  '@opentelemetry/resource-detector-container': '0.3.10',
  '@opentelemetry/resource-detector-docker': '0.3.10',
};

// Identify version conflicts
const conflicts = [];
const missing = [];
const outdated = [];

Object.entries(requiredOtelPackages).forEach(([pkg, recommendedVersion]) => {
  const currentVersion = currentOtelDeps[pkg];
  
  if (!currentVersion) {
    missing.push({ pkg, recommendedVersion });
  } else if (currentVersion !== recommendedVersion) {
    const isOutdated = isVersionOlder(currentVersion, recommendedVersion);
    if (isOutdated) {
      outdated.push({ pkg, currentVersion, recommendedVersion });
    } else {
      conflicts.push({ pkg, currentVersion, recommendedVersion });
    }
  }
});

console.log('\n🔧 Analysis Results:');

if (missing.length > 0) {
  console.log('\n❌ Missing dependencies:');
  missing.forEach(({ pkg, recommendedVersion }) => {
    console.log(`  ${pkg}@${recommendedVersion}`);
  });
}

if (outdated.length > 0) {
  console.log('\n⚠️  Outdated dependencies:');
  outdated.forEach(({ pkg, currentVersion, recommendedVersion }) => {
    console.log(`  ${pkg}: ${currentVersion} → ${recommendedVersion}`);
  });
}

if (conflicts.length > 0) {
  console.log('\n🔀 Version conflicts:');
  conflicts.forEach(({ pkg, currentVersion, recommendedVersion }) => {
    console.log(`  ${pkg}: ${currentVersion} (current) vs ${recommendedVersion} (recommended)`);
  });
}

if (missing.length === 0 && outdated.length === 0 && conflicts.length === 0) {
  console.log('\n✅ All OpenTelemetry dependencies are up to date!');
  process.exit(0);
}

// Ask for confirmation to fix issues
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🛠️  Would you like to fix these issues? (y/n):');

rl.question('> ', (answer) => {
  rl.close();
  
  if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    console.log('Cancelled. No changes made.');
    process.exit(0);
  }
  
  console.log('\n🔨 Fixing OpenTelemetry dependencies...');
  
  try {
    // Install missing and update outdated packages
    const packagesToInstall = [
      ...missing.map(({ pkg, recommendedVersion }) => `${pkg}@${recommendedVersion}`),
      ...outdated.map(({ pkg, recommendedVersion }) => `${pkg}@${recommendedVersion}`)
    ];
    
    if (packagesToInstall.length > 0) {
      console.log(`\n📦 Installing/updating packages...`);
      console.log(`npm install ${packagesToInstall.join(' ')}`);
      
      execSync(`npm install ${packagesToInstall.join(' ')}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    }
    
    // Handle conflicts by updating to recommended versions
    if (conflicts.length > 0) {
      console.log('\n🔄 Resolving version conflicts...');
      const conflictResolutions = conflicts.map(({ pkg, recommendedVersion }) => 
        `${pkg}@${recommendedVersion}`
      );
      
      console.log(`npm install ${conflictResolutions.join(' ')}`);
      execSync(`npm install ${conflictResolutions.join(' ')}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    }
    
    console.log('\n✅ OpenTelemetry dependencies updated successfully!');
    console.log('\n📋 Next steps:');
    console.log('  1. Run `npm test` to ensure everything works');
    console.log('  2. Check that monitoring still functions correctly');
    console.log('  3. Update your OpenTelemetry configuration if needed');
    
    // Create a quick configuration check
    createOtelConfigCheck();
    
  } catch (error) {
    console.error('\n❌ Failed to update dependencies:', error.message);
    console.log('\n🔧 Try running these commands manually:');
    
    if (missing.length > 0 || outdated.length > 0) {
      const packages = [
        ...missing.map(({ pkg, recommendedVersion }) => `${pkg}@${recommendedVersion}`),
        ...outdated.map(({ pkg, recommendedVersion }) => `${pkg}@${recommendedVersion}`)
      ];
      console.log(`npm install ${packages.join(' ')}`);
    }
    
    process.exit(1);
  }
});

// Helper function to check if a version is older
function isVersionOlder(current, target) {
  const currentParts = current.replace(/[^0-9.]/g, '').split('.').map(Number);
  const targetParts = target.replace(/[^0-9.]/g, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(currentParts.length, targetParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const targetPart = targetParts[i] || 0;
    
    if (currentPart < targetPart) return true;
    if (currentPart > targetPart) return false;
  }
  
  return false;
}

// Create OpenTelemetry configuration validation
function createOtelConfigCheck() {
  const configCheck = `
// OpenTelemetry Configuration Validator
// Run this to ensure your OpenTelemetry setup is working correctly

const otel = require('@opentelemetry/api');

console.log('🔍 OpenTelemetry Configuration Check');
console.log('=====================================');

try {
  // Check if OpenTelemetry API is available
  const tracer = otel.trace.getTracer('config-check');
  console.log('✅ OpenTelemetry API is available');
  
  // Test basic tracing
  const span = tracer.startSpan('config-test');
  span.setStatus({ code: otel.SpanStatusCode.OK });
  span.end();
  console.log('✅ Basic tracing works');
  
  // Check metrics API
  const meter = otel.metrics.getMeter('config-check');
  const counter = meter.createCounter('test_counter');
  counter.add(1);
  console.log('✅ Metrics API works');
  
  console.log('\\n🎉 OpenTelemetry configuration is healthy!');
} catch (error) {
  console.log('❌ OpenTelemetry configuration error:', error.message);
  process.exit(1);
}
`;

  fs.writeFileSync(path.join(process.cwd(), 'scripts/otel-config-check.js'), configCheck.trim());
  console.log('\n📝 Created OpenTelemetry configuration checker at scripts/otel-config-check.js');
  console.log('   Run with: node scripts/otel-config-check.js');
}