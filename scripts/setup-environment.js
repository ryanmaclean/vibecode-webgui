#!/usr/bin/env node
/**
 * Environment Setup Script
 * Helps users set up their environment configuration with guided prompts
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const ENV_LOCAL_PATH = path.join(process.cwd(), '.env.local');
const ENV_EXAMPLE_PATH = path.join(process.cwd(), '.env.local.example');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color] || colors.reset}${text}${colors.reset}`;
}

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

async function promptUser(question, defaultValue = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const prompt = defaultValue 
      ? `${question} (${colorize(defaultValue, 'yellow')}): `
      : `${question}: `;
    
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function checkExistingEnv() {
  if (fs.existsSync(ENV_LOCAL_PATH)) {
    console.log(colorize('⚠️  .env.local already exists!', 'yellow'));
    const overwrite = await promptUser('Do you want to overwrite it? (y/N)', 'N');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Exiting without changes.');
      process.exit(0);
    }
    
    // Create backup
    const backupPath = `${ENV_LOCAL_PATH}.backup.${Date.now()}`;
    fs.copyFileSync(ENV_LOCAL_PATH, backupPath);
    console.log(colorize(`✅ Backup created: ${backupPath}`, 'green'));
  }
}

async function setupEnvironment() {
  console.log(colorize('🚀 VibeCode Environment Setup', 'cyan'));
  console.log('This script will help you configure your environment variables.\n');

  await checkExistingEnv();

  const config = {};

  // Core settings
  console.log(colorize('📋 Core Application Settings', 'blue'));
  config.NODE_ENV = await promptUser('Environment', 'development');
  config.PORT = await promptUser('Port', '3000');
  config.NEXT_PUBLIC_APP_URL = await promptUser('App URL', `http://localhost:${config.PORT}`);

  // Authentication
  console.log(colorize('\n🔐 Authentication Configuration', 'blue'));
  config.NEXTAUTH_URL = config.NEXT_PUBLIC_APP_URL;
  
  const generateNextAuthSecret = await promptUser('Generate NEXTAUTH_SECRET automatically? (Y/n)', 'Y');
  if (generateNextAuthSecret.toLowerCase() !== 'n') {
    config.NEXTAUTH_SECRET = generateSecret();
    console.log(colorize('✅ Generated secure NEXTAUTH_SECRET', 'green'));
  } else {
    config.NEXTAUTH_SECRET = await promptUser('NEXTAUTH_SECRET (min 32 chars)');
  }

  // Database
  console.log(colorize('\n🗃️  Database Configuration', 'blue'));
  config.DATABASE_URL = await promptUser(
    'PostgreSQL URL', 
    'postgresql://vibecode:password@localhost:5432/vibecode'
  );
  
  const setupMongo = await promptUser('Setup MongoDB for chat features? (y/N)', 'N');
  if (setupMongo.toLowerCase() === 'y') {
    config.MONGODB_URL = await promptUser(
      'MongoDB URL',
      'mongodb://localhost:27017/vibecode_chat'
    );
  }

  // Cache
  console.log(colorize('\n⚡ Cache Configuration', 'blue'));
  config.VALKEY_URL = await promptUser('Valkey/Redis URL', 'redis://localhost:6379');

  // AI Services
  console.log(colorize('\n🤖 AI Service Configuration', 'blue'));
  const aiProvider = await promptUser('Primary AI provider (openrouter/openai/anthropic)', 'openrouter');
  
  switch (aiProvider.toLowerCase()) {
    case 'openrouter':
      config.OPENROUTER_API_KEY = await promptUser('OpenRouter API Key', 'your-openrouter-api-key-here');
      break;
    case 'openai':
      config.OPENAI_API_KEY = await promptUser('OpenAI API Key', 'your-openai-api-key');
      break;
    case 'anthropic':
      config.ANTHROPIC_API_KEY = await promptUser('Anthropic API Key', 'your-anthropic-api-key');
      break;
  }

  // Monitoring
  console.log(colorize('\n📊 Monitoring Configuration', 'blue'));
  const enableMonitoring = await promptUser('Enable Datadog monitoring? (y/N)', 'N');
  if (enableMonitoring.toLowerCase() === 'y') {
    config.DD_API_KEY = await promptUser('Datadog API Key', 'your-datadog-api-key-here');
    config.DD_SITE = await promptUser('Datadog Site', 'datadoghq.com');
    config.DD_ENV = config.NODE_ENV;
    config.DD_SERVICE = 'vibecode-webgui';
    config.DD_VERSION = '1.0.0';
  } else {
    config.DD_API_KEY = 'dummy-key-for-local-dev';
    config.DD_SITE = 'datadoghq.com';
    config.DD_ENV = config.NODE_ENV;
    config.DD_SERVICE = 'vibecode-webgui';
    config.DD_VERSION = '1.0.0';
  }

  // Development tools
  console.log(colorize('\n🛠️  Development Tools', 'blue'));
  const enableCodeServer = await promptUser('Enable Code Server integration? (y/N)', 'N');
  if (enableCodeServer.toLowerCase() === 'y') {
    config.CODE_SERVER_BASE_URL = await promptUser('Code Server URL', 'http://localhost:8080');
    config.WORKSPACE_BASE_PATH = await promptUser('Workspace Path', '/workspace');
  }

  // Generate additional secrets
  const generateJWTSecret = await promptUser('\nGenerate JWT_SECRET? (Y/n)', 'Y');
  if (generateJWTSecret.toLowerCase() !== 'n') {
    config.JWT_SECRET = generateSecret();
    console.log(colorize('✅ Generated secure JWT_SECRET', 'green'));
  }

  return config;
}

function generateEnvFile(config) {
  let envContent = `# VibeCode WebGUI Environment Variables
# Generated by setup script on ${new Date().toISOString()}
# =================================================================

`;

  // Core settings
  envContent += `# ================================
# CORE APPLICATION SETTINGS
# ================================
NODE_ENV=${config.NODE_ENV}
PORT=${config.PORT}
NEXT_PUBLIC_APP_URL=${config.NEXT_PUBLIC_APP_URL}

`;

  // Authentication
  envContent += `# ================================
# AUTHENTICATION (REQUIRED)
# ================================
NEXTAUTH_URL=${config.NEXTAUTH_URL}
NEXTAUTH_SECRET=${config.NEXTAUTH_SECRET}

`;

  // Database
  envContent += `# ================================
# DATABASE CONFIGURATION
# ================================
DATABASE_URL=${config.DATABASE_URL}
`;

  if (config.MONGODB_URL) {
    envContent += `MONGODB_URL=${config.MONGODB_URL}
`;
  }

  envContent += `
`;

  // Cache
  envContent += `# ================================
# REDIS/VALKEY CACHE
# ================================
VALKEY_URL=${config.VALKEY_URL}
REDIS_URL=${config.VALKEY_URL}

`;

  // AI Services
  envContent += `# ================================
# AI SERVICE CONFIGURATION
# ================================
`;

  if (config.OPENROUTER_API_KEY) {
    envContent += `OPENROUTER_API_KEY=${config.OPENROUTER_API_KEY}
`;
  }
  if (config.OPENAI_API_KEY) {
    envContent += `OPENAI_API_KEY=${config.OPENAI_API_KEY}
`;
  }
  if (config.ANTHROPIC_API_KEY) {
    envContent += `ANTHROPIC_API_KEY=${config.ANTHROPIC_API_KEY}
`;
  }

  envContent += `DEFAULT_LLM_MODEL=anthropic/claude-3-sonnet
AI_REQUEST_TIMEOUT=30000

`;

  // Monitoring
  envContent += `# ================================
# DATADOG MONITORING
# ================================
DD_API_KEY=${config.DD_API_KEY}
DD_SITE=${config.DD_SITE}
DD_ENV=${config.DD_ENV}
DD_SERVICE=${config.DD_SERVICE}
DD_VERSION=${config.DD_VERSION}

`;

  // Development tools
  if (config.CODE_SERVER_BASE_URL) {
    envContent += `# ================================
# DEVELOPMENT TOOLS
# ================================
CODE_SERVER_BASE_URL=${config.CODE_SERVER_BASE_URL}
WORKSPACE_BASE_PATH=${config.WORKSPACE_BASE_PATH}

`;
  }

  // Security
  if (config.JWT_SECRET) {
    envContent += `# ================================
# SECURITY
# ================================
JWT_SECRET=${config.JWT_SECRET}

`;
  }

  // Additional settings
  envContent += `# ================================
# FEATURE FLAGS
# ================================
ENABLE_MONITORING=true
ENABLE_DEBUG_LOGGING=true
AI_PROJECT_GENERATION_ENABLED=true
`;

  return envContent;
}

async function validateSetup() {
  console.log(colorize('\n🔍 Validating environment setup...', 'cyan'));
  
  try {
    // Try to load and validate the environment
    require('dotenv').config({ path: ENV_LOCAL_PATH });
    
    const { validateEnvironmentVariables } = require('../src/lib/env-validation');
    const result = validateEnvironmentVariables();
    
    if (result.isValid) {
      console.log(colorize('✅ Environment validation passed!', 'green'));
    } else {
      console.log(colorize('⚠️  Some validation warnings:', 'yellow'));
      result.warnings.forEach(warning => {
        console.log(colorize(`  • ${warning}`, 'yellow'));
      });
      result.suggestions.forEach(suggestion => {
        console.log(colorize(`  💡 ${suggestion}`, 'blue'));
      });
    }
  } catch (error) {
    console.log(colorize('⚠️  Could not validate environment (this is normal during initial setup)', 'yellow'));
  }
}

function showNextSteps() {
  console.log(colorize('\n🎉 Environment setup complete!', 'green'));
  console.log('\n📋 Next steps:');
  console.log(colorize('  1. Review your .env.local file', 'cyan'));
  console.log(colorize('  2. Update any placeholder values with real credentials', 'cyan'));
  console.log(colorize('  3. Install dependencies: npm install --legacy-peer-deps', 'cyan'));
  console.log(colorize('  4. Set up your database: npm run db:deploy', 'cyan'));
  console.log(colorize('  5. Start development: npm run dev', 'cyan'));
  console.log('\n📚 Documentation:');
  console.log(colorize('  • Environment guide: docs/wiki-archive/ENV_VARIABLES.md', 'blue'));
  console.log(colorize('  • Quick start: QUICK_START_REFERENCE.md', 'blue'));
  console.log(colorize('  • Full README: README.md', 'blue'));
}

async function main() {
  try {
    const config = await setupEnvironment();
    const envContent = generateEnvFile(config);
    
    fs.writeFileSync(ENV_LOCAL_PATH, envContent);
    console.log(colorize(`\n✅ Created ${ENV_LOCAL_PATH}`, 'green'));
    
    await validateSetup();
    showNextSteps();
  } catch (error) {
    console.error(colorize('\n❌ Setup failed:', 'red'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { setupEnvironment, generateEnvFile };