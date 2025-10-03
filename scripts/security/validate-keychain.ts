#!/usr/bin/env tsx
/**
 * Validate Keychain Integration
 * Agent 12: Security Engineer
 *
 * Tests Keychain functionality and validates secret storage.
 */

import {
  isKeychainAvailable,
  setSecret,
  getSecret,
  deleteSecret,
  listSecrets
} from '../../src/lib/security/macos-keychain'

async function main() {
  console.log('🔐 Keychain Validation Test')
  console.log('===========================\n')

  // 1. Check if Keychain is available
  console.log('1️⃣  Checking Keychain availability...')
  const available = isKeychainAvailable()
  console.log(`   Platform: ${process.platform}`)
  console.log(`   Available: ${available ? '✅ Yes' : '❌ No'}\n`)

  if (!available) {
    console.log('❌ Keychain not available on this platform')
    console.log('   Keychain integration requires macOS')
    process.exit(1)
  }

  // 2. Test secret storage
  console.log('2️⃣  Testing secret storage...')
  const testKey = 'TEST_SECRET_VALIDATION'
  const testValue = 'test-value-' + Date.now()

  try {
    await setSecret(testKey, testValue)
    console.log('   ✅ Secret stored successfully\n')
  } catch (error) {
    console.log(`   ❌ Failed to store secret: ${error}\n`)
    process.exit(1)
  }

  // 3. Test secret retrieval
  console.log('3️⃣  Testing secret retrieval...')
  try {
    const retrieved = await getSecret(testKey)
    if (retrieved === testValue) {
      console.log('   ✅ Secret retrieved correctly\n')
    } else {
      console.log(`   ❌ Secret mismatch: expected "${testValue}", got "${retrieved}"\n`)
      process.exit(1)
    }
  } catch (error) {
    console.log(`   ❌ Failed to retrieve secret: ${error}\n`)
    process.exit(1)
  }

  // 4. Test secret listing
  console.log('4️⃣  Testing secret listing...')
  try {
    const secrets = await listSecrets()
    console.log(`   Found ${secrets.length} secrets in Keychain`)
    if (secrets.includes(testKey)) {
      console.log('   ✅ Test secret found in list\n')
    } else {
      console.log('   ⚠️  Test secret not found in list (may be security policy)\n')
    }
  } catch (error) {
    console.log(`   ⚠️  Failed to list secrets: ${error}\n`)
  }

  // 5. Test secret deletion
  console.log('5️⃣  Testing secret deletion...')
  try {
    await deleteSecret(testKey)
    console.log('   ✅ Secret deleted successfully\n')
  } catch (error) {
    console.log(`   ❌ Failed to delete secret: ${error}\n`)
    process.exit(1)
  }

  // 6. Verify deletion
  console.log('6️⃣  Verifying deletion...')
  try {
    const retrieved = await getSecret(testKey)
    if (retrieved === null) {
      console.log('   ✅ Secret deleted correctly\n')
    } else {
      console.log(`   ❌ Secret still exists after deletion\n`)
      process.exit(1)
    }
  } catch (error) {
    console.log('   ✅ Secret not found (expected)\n')
  }

  // 7. Check for production secrets
  console.log('7️⃣  Checking for production secrets...')
  const productionSecrets = [
    'NEXTAUTH_SECRET',
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'DD_API_KEY',
    'JWT_SECRET',
  ]

  let foundSecrets = 0
  for (const secretKey of productionSecrets) {
    try {
      const value = await getSecret(secretKey)
      if (value) {
        console.log(`   ✅ ${secretKey} found in Keychain`)
        foundSecrets++
      }
    } catch {
      // Secret not found
    }
  }

  console.log(`\n   Total production secrets in Keychain: ${foundSecrets}/${productionSecrets.length}`)

  if (foundSecrets === 0) {
    console.log('   ⚠️  No production secrets found in Keychain')
    console.log('   Run migration: npm run security:migrate-keychain\n')
  } else {
    console.log('   ✅ Keychain is configured with production secrets\n')
  }

  console.log('✅ All validation tests passed!')
  console.log('\n📋 NEXT STEPS:')
  console.log('   1. Run: npm run security:audit')
  console.log('   2. Run: npm run security:migrate-keychain')
  console.log('   3. Update code to use loadSecret() instead of process.env')
  console.log('   4. Remove secrets from .env.local after migration\n')
}

main().catch((error) => {
  console.error('Validation failed:', error)
  process.exit(1)
})
