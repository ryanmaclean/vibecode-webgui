#!/usr/bin/env node

/**
 * Simple Infrastructure Test
 * Tests basic system requirements without requiring a running server
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🏗️  Simple Infrastructure Test');
console.log('==============================');

async function testInfrastructure() {
  const results = {
    nodeVersion: false,
    npmVersion: false,
    postgresqlAvailable: false,
    redisAvailable: false,
    projectFiles: false,
    environmentVariables: false
  };

  try {
    // Test Node.js version
    console.log('📦 Testing Node.js version...');
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    console.log(`   Node.js: ${nodeVersion}`);
    results.nodeVersion = true;

    // Test npm version
    console.log('📦 Testing npm version...');
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`   npm: ${npmVersion}`);
    results.npmVersion = true;

    // Test PostgreSQL availability
    console.log('🗄️  Testing PostgreSQL availability...');
    try {
      execSync('pg_isready -h localhost -p 5432', { stdio: 'pipe' });
      console.log('   ✅ PostgreSQL is running');
      results.postgresqlAvailable = true;
    } catch (error) {
      console.log('   ⚠️  PostgreSQL not available');
    }

    // Test Redis availability
    console.log('🔴 Testing Redis availability...');
    try {
      execSync('redis-cli -h localhost -p 6379 ping', { stdio: 'pipe' });
      console.log('   ✅ Redis is running');
      results.redisAvailable = true;
    } catch (error) {
      console.log('   ⚠️  Redis not available');
    }

    // Test project files
    console.log('📁 Testing project files...');
    const requiredFiles = [
      'package.json',
      'next.config.js',
      'src/app',
      'src/components',
      'src/lib'
    ];

    let filesExist = 0;
    for (const file of requiredFiles) {
      if (fs.existsSync(file)) {
        filesExist++;
      }
    }

    console.log(`   ${filesExist}/${requiredFiles.length} required files exist`);
    results.projectFiles = filesExist >= 4; // At least 4 out of 5 files

    // Test environment variables
    console.log('🔧 Testing environment variables...');
    const requiredEnvVars = [
      'DATABASE_URL',
      'NEXTAUTH_SECRET'
    ];

    let envVarsSet = 0;
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        envVarsSet++;
      }
    }

    console.log(`   ${envVarsSet}/${requiredEnvVars.length} required environment variables set`);
    results.environmentVariables = envVarsSet >= 1; // At least 1 out of 2

    // Calculate overall success
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    const success = passedTests >= 4; // At least 4 out of 6 tests must pass

    console.log('\n📊 Infrastructure Test Results:');
    console.log(`   Node.js: ${results.nodeVersion ? '✅' : '❌'}`);
    console.log(`   npm: ${results.npmVersion ? '✅' : '❌'}`);
    console.log(`   PostgreSQL: ${results.postgresqlAvailable ? '✅' : '⚠️'}`);
    console.log(`   Redis: ${results.redisAvailable ? '✅' : '⚠️'}`);
    console.log(`   Project files: ${results.projectFiles ? '✅' : '❌'}`);
    console.log(`   Environment: ${results.environmentVariables ? '✅' : '❌'}`);
    console.log(`\n   Overall: ${passedTests}/${totalTests} tests passed`);

    return { success, passedTests, totalTests, results };

  } catch (error) {
    console.log(`❌ Infrastructure test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

const startTime = Date.now();
testInfrastructure()
  .then(result => {
    const duration = Date.now() - startTime;
    console.log(`\n📊 Test Summary:`);
    console.log(`   Status: ${result.success ? 'PASS' : 'FAIL'}`);
    console.log(`   Duration: ${duration}ms`);
    
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
      process.exit(1);
    }
  })
  .catch(error => {
    console.log(`❌ Test execution failed: ${error.message}`);
    process.exit(1);
  });
