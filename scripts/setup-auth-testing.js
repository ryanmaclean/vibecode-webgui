#!/usr/bin/env node

/**
 * Quick setup script for authentication testing
 * Creates .env.local with required settings if it doesn't exist
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(process.cwd(), '.env.local');

console.log('🔧 VibeCode Authentication Testing Setup');
console.log('=' .repeat(45));

// Check if .env.local already exists
if (fs.existsSync(envPath)) {
  console.log('✅ .env.local already exists');
  console.log('📝 Current environment configuration detected');
} else {
  console.log('📝 Creating .env.local for authentication testing...');
  
  // Generate a secure NextAuth secret
  const nextAuthSecret = crypto.randomBytes(32).toString('hex');
  
  const envContent = `# VibeCode Authentication Testing Environment
# Generated automatically for development

# Core Application Settings
NODE_ENV=development
NEXTAUTH_SECRET=${nextAuthSecret}
NEXTAUTH_URL=http://localhost:3000

# Development Mode - Enables test users
ENVIRONMENT=local

# Mock API Keys for Development (replace with real keys for full testing)
OPENAI_API_KEY=sk-mock-key-for-development-testing
OPENROUTER_API_KEY=sk-or-mock-key-for-development

# Database (optional - file-based auth works without database)
# DATABASE_URL=postgresql://vibecode:password@localhost:5432/vibecode

# Redis (optional - in-memory fallback available)
# REDIS_URL=redis://localhost:6379

# Datadog (optional - mock keys for development)
DD_API_KEY=mock-datadog-key-for-development
DD_SITE=datadoghq.com

# Enable development testing features
MOCK_ORIGINS=true

# OAuth (will be needed for production deployment)
# GITHUB_ID=your-github-oauth-id
# GITHUB_SECRET=your-github-oauth-secret
# GOOGLE_CLIENT_ID=your-google-oauth-id  
# GOOGLE_CLIENT_SECRET=your-google-oauth-secret
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env.local created with authentication testing configuration');
}

// Verify key environment variables
const requiredVars = [
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'NODE_ENV'
];

console.log('\n🔍 Environment Validation:');

// Load environment variables
require('dotenv').config({ path: envPath });

let allValid = true;
for (const varName of requiredVars) {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.length > 20 ? value.substring(0, 20) + '...' : value}`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
    allValid = false;
  }
}

console.log('\n📋 Next Steps:');
console.log('1. Start the development server: npm run dev');
console.log('2. Test authentication: node tests/root-tests/credentials/test-credentials.cjs');
console.log('3. Test protected endpoints: node tests/root-tests/test-protected-endpoints.cjs');
console.log('4. Visit http://localhost:3000/auth/signin to sign in manually');

console.log('\n👥 Available Test Users:');
const testUsers = [
  'admin@vibecode.dev / admin123 (Admin)',
  'developer@vibecode.dev / dev123 (Developer)', 
  'tester@vibecode.dev / test123 (User)',
  '...and 7 more (see AUTHENTICATION_TESTING_GUIDE.md)'
];

testUsers.forEach(user => console.log(`   • ${user}`));

if (allValid) {
  console.log('\n🎉 Authentication testing environment is ready!');
} else {
  console.log('\n⚠️  Some environment variables are missing. Check .env.local');
  console.log('   Authentication may still work but some features might be limited.');
}

console.log('\n📚 For detailed testing instructions, see:');
console.log('   AUTHENTICATION_TESTING_GUIDE.md');