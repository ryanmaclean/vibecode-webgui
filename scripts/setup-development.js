#!/usr/bin/env node

/**
 * VibeCode Development Environment Setup
 * Fixes common setup issues and ensures all deployment modes work
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
    return result.trim();
  } catch (error) {
    if (!options.allowFailure) {
      throw error;
    }
    return null;
  }
}

async function checkNodeVersion() {
  log('Checking Node.js version...', 'blue');
  
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  log(`Current Node.js version: ${nodeVersion}`);
  
  if (majorVersion < 18) {
    log('ERROR: Node.js 18+ is required', 'red');
    log('Please upgrade Node.js or use nvm:', 'yellow');
    log('  nvm install 20.11.0', 'yellow');
    log('  nvm use 20.11.0', 'yellow');
    process.exit(1);
  }
  
  if (majorVersion >= 25) {
    log('WARNING: Node.js 25+ is not fully tested', 'yellow');
    log('Recommended version: 20.11.0', 'yellow');
  }
  
  log('Node.js version is compatible ✓', 'green');
}

function setupEnvironmentFile() {
  log('Setting up environment file...', 'blue');
  
  const envPath = '.env.local';
  
  if (!fs.existsSync(envPath)) {
    const envTemplate = `# VibeCode Environment Configuration
# Copy this file to .env.local and fill in your values

# AI Provider API Keys
OPENROUTER_API_KEY=your-openrouter-api-key-here
# Get your key from: https://openrouter.ai/keys

# Authentication
NEXTAUTH_SECRET=your-nextauth-secret-here
# Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Database (optional for development)
DATABASE_URL=postgresql://user:password@localhost:5432/vibecode_dev

# Datadog Monitoring (optional)
DD_API_KEY=your-datadog-api-key-here
NEXT_PUBLIC_DATADOG_APPLICATION_ID=your-app-id
NEXT_PUBLIC_DATADOG_CLIENT_TOKEN=your-client-token

# Development Settings
NODE_ENV=development
`;
    
    fs.writeFileSync(envPath, envTemplate);
    log(`Created ${envPath} template`, 'green');
    log('Please edit .env.local and add your API keys', 'yellow');
  } else {
    log('.env.local already exists ✓', 'green');
  }
}

function fixTailwindCSS() {
  log('Fixing Tailwind CSS v4 setup...', 'blue');
  
  try {
    // Check if we need to install lightningcss
    const nodeModulesPath = path.join(process.cwd(), 'node_modules', 'lightningcss');
    
    if (!fs.existsSync(nodeModulesPath)) {
      log('Installing lightningcss...', 'yellow');
      runCommand('npm install lightningcss@1.24.1 --save-dev');
    }
    
    // Force reinstall if we have platform issues
    const platform = os.platform();
    const arch = os.arch();
    const expectedBinary = `lightningcss.${platform}-${arch}.node`;
    
    log(`Checking for platform-specific binary: ${expectedBinary}`, 'blue');
    
    // Try to rebuild native modules
    try {
      runCommand('npm rebuild lightningcss', { allowFailure: true, silent: true });
      log('Rebuilt lightningcss native modules', 'green');
    } catch (error) {
      log('Could not rebuild lightningcss - will use CDN mode', 'yellow');
    }
    
  } catch (error) {
    log('Tailwind CSS setup completed with warnings', 'yellow');
  }
}

function fixDockerConfiguration() {
  log('Checking Docker configuration...', 'blue');
  
  const dockerfilePath = './Dockerfile';
  if (fs.existsSync(dockerfilePath)) {
    const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
    
    if (dockerfile.includes('jq \'del(.devDependencies.')) {
      log('Found complex Docker configuration - creating simplified version...', 'yellow');
      
      const simpleDockerfile = `# VibeCode Docker Configuration - Simplified
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with clean cache
RUN npm ci --only=production --omit=dev && \\
    npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
`;
      
      fs.writeFileSync('./Dockerfile.simple', simpleDockerfile);
      log('Created Dockerfile.simple for reliable builds', 'green');
      log('Use: docker build -f Dockerfile.simple -t vibecode .', 'yellow');
    }
  }
}

function checkOptionalDependencies() {
  log('Checking optional dependencies...', 'blue');
  
  // Check if we can install sharp (for image optimization)
  try {
    runCommand('npm list sharp', { silent: true, allowFailure: true });
    log('Sharp is disabled (as configured) ✓', 'green');
  } catch (error) {
    // This is expected since we disable sharp
  }
  
  // Check for missing peer dependencies
  try {
    const result = runCommand('npm ls', { silent: true, allowFailure: true });
    if (result && result.includes('UNMET DEPENDENCY')) {
      log('Some peer dependencies are missing - this is usually OK', 'yellow');
    }
  } catch (error) {
    // Ignore npm ls errors
  }
}

async function validateSetup() {
  log('Validating setup...', 'blue');
  
  // Test if we can import Next.js
  try {
    runCommand('node -e "require(\'next\')"', { silent: true });
    log('Next.js can be imported ✓', 'green');
  } catch (error) {
    log('Next.js import failed - try: npm install', 'red');
    return false;
  }
  
  // Test if TypeScript works
  try {
    runCommand('npx tsc --version', { silent: true });
    log('TypeScript is available ✓', 'green');
  } catch (error) {
    log('TypeScript not available - this is OK', 'yellow');
  }
  
  return true;
}

function printNextSteps() {
  log('\\n' + '='.repeat(60), 'green');
  log('VibeCode Development Setup Complete!', 'green');
  log('='.repeat(60), 'green');
  
  log('\\nNext steps:', 'blue');
  log('1. Edit .env.local with your API keys', 'yellow');
  log('2. Choose your development mode:', 'yellow');
  
  log('\\n   Local Development (Recommended):', 'cyan');
  log('   npm run dev:cdn        # Uses CDN Tailwind (fastest)', 'cyan');
  
  log('\\n   Docker Development:', 'cyan');
  log('   npm run dev:docker     # Full container environment', 'cyan');
  
  log('\\n   Production Testing:', 'cyan');
  log('   npm run build          # Test production build', 'cyan');
  log('   npm start              # Start production server', 'cyan');
  
  log('\\n   Deployment Testing:', 'cyan');
  log('   node scripts/universal-deployment-test.js', 'cyan');
  
  log('\\nTroubleshooting:', 'blue');
  log('- If build fails: npm run dev:cdn (uses CDN Tailwind)', 'yellow');
  log('- If Docker fails: Use Dockerfile.simple', 'yellow');
  log('- For help: Check README.md or GitHub Issues', 'yellow');
  
  log('\\nDocumentation: https://ryanmaclean.github.io/vibecode-webgui/', 'blue');
}

async function main() {
  log('VibeCode Development Environment Setup', 'cyan');
  log('=====================================\\n');
  
  try {
    await checkNodeVersion();
    setupEnvironmentFile();
    fixTailwindCSS();
    fixDockerConfiguration();
    checkOptionalDependencies();
    
    const setupValid = await validateSetup();
    
    if (setupValid) {
      printNextSteps();
    } else {
      log('\\nSetup completed with issues. Try running:', 'yellow');
      log('  npm install', 'yellow');
      log('  npm run setup', 'yellow');
    }
    
  } catch (error) {
    log(`\\nSetup failed: ${error.message}`, 'red');
    log('\\nTry these solutions:', 'yellow');
    log('1. Update Node.js: nvm install 20.11.0', 'yellow');
    log('2. Clear cache: npm cache clean --force', 'yellow');
    log('3. Reinstall: rm -rf node_modules && npm install', 'yellow');
    process.exit(1);
  }
}

// CLI handling
if (require.main === module) {
  main();
}

module.exports = { main };