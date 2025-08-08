#!/usr/bin/env node

/**
 * VibeCode Deployment Script
 * Automates deployment to various cloud platforms
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// Color console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
}

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

// Platform configurations
const platforms = {
  vercel: {
    name: 'Vercel',
    icon: '▲',
    install: 'npm install -g vercel',
    deploy: 'vercel --prod',
    envFile: '.env',
    docs: 'https://vercel.com/docs'
  },
  netlify: {
    name: 'Netlify',
    icon: '🌐',
    install: 'npm install -g netlify-cli',
    deploy: 'netlify deploy --prod --dir=.next',
    envFile: '.env',
    docs: 'https://docs.netlify.com'
  },
  railway: {
    name: 'Railway',
    icon: '🚄',
    install: 'npm install -g @railway/cli',
    deploy: 'railway deploy',
    envFile: '.env',
    docs: 'https://docs.railway.app'
  }
}

// Required environment variables
const requiredEnvVars = [
  'OPENROUTER_API_KEY',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
]

async function main() {
  log('\n🚀 VibeCode Deployment Assistant\n', 'cyan')
  log('This script will help you deploy VibeCode to your preferred cloud platform.\n')

  // Check if this is a VibeCode project
  if (!fs.existsSync('package.json')) {
    log('❌ Error: package.json not found. Are you in the VibeCode project directory?', 'red')
    process.exit(1)
  }

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  if (packageJson.name !== 'vibecode-webgui') {
    log('❌ Error: This doesn\'t appear to be a VibeCode project.', 'red')
    process.exit(1)
  }

  log('✅ VibeCode project detected!', 'green')

  // Check prerequisites
  await checkPrerequisites()

  // Platform selection
  const platform = await selectPlatform()

  // Environment setup
  await setupEnvironment(platform)

  // Build and deploy
  await buildAndDeploy(platform)

  log('\n🎉 Deployment completed successfully!', 'green')
  log(`📖 View deployment docs: ${platforms[platform].docs}`, 'blue')

  rl.close()
}

async function checkPrerequisites() {
  log('\n📋 Checking prerequisites...', 'yellow')

  // Check Node.js version
  const nodeVersion = process.version
  log(`Node.js version: ${nodeVersion}`)

  // Check npm
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim()
    log(`npm version: ${npmVersion}`)
  } catch (error) {
    log('❌ npm is not installed', 'red')
    process.exit(1)
  }

  // Check git
  try {
    execSync('git --version', { encoding: 'utf8' })
    log('✅ git is available')
  } catch (error) {
    log('❌ git is not installed', 'red')
    process.exit(1)
  }

  // Check if project is built
  if (!fs.existsSync('.next')) {
    log('📦 Building project...', 'yellow')
    try {
      execSync('npm run build', { stdio: 'inherit' })
      log('✅ Build completed', 'green')
    } catch (error) {
      log('❌ Build failed', 'red')
      process.exit(1)
    }
  } else {
    log('✅ Project is already built')
  }
}

async function selectPlatform() {
  log('\n🎯 Select deployment platform:', 'yellow')

  const platformKeys = Object.keys(platforms)
  platformKeys.forEach((key, index) => {
    const platform = platforms[key]
    log(`${index + 1}. ${platform.icon} ${platform.name}`)
  })

  const choice = await question('\nEnter your choice (1-3): ')
  const platformIndex = parseInt(choice) - 1

  if (platformIndex < 0 || platformIndex >= platformKeys.length) {
    log('❌ Invalid choice', 'red')
    process.exit(1)
  }

  const selectedPlatform = platformKeys[platformIndex]
  log(`✅ Selected: ${platforms[selectedPlatform].name}`, 'green')

  // Check if CLI is installed
  const platform = platforms[selectedPlatform]
  try {
    if (selectedPlatform === 'vercel') {
      execSync('vercel --version', { encoding: 'utf8' })
    } else if (selectedPlatform === 'netlify') {
      execSync('netlify --version', { encoding: 'utf8' })
    } else if (selectedPlatform === 'railway') {
      execSync('railway --version', { encoding: 'utf8' })
    }
    log(`✅ ${platform.name} CLI is installed`)
  } catch (error) {
    log(`❌ ${platform.name} CLI is not installed`, 'red')
    log(`Install it with: ${platform.install}`, 'yellow')
    process.exit(1)
  }

  return selectedPlatform
}

async function setupEnvironment(platform) {
  log('\n🔧 Setting up environment variables...', 'yellow')

  const envFile = platforms[platform].envFile
  const envPath = path.join(process.cwd(), envFile)

  // Check existing env file
  let existingEnv = {}
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=')
      if (key && value) {
        existingEnv[key.trim()] = value.trim()
      }
    })
  }

  log(`Environment file: ${envFile}`)

  // Check required variables
  const missingVars = requiredEnvVars.filter(varName => !existingEnv[varName])

  if (missingVars.length > 0) {
    log('\n❌ Missing required environment variables:', 'red')
    missingVars.forEach(varName => log(`  - ${varName}`))

    const setup = await question('\nWould you like to set them up now? (y/n): ')
    if (setup.toLowerCase() === 'y') {
      await promptForEnvironmentVariables(envPath, existingEnv)
    } else {
      log('\n⚠️  Please set up environment variables manually before deployment.', 'yellow')
      log('Required variables:', 'yellow')
      requiredEnvVars.forEach(varName => {
        log(`  ${varName}=your-value-here`)
      })
      process.exit(1)
    }
  } else {
    log('✅ All required environment variables are set', 'green')
  }
}

async function promptForEnvironmentVariables(envPath, existingEnv) {
  log('\n📝 Setting up environment variables...', 'yellow')

  const envVars = { ...existingEnv }

  // OpenRouter API Key
  if (!envVars.OPENROUTER_API_KEY) {
    log('\n🤖 OpenRouter API Key:')
    log('Get your API key from: https://openrouter.ai/keys', 'blue')
    envVars.OPENROUTER_API_KEY = await question('Enter your OpenRouter API key: ')
  }

  // NextAuth Secret
  if (!envVars.NEXTAUTH_SECRET) {
    log('\n🔐 NextAuth Secret:')
    log('This should be a random string for JWT encryption', 'blue')
    const generateSecret = await question('Generate a random secret? (y/n): ')
    if (generateSecret.toLowerCase() === 'y') {
      envVars.NEXTAUTH_SECRET = require('crypto').randomBytes(32).toString('hex')
      log(`Generated secret: ${envVars.NEXTAUTH_SECRET}`, 'green')
    } else {
      envVars.NEXTAUTH_SECRET = await question('Enter your NextAuth secret: ')
    }
  }

  // NextAuth URL
  if (!envVars.NEXTAUTH_URL) {
    log('\n🌐 NextAuth URL:')
    log('This will be updated to your deployed URL after deployment', 'blue')
    envVars.NEXTAUTH_URL = await question('Enter your app URL (or use http://localhost:3000 for now): ') || 'http://localhost:3000'
  }

  // Write env file
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  fs.writeFileSync(envPath, envContent)
  log(`✅ Environment variables saved to ${envPath}`, 'green')
}

async function buildAndDeploy(platform) {
  log(`\n🚀 Deploying to ${platforms[platform].name}...`, 'yellow')

  try {
    // Run deployment command
    execSync(platforms[platform].deploy, { stdio: 'inherit' })
    log(`\n✅ Successfully deployed to ${platforms[platform].name}!`, 'green')
  } catch (error) {
    log(`\n❌ Deployment to ${platforms[platform].name} failed`, 'red')
    log('Check the error output above for details.', 'yellow')
    process.exit(1)
  }
}

// Handle CLI arguments
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  log('VibeCode Deployment Script', 'cyan')
  log('Usage: node scripts/deploy.js [options]')
  log('\nOptions:')
  log('  --help, -h    Show this help message')
  log('  --version     Show version')
  log('\nExample:')
  log('  node scripts/deploy.js')
  process.exit(0)
}

if (args.includes('--version')) {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  log(`VibeCode v${packageJson.version}`)
  process.exit(0)
}

// Run main function
main().catch(error => {
  log(`\n❌ Error: ${error.message}`, 'red')
  process.exit(1)
})
