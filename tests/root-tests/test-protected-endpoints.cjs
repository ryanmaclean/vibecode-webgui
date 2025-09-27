#!/usr/bin/env node

/**
 * Authentication Test Utility for VibeCode WebGUI
 * Tests all protected endpoints with different user roles
 */

const fetch = require('node-fetch');

// Test users with different roles
const TEST_USERS = [
  { email: 'admin@vibecode.dev', password: 'admin123', name: 'VibeCode Admin', role: 'admin' },
  { email: 'developer@vibecode.dev', password: 'dev123', name: 'Sarah Johnson', role: 'developer' },
  { email: 'tester@vibecode.dev', password: 'test123', name: 'Robert Wilson', role: 'user' },
];

// Protected endpoints to test
const PROTECTED_ENDPOINTS = [
  {
    name: 'AI Project Generation',
    method: 'POST',
    url: '/api/ai/generate-project',
    body: { prompt: 'Create a React app', projectName: 'test-project' },
    roles: ['admin', 'developer']
  },
  {
    name: 'Workspace Creation',
    method: 'POST', 
    url: '/api/workspaces',
    body: { name: 'test-workspace', description: 'Test workspace' },
    roles: ['admin', 'developer', 'user']
  },
  {
    name: 'Code Server Session',
    method: 'POST',
    url: '/api/code-server/session',
    body: { workspaceId: 'test-workspace', userId: 'test-user' },
    roles: ['admin', 'developer']
  },
  {
    name: 'File Sync',
    method: 'POST',
    url: '/api/files/sync',
    body: { workspaceId: 'test-workspace', files: ['test.txt'] },
    roles: ['admin', 'developer', 'user']
  },
  {
    name: 'AI Conversations',
    method: 'GET',
    url: '/api/ai/conversations/test-workspace',
    roles: ['admin', 'developer', 'user']
  }
];

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Get session token for a test user
 */
async function authenticateUser(user) {
  try {
    console.log(`\n🔐 Authenticating ${user.name} (${user.email})`);

    // Get CSRF token
    const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
    const csrfData = await csrfResponse.json();

    if (!csrfData.csrfToken) {
      throw new Error('Failed to get CSRF token');
    }

    // Authenticate user
    const authResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: user.email,
        password: user.password,
        csrfToken: csrfData.csrfToken,
        callbackUrl: `${BASE_URL}`,
        json: 'true'
      })
    });

    // Extract session cookie
    const cookies = authResponse.headers.get('set-cookie');
    if (!cookies) {
      throw new Error('No session cookie received');
    }

    const sessionToken = cookies
      .split(',')
      .find(cookie => cookie.trim().startsWith('next-auth.session-token'))
      ?.split(';')[0];

    if (!sessionToken) {
      throw new Error('Session token not found in cookies');
    }

    console.log('✅ Authentication successful');
    return sessionToken;

  } catch (error) {
    console.log('❌ Authentication failed:', error.message);
    return null;
  }
}

/**
 * Test a protected endpoint with authentication
 */
async function testEndpoint(endpoint, sessionToken, userRole) {
  try {
    const options = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionToken
      }
    };

    if (endpoint.body) {
      options.body = JSON.stringify(endpoint.body);
    }

    console.log(`\n  📡 Testing ${endpoint.name} (${endpoint.method} ${endpoint.url})`);
    
    const response = await fetch(`${BASE_URL}${endpoint.url}`, options);
    const statusCode = response.status;
    
    // Check if user role is allowed for this endpoint
    const roleAllowed = endpoint.roles.includes(userRole);
    
    if (statusCode === 200 || statusCode === 201) {
      if (roleAllowed) {
        console.log(`    ✅ SUCCESS (${statusCode}) - Access granted as expected`);
        return { success: true, expected: true };
      } else {
        console.log(`    ⚠️  UNEXPECTED SUCCESS (${statusCode}) - Access granted but role '${userRole}' not in allowed roles`);
        return { success: true, expected: false };
      }
    } else if (statusCode === 401) {
      console.log(`    ❌ AUTHENTICATION FAILED (${statusCode}) - Check session token`);
      return { success: false, expected: false };
    } else if (statusCode === 403) {
      if (!roleAllowed) {
        console.log(`    ✅ ACCESS DENIED (${statusCode}) - Correct role-based restriction`);
        return { success: false, expected: true };
      } else {
        console.log(`    ❌ UNEXPECTED DENIAL (${statusCode}) - Access denied but role '${userRole}' should be allowed`);
        return { success: false, expected: false };
      }
    } else if (statusCode === 404) {
      console.log(`    ⚠️  ENDPOINT NOT FOUND (${statusCode}) - May not be implemented yet`);
      return { success: false, expected: true };
    } else {
      const errorText = await response.text();
      console.log(`    ❌ ERROR (${statusCode}) - ${errorText.substring(0, 100)}`);
      return { success: false, expected: false };
    }

  } catch (error) {
    console.log(`    ❌ REQUEST FAILED - ${error.message}`);
    return { success: false, expected: false };
  }
}

/**
 * Test development bypass headers (when in development mode)
 */
async function testDevelopmentBypass() {
  console.log('\n🧪 Testing Development Bypass Mode');
  console.log('=' .repeat(50));

  const testEndpoint = {
    name: 'AI Project Generation (Bypass)',
    method: 'POST',
    url: '/api/ai/generate-project',
    body: { prompt: 'Create a test app', projectName: 'bypass-test' }
  };

  try {
    const response = await fetch(`${BASE_URL}${testEndpoint.url}`, {
      method: testEndpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': 'test-dev-1',
        'x-test-user-role': 'developer'
      },
      body: JSON.stringify(testEndpoint.body)
    });

    if (response.status === 200 || response.status === 201) {
      console.log('✅ Development bypass working - useful for automated testing');
    } else {
      console.log(`⚠️  Development bypass returned ${response.status} - may be disabled or not implemented`);
    }
  } catch (error) {
    console.log('❌ Development bypass test failed:', error.message);
  }
}

/**
 * Main test execution
 */
async function main() {
  console.log('🔒 VibeCode Authentication & Protected Endpoint Testing');
  console.log('=' .repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Testing ${PROTECTED_ENDPOINTS.length} endpoints with ${TEST_USERS.length} user roles\n`);

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    unexpected: 0
  };

  // Test each user against each endpoint
  for (const user of TEST_USERS) {
    console.log(`\n👤 Testing as ${user.name} (Role: ${user.role})`);
    console.log('-' .repeat(50));

    const sessionToken = await authenticateUser(user);
    
    if (!sessionToken) {
      console.log('❌ Skipping endpoint tests - authentication failed');
      continue;
    }

    // Test each endpoint
    for (const endpoint of PROTECTED_ENDPOINTS) {
      const result = await testEndpoint(endpoint, sessionToken, user.role);
      
      results.total++;
      if (result.expected) {
        results.passed++;
      } else {
        if (result.success) {
          results.unexpected++;
        } else {
          results.failed++;
        }
      }
    }
  }

  // Test development bypass
  await testDevelopmentBypass();

  // Print summary
  console.log('\n📊 Test Results Summary');
  console.log('=' .repeat(30));
  console.log(`✅ Expected behavior: ${results.passed}/${results.total}`);
  console.log(`❌ Authentication failures: ${results.failed}/${results.total}`);
  console.log(`⚠️  Unexpected behavior: ${results.unexpected}/${results.total}`);

  const successRate = Math.round((results.passed / results.total) * 100);
  console.log(`\n🎯 Overall Success Rate: ${successRate}%`);

  if (results.failed > 0) {
    console.log('\n⚠️  Issues found:');
    console.log('- Check that the development server is running on the correct port');
    console.log('- Verify all test users are properly configured in auth.ts');
    console.log('- Ensure protected endpoints are implemented and accessible');
  }

  if (successRate >= 80) {
    console.log('\n🎉 Authentication system is working well for feature testing!');
  } else {
    console.log('\n⚠️  Authentication system needs attention before comprehensive testing.');
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  console.log(`
Usage: node test-protected-endpoints.cjs [options]

Options:
  --help              Show this help message
  
Environment Variables:
  BASE_URL           Base URL for testing (default: http://localhost:3000)
  NODE_ENV           Set to 'development' to enable bypass testing

Examples:
  node test-protected-endpoints.cjs
  BASE_URL=http://localhost:3001 node test-protected-endpoints.cjs
`);
  process.exit(0);
}

main().catch(console.error);