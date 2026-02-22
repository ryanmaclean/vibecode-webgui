#!/usr/bin/env node
/**
 * End-to-end verification script for the template system
 * Validates that templates are properly configured with monitoring and resources
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function verifyTemplate(templatePath) {
  const templateName = path.basename(templatePath);
  log(`\nVerifying template: ${templateName}`, 'blue');

  const errors = [];
  const warnings = [];

  // Check template.json exists
  const templateJsonPath = path.join(templatePath, 'template.json');
  if (!fs.existsSync(templateJsonPath)) {
    warnings.push('No template.json found');
    return { errors, warnings };
  }

  // Parse template.json
  let templateData;
  try {
    const content = fs.readFileSync(templateJsonPath, 'utf8');
    templateData = JSON.parse(content);
  } catch (err) {
    errors.push(`Failed to parse template.json: ${err.message}`);
    return { errors, warnings };
  }

  // Verify monitoring config
  if (templateData.monitoringConfig) {
    log('  ✓ Has monitoring configuration', 'green');
    if (!templateData.monitoringConfig.enabled) {
      warnings.push('Monitoring is disabled');
    }
    if (!templateData.monitoringConfig.provider) {
      errors.push('Monitoring provider not specified');
    }
    if (!templateData.monitoringConfig.configFile) {
      warnings.push('Monitoring config file not specified');
    } else {
      // Check if monitoring config file exists
      const configPath = path.join(templatePath, templateData.monitoringConfig.configFile);
      if (!fs.existsSync(configPath)) {
        warnings.push(`Monitoring config file not found: ${templateData.monitoringConfig.configFile}`);
      }
    }
  } else {
    warnings.push('No monitoring configuration');
  }

  // Verify resource requirements
  if (templateData.requirements) {
    log('  ✓ Has resource requirements', 'green');
    if (!templateData.requirements.memory) {
      warnings.push('Memory requirement not specified');
    }
    if (!templateData.requirements.storage) {
      warnings.push('Storage requirement not specified');
    }
    if (typeof templateData.requirements.network !== 'boolean') {
      warnings.push('Network requirement not specified');
    }
  } else {
    warnings.push('No resource requirements');
  }

  // Verify required fields
  const requiredFields = ['name', 'description', 'version', 'type', 'language'];
  for (const field of requiredFields) {
    if (!templateData[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Verify files array
  if (!templateData.files || !Array.isArray(templateData.files)) {
    errors.push('Files array is missing or invalid');
  } else {
    log(`  ✓ Has ${templateData.files.length} files defined`, 'green');
  }

  return { errors, warnings };
}

function main() {
  log('\n=== Template System E2E Verification ===\n', 'cyan');

  const templatesDir = path.join(__dirname, '..', 'config', 'templates');

  // Templates to verify
  const templatesToVerify = [
    path.join(templatesDir, 'react', 'react-typescript-vite'),
    path.join(templatesDir, 'go', 'go-microservices'),
    path.join(templatesDir, 'python', 'azure-pytorch-dsvm')
  ];

  let totalErrors = 0;
  let totalWarnings = 0;
  let passedTemplates = 0;

  for (const templatePath of templatesToVerify) {
    if (!fs.existsSync(templatePath)) {
      log(`Template not found: ${templatePath}`, 'red');
      totalErrors++;
      continue;
    }

    const { errors, warnings } = verifyTemplate(templatePath);

    if (errors.length > 0) {
      log('  Errors:', 'red');
      errors.forEach(err => log(`    ✗ ${err}`, 'red'));
    }

    if (warnings.length > 0) {
      log('  Warnings:', 'yellow');
      warnings.forEach(warn => log(`    ⚠ ${warn}`, 'yellow'));
    }

    totalErrors += errors.length;
    totalWarnings += warnings.length;

    if (errors.length === 0) {
      passedTemplates++;
    }
  }

  // Verify shared monitoring configs exist
  log('\n\nVerifying shared monitoring configurations...', 'blue');
  const sharedMonitoringFiles = [
    path.join(templatesDir, '_shared', 'monitoring.datadog.yml'),
    path.join(templatesDir, '_shared', 'monitoring.prometheus.yml')
  ];

  for (const file of sharedMonitoringFiles) {
    if (fs.existsSync(file)) {
      log(`  ✓ ${path.basename(file)} exists`, 'green');
    } else {
      log(`  ✗ ${path.basename(file)} missing`, 'red');
      totalErrors++;
    }
  }

  // Summary
  log('\n\n=== Verification Summary ===', 'cyan');
  log(`Templates verified: ${templatesToVerify.length}`, 'blue');
  log(`Templates passed: ${passedTemplates}`, passedTemplates === templatesToVerify.length ? 'green' : 'yellow');
  log(`Total errors: ${totalErrors}`, totalErrors === 0 ? 'green' : 'red');
  log(`Total warnings: ${totalWarnings}`, totalWarnings === 0 ? 'green' : 'yellow');

  if (totalErrors === 0) {
    log('\n✅ All verifications passed!', 'green');
    process.exit(0);
  } else {
    log('\n❌ Verification failed with errors', 'red');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { verifyTemplate };
