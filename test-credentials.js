#!/usr/bin/env node

/**
 * Test script to verify development credentials work
 */

const testCredentials = [
  { email: 'admin@vibecode.dev', password: 'admin123', name: 'VibeCode Admin' },
  { email: 'developer@vibecode.dev', password: 'dev123', name: 'Sarah Johnson' },
  { email: 'frontend@vibecode.dev', password: 'frontend123', name: 'Michael Chen' },
  { email: 'lead@vibecode.dev', password: 'lead123', name: 'Lisa Thompson' },
]

async function testCredential(email, password, name) {
  try {
    console.log(`\n🧪 Testing: ${name} (${email})`)
    
    // First, get the CSRF token
    const csrfResponse = await fetch('http://localhost:3000/api/auth/csrf')
    const csrfData = await csrfResponse.json()
    
    if (!csrfData.csrfToken) {
      console.log('❌ Failed to get CSRF token')
      return false
    }
    
    // Test the credential
    const response = await fetch('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: email,
        password: password,
        csrfToken: csrfData.csrfToken,
        callbackUrl: 'http://localhost:3000',
        json: 'true'
      })
    })
    
    const result = await response.text()
    
    if (response.ok && !result.includes('error')) {
      console.log('✅ Authentication successful')
      return true
    } else {
      console.log('❌ Authentication failed:', result.substring(0, 100))
      return false
    }
  } catch (error) {
    console.log('❌ Error:', error.message)
    return false
  }
}

async function main() {
  console.log('🔐 Testing Development Credentials')
  console.log('='.repeat(40))
  
  let successCount = 0
  
  for (const cred of testCredentials) {
    const success = await testCredential(cred.email, cred.password, cred.name)
    if (success) successCount++
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log('\n📊 Results:')
  console.log('='.repeat(40))
  console.log(`✅ Successful: ${successCount}/${testCredentials.length}`)
  console.log(`❌ Failed: ${testCredentials.length - successCount}/${testCredentials.length}`)
  
  if (successCount === testCredentials.length) {
    console.log('\n🎉 All development credentials are working!')
  } else {
    console.log('\n⚠️  Some credentials failed - check authentication configuration')
  }
}

main().catch(console.error)