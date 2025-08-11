#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Validates all required environment variables are present and properly formatted
 */

const fs = require('fs');
const path = require('path');

// Load environment variables, preferring .env then falling back to .env.local
const envPathPrimary = path.join(__dirname, '../.env');
const envPathFallback = path.join(__dirname, '../.env.local');
const chosenEnvPath = fs.existsSync(envPathPrimary)
  ? envPathPrimary
  : (fs.existsSync(envPathFallback) ? envPathFallback : null);

if (chosenEnvPath) {
  const envFile = fs.readFileSync(chosenEnvPath, 'utf8');
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
  // Do not require Datadog in development; prefer optional with warnings
  monitoring: [],
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
  // Preferred RUM envs (prefer NEXT_PUBLIC_DD_* with DATADOG_* fallback)
  'NEXT_PUBLIC_DD_APPLICATION_ID',
  'NEXT_PUBLIC_DD_CLIENT_TOKEN',
  'NEXT_PUBLIC_DD_SITE',
  // Legacy RUM vars (kept to detect and warn)
  'NEXT_PUBLIC_DATADOG_APPLICATION_ID',
  'NEXT_PUBLIC_DATADOG_CLIENT_TOKEN',
  'NEXT_PUBLIC_DATADOG_SITE',
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

// Normalize Datadog env var variants and emit warnings
console.log('🧩 Datadog Environment Normalization:');

// API Key
if (!process.env.DD_API_KEY && process.env.DATADOG_API_KEY) {
  console.log('  ⚠️  DATADOG_API_KEY detected. Prefer DD_API_KEY. Mapping for this process.');
  process.env.DD_API_KEY = process.env.DATADOG_API_KEY;
}
if (process.env.DD_API_KEY && process.env.DATADOG_API_KEY && process.env.DD_API_KEY !== process.env.DATADOG_API_KEY) {
  console.log('  ⚠️  Both DD_API_KEY and DATADOG_API_KEY set and differ. Using DD_API_KEY.');
}

// Application Key
if (!process.env.DD_APP_KEY && process.env.DATADOG_APP_KEY) {
  console.log('  ⚠️  DATADOG_APP_KEY detected. Prefer DD_APP_KEY. Mapping for this process.');
  process.env.DD_APP_KEY = process.env.DATADOG_APP_KEY;
}
if (process.env.DD_APP_KEY && process.env.DATADOG_APP_KEY && process.env.DD_APP_KEY !== process.env.DATADOG_APP_KEY) {
  console.log('  ⚠️  Both DD_APP_KEY and DATADOG_APP_KEY set and differ. Using DD_APP_KEY.');
}

// Site
if (!process.env.DD_SITE && process.env.DATADOG_SITE) {
  console.log('  ⚠️  DATADOG_SITE detected. Prefer DD_SITE. Mapping for this process.');
  process.env.DD_SITE = process.env.DATADOG_SITE;
}
if (process.env.DD_SITE && process.env.DATADOG_SITE && process.env.DD_SITE !== process.env.DATADOG_SITE) {
  console.log('  ⚠️  Both DD_SITE and DATADOG_SITE set and differ. Using DD_SITE.');
}

// Service
if (!process.env.DD_SERVICE && process.env.DATADOG_SERVICE) {
  console.log('  ⚠️  DATADOG_SERVICE detected. Prefer DD_SERVICE. Mapping for this process.');
  process.env.DD_SERVICE = process.env.DATADOG_SERVICE;
}
if (process.env.DD_SERVICE && process.env.DATADOG_SERVICE && process.env.DD_SERVICE !== process.env.DATADOG_SERVICE) {
  console.log('  ⚠️  Both DD_SERVICE and DATADOG_SERVICE set and differ. Using DD_SERVICE.');
}

// RUM/public config mapping and warnings
// Map legacy NEXT_PUBLIC_DATADOG_* to NEXT_PUBLIC_DD_* for this process
if (!process.env.NEXT_PUBLIC_DD_APPLICATION_ID) {
  const legacyAppId = process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID || process.env.NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID
  if (legacyAppId) {
    console.log('  ⚠️  RUM: Legacy DATADOG application id detected. Prefer NEXT_PUBLIC_DD_APPLICATION_ID. Mapping for this process.')
    process.env.NEXT_PUBLIC_DD_APPLICATION_ID = legacyAppId
  }
}
if (process.env.NEXT_PUBLIC_DD_APPLICATION_ID && process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID && process.env.NEXT_PUBLIC_DD_APPLICATION_ID !== process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID) {
  console.log('  ⚠️  Both NEXT_PUBLIC_DD_APPLICATION_ID and NEXT_PUBLIC_DATADOG_APPLICATION_ID set and differ. Using NEXT_PUBLIC_DD_APPLICATION_ID.')
}

if (!process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN) {
  const legacyClientToken = process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN || process.env.NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN
  if (legacyClientToken) {
    console.log('  ⚠️  RUM: Legacy DATADOG client token detected. Prefer NEXT_PUBLIC_DD_CLIENT_TOKEN. Mapping for this process.')
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = legacyClientToken
  }
}
if (process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN && process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN && process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN !== process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN) {
  console.log('  ⚠️  Both NEXT_PUBLIC_DD_CLIENT_TOKEN and NEXT_PUBLIC_DATADOG_CLIENT_TOKEN set and differ. Using NEXT_PUBLIC_DD_CLIENT_TOKEN.')
}

if (!process.env.NEXT_PUBLIC_DD_SITE && process.env.NEXT_PUBLIC_DATADOG_SITE) {
  console.log('  ⚠️  RUM: NEXT_PUBLIC_DATADOG_SITE detected. Prefer NEXT_PUBLIC_DD_SITE. Mapping for this process.')
  process.env.NEXT_PUBLIC_DD_SITE = process.env.NEXT_PUBLIC_DATADOG_SITE
}
if (process.env.NEXT_PUBLIC_DD_SITE && process.env.NEXT_PUBLIC_DATADOG_SITE && process.env.NEXT_PUBLIC_DD_SITE !== process.env.NEXT_PUBLIC_DATADOG_SITE) {
  console.log('  ⚠️  Both NEXT_PUBLIC_DD_SITE and NEXT_PUBLIC_DATADOG_SITE set and differ. Using NEXT_PUBLIC_DD_SITE.')
}

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
