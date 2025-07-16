#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Validates all required environment variables are present and properly formatted
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  const envLines = envFile.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

// Define required environment variables by category
const requiredVars = {
  authentication: [
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
  ],
  database: [
    'DATABASE_URL',
    'REDIS_URL',
  ],
  ai: [
    'OPENROUTER_API_KEY',
  ],
  monitoring: [
    'DATADOG_API_KEY',
  ],
};

// Development-only variables
const devVars = [
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
];

// Optional variables
const optionalVars = [
  'GITHUB_ID',
  'GITHUB_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID',
  'NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN',
  'SLACK_WEBHOOK_URL',
  'SENDGRID_API_KEY',
  'PAGERDUTY_INTEGRATION_KEY',
];

console.log('🔍 Validating Environment Variables...\n');

let hasErrors = false;
let hasWarnings = false;

// Check required variables
Object.entries(requiredVars).forEach(([category, vars]) => {
  console.log(`📋 ${category.toUpperCase()} Variables:`);
  
  vars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      console.log(`  ❌ ${varName}: MISSING (required)`);
      hasErrors = true;
    } else if (value.includes('placeholder')) {
      console.log(`  ⚠️  ${varName}: PLACEHOLDER (needs real value)`);
      hasWarnings = true;
    } else {
      console.log(`  ✅ ${varName}: CONFIGURED`);
    }
  });
  
  console.log('');
});

// Check development variables
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 DEVELOPMENT Variables:');
  
  devVars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      console.log(`  ⚠️  ${varName}: MISSING (recommended for dev)`);
      hasWarnings = true;
    } else {
      console.log(`  ✅ ${varName}: CONFIGURED`);
    }
  });
  
  console.log('');
}

// Check optional variables
console.log('📦 OPTIONAL Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value.includes('placeholder')) {
    console.log(`  ⚪ ${varName}: NOT CONFIGURED (optional)`);
  } else {
    console.log(`  ✅ ${varName}: CONFIGURED`);
  }
});

console.log('');

// Validate specific formats
console.log('🔍 FORMAT Validation:');

// Database URL format
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && !dbUrl.startsWith('postgresql://')) {
  console.log('  ❌ DATABASE_URL: Invalid format (should start with postgresql://)');
  hasErrors = true;
} else if (dbUrl) {
  console.log('  ✅ DATABASE_URL: Valid PostgreSQL format');
}

// Redis URL format
const redisUrl = process.env.REDIS_URL;
if (redisUrl && !redisUrl.startsWith('redis://')) {
  console.log('  ❌ REDIS_URL: Invalid format (should start with redis://)');
  hasErrors = true;
} else if (redisUrl) {
  console.log('  ✅ REDIS_URL: Valid Redis format');
}

// NEXTAUTH_SECRET length
const nextAuthSecret = process.env.NEXTAUTH_SECRET;
if (nextAuthSecret && nextAuthSecret.length < 32) {
  console.log('  ⚠️  NEXTAUTH_SECRET: Too short (should be 32+ characters)');
  hasWarnings = true;
} else if (nextAuthSecret) {
  console.log('  ✅ NEXTAUTH_SECRET: Adequate length');
}

// NEXTAUTH_URL format
const nextAuthUrl = process.env.NEXTAUTH_URL;
if (nextAuthUrl && !nextAuthUrl.startsWith('http')) {
  console.log('  ❌ NEXTAUTH_URL: Invalid format (should start with http/https)');
  hasErrors = true;
} else if (nextAuthUrl) {
  console.log('  ✅ NEXTAUTH_URL: Valid URL format');
}

console.log('');

// Summary
console.log('📊 VALIDATION SUMMARY:');
if (hasErrors) {
  console.log('  ❌ Critical errors found - application may not start');
  process.exit(1);
} else if (hasWarnings) {
  console.log('  ⚠️  Warnings found - some features may be limited');
  console.log('  ℹ️  Application should start but full functionality not guaranteed');
} else {
  console.log('  ✅ All validations passed - ready for development');
}

console.log('');
console.log('💡 For detailed configuration guide, see: ENV_VARIABLES.md');