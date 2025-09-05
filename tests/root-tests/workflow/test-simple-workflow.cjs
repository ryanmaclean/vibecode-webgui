#!/usr/bin/env node

/**
 * Simple Workflow Test
 * Tests basic workflow components without requiring a running server
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Simple Workflow Test');
console.log('======================');

async function testWorkflowComponents() {
  const results = {
    projectStructure: false,
    configFiles: false,
    dependencies: false,
    environmentSetup: false
  };

  try {
    // Test project structure
    console.log('📁 Testing project structure...');
    const requiredDirs = ['src', 'src/app', 'src/components', 'src/lib'];
    let dirsExist = 0;
    
    for (const dir of requiredDirs) {
      if (fs.existsSync(dir)) {
        dirsExist++;
      }
    }
    
    console.log(`   ${dirsExist}/${requiredDirs.length} required directories exist`);
    results.projectStructure = dirsExist >= 3;

    // Test configuration files
    console.log('⚙️  Testing configuration files...');
    const configFiles = ['package.json', 'next.config.js', 'tailwind.config.js'];
    let configsExist = 0;
    
    for (const file of configFiles) {
      if (fs.existsSync(file)) {
        configsExist++;
      }
    }
    
    console.log(`   ${configsExist}/${configFiles.length} configuration files exist`);
    results.configFiles = configsExist >= 2;

    // Test dependencies
    console.log('📦 Testing dependencies...');
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const requiredDeps = ['next', 'react', '@prisma/client'];
      let depsExist = 0;
      
      for (const dep of requiredDeps) {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
          depsExist++;
        }
      }
      
      console.log(`   ${depsExist}/${requiredDeps.length} required dependencies found`);
      results.dependencies = depsExist >= 2;
    } catch (error) {
      console.log('   ❌ Could not read package.json');
    }

    // Test environment setup
    console.log('🔧 Testing environment setup...');
    const envVars = ['DATABASE_URL', 'NEXTAUTH_SECRET'];
    let envVarsSet = 0;
    
    for (const envVar of envVars) {
      if (process.env[envVar]) {
        envVarsSet++;
      }
    }
    
    console.log(`   ${envVarsSet}/${envVars.length} required environment variables set`);
    results.environmentSetup = envVarsSet >= 1;

    // Calculate overall success
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    const success = passedTests >= 3; // At least 3 out of 4 tests must pass

    console.log('\n📊 Workflow Test Results:');
    console.log(`   Project structure: ${results.projectStructure ? '✅' : '❌'}`);
    console.log(`   Configuration files: ${results.configFiles ? '✅' : '❌'}`);
    console.log(`   Dependencies: ${results.dependencies ? '✅' : '❌'}`);
    console.log(`   Environment setup: ${results.environmentSetup ? '✅' : '❌'}`);
    console.log(`\n   Overall: ${passedTests}/${totalTests} tests passed`);

    return { success, passedTests, totalTests, results };

  } catch (error) {
    console.log(`❌ Workflow test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

const startTime = Date.now();
testWorkflowComponents()
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
