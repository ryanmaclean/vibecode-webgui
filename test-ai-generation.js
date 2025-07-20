#!/usr/bin/env node

const fetch = require('node-fetch');
const { CookieJar } = require('tough-cookie');
const { URL } = require('url');

// Create a cookie jar to maintain session
const cookieJar = new CookieJar();

async function testAIGeneration() {
  try {
    console.log('🚀 Testing AI Project Generation...');
    
    // Step 1: Get CSRF token
    console.log('\n1. Getting CSRF token...');
    const csrfResponse = await fetch('http://localhost:3000/api/auth/csrf');
    const csrfData = await csrfResponse.json();
    console.log('CSRF token:', csrfData.csrfToken);
    
    // Step 2: Sign in with test credentials
    console.log('\n2. Signing in with test credentials...');
    const signInResponse = await fetch('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: 'developer@vibecode.dev',
        password: 'dev123',
        csrfToken: csrfData.csrfToken,
        callbackUrl: 'http://localhost:3000/projects'
      }).toString(),
      redirect: 'manual'
    });
    
    console.log('Sign in response status:', signInResponse.status);
    console.log('Sign in response headers:', signInResponse.headers.raw());
    
    // Extract cookies for session
    const cookies = signInResponse.headers.raw()['set-cookie'];
    const sessionCookie = cookies?.find(cookie => cookie.includes('next-auth.session-token'));
    
    if (sessionCookie) {
      console.log('Session cookie found:', sessionCookie.substring(0, 50) + '...');
    }
    
    // Step 3: Test AI project generation
    console.log('\n3. Testing AI project generation...');
    const aiResponse = await fetch('http://localhost:3000/api/ai/generate-project', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie || '',
      },
      body: JSON.stringify({
        prompt: 'Create a simple React todo app with TypeScript. Include add, complete, and delete functionality with a clean modern UI.',
        projectName: 'ai-todo-app',
        language: 'typescript',
        framework: 'react',
        features: ['Authentication', 'Database', 'Testing']
      })
    });
    
    console.log('AI generation response status:', aiResponse.status);
    console.log('AI generation response headers:', aiResponse.headers.raw());
    
    if (aiResponse.ok) {
      const result = await aiResponse.json();
      console.log('\n✅ AI Project Generation SUCCESS!');
      console.log('Project structure:', JSON.stringify(result, null, 2));
      
      // Step 4: Test if workspace was created
      if (result.workspaceId) {
        console.log('\n4. Checking workspace creation...');
        const workspaceResponse = await fetch(`http://localhost:3000/api/workspaces/${result.workspaceId}`, {
          headers: {
            'Cookie': sessionCookie || '',
          }
        });
        
        console.log('Workspace check status:', workspaceResponse.status);
        if (workspaceResponse.ok) {
          const workspaceData = await workspaceResponse.json();
          console.log('Workspace data:', workspaceData);
        }
      }
    } else {
      const error = await aiResponse.text();
      console.log('\n❌ AI Project Generation FAILED');
      console.log('Error response:', error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testAIGeneration();