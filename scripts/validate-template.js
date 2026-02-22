#!/usr/bin/env node

/**
 * Template Validation Script
 * Validates environment template structure and metadata
 */

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

function validateTemplateStructure(templatePath) {
  const errors = [];
  const warnings = [];

  // Check if template directory exists
  if (!fs.existsSync(templatePath)) {
    errors.push(`Template directory does not exist: ${templatePath}`);
    return { errors, warnings };
  }

  const stat = fs.statSync(templatePath);
  if (!stat.isDirectory()) {
    errors.push(`Template path is not a directory: ${templatePath}`);
    return { errors, warnings };
  }

  // Check for README.md (required for all templates)
  const readmePath = path.join(templatePath, 'README.md');
  if (!fs.existsSync(readmePath)) {
    errors.push('Missing required file: README.md');
  } else {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    if (readmeContent.trim().length < 50) {
      warnings.push('README.md appears to be too short (< 50 characters)');
    }
  }

  return { errors, warnings };
}

function validateTemplateJson(templatePath) {
  const errors = [];
  const warnings = [];

  const templateJsonPath = path.join(templatePath, 'template.json');

  // template.json is optional
  if (!fs.existsSync(templateJsonPath)) {
    warnings.push('No template.json found (optional but recommended)');
    return { errors, warnings };
  }

  try {
    const templateJson = JSON.parse(fs.readFileSync(templateJsonPath, 'utf8'));

    // Validate required fields
    const requiredFields = ['name', 'description', 'version'];
    for (const field of requiredFields) {
      if (!templateJson[field]) {
        errors.push(`Missing required field in template.json: ${field}`);
      }
    }

    // Validate recommended fields
    const recommendedFields = ['author', 'tags', 'type'];
    for (const field of recommendedFields) {
      if (!templateJson[field]) {
        warnings.push(`Missing recommended field in template.json: ${field}`);
      }
    }

    // Validate name is non-empty string
    if (templateJson.name && typeof templateJson.name !== 'string') {
      errors.push('Field "name" must be a string');
    }

    // Validate description is non-empty string
    if (templateJson.description && typeof templateJson.description !== 'string') {
      errors.push('Field "description" must be a string');
    }

    // Validate tags is an array if present
    if (templateJson.tags && !Array.isArray(templateJson.tags)) {
      errors.push('Field "tags" must be an array');
    }

    // Validate version format if present
    if (templateJson.version && typeof templateJson.version === 'string') {
      if (!/^\d+\.\d+\.\d+/.test(templateJson.version)) {
        warnings.push('Version should follow semantic versioning (e.g., 1.0.0)');
      }
    }

    // Validate files array if present
    if (templateJson.files) {
      if (!Array.isArray(templateJson.files)) {
        errors.push('Field "files" must be an array');
      } else {
        for (const file of templateJson.files) {
          const filePath = path.join(templatePath, file);
          if (!fs.existsSync(filePath)) {
            errors.push(`File listed in template.json does not exist: ${file}`);
          }
        }
      }
    }

    // Validate requirements object if present
    if (templateJson.requirements) {
      if (typeof templateJson.requirements !== 'object') {
        errors.push('Field "requirements" must be an object');
      } else {
        if (templateJson.requirements.memory && typeof templateJson.requirements.memory !== 'string') {
          warnings.push('Field "requirements.memory" should be a string (e.g., "2GB")');
        }
        if (templateJson.requirements.storage && typeof templateJson.requirements.storage !== 'string') {
          warnings.push('Field "requirements.storage" should be a string (e.g., "1GB")');
        }
      }
    }

    // Validate monitoringConfig if present
    if (templateJson.monitoringConfig) {
      if (typeof templateJson.monitoringConfig !== 'object') {
        errors.push('Field "monitoringConfig" must be an object');
      } else {
        if (templateJson.monitoringConfig.configFile) {
          const configPath = path.join(path.dirname(templatePath), templateJson.monitoringConfig.configFile);
          if (!fs.existsSync(configPath)) {
            errors.push(`Monitoring config file does not exist: ${templateJson.monitoringConfig.configFile}`);
          }
        }
      }
    }

  } catch (error) {
    if (error instanceof SyntaxError) {
      errors.push(`Invalid JSON in template.json: ${error.message}`);
    } else {
      errors.push(`Error reading template.json: ${error.message}`);
    }
  }

  return { errors, warnings };
}

function validateTemplate(templatePath) {
  const absolutePath = path.resolve(templatePath);
  const templateName = path.basename(absolutePath);

  log(`\nValidating template: ${templateName}`, 'blue');
  log(`Path: ${absolutePath}`, 'blue');
  log('---');

  const structureValidation = validateTemplateStructure(absolutePath);
  const jsonValidation = validateTemplateJson(absolutePath);

  const allErrors = [...structureValidation.errors, ...jsonValidation.errors];
  const allWarnings = [...structureValidation.warnings, ...jsonValidation.warnings];

  // Report warnings
  if (allWarnings.length > 0) {
    log('\nWarnings:', 'yellow');
    for (const warning of allWarnings) {
      log(`  ⚠ ${warning}`, 'yellow');
    }
  }

  // Report errors
  if (allErrors.length > 0) {
    log('\nErrors:', 'red');
    for (const error of allErrors) {
      log(`  ✗ ${error}`, 'red');
    }
    log('\nValidation failed ✗', 'red');
    return false;
  }

  log('\nValidation passed ✓', 'green');
  return true;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    log('Usage: node validate-template.js <template-path>', 'yellow');
    log('Example: node validate-template.js config/templates/python/basic-agent-app', 'yellow');
    process.exit(1);
  }

  const templatePath = args[0];
  const isValid = validateTemplate(templatePath);

  process.exit(isValid ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { validateTemplate };
