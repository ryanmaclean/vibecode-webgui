/**
 * Global Setup for No-Docker Tests
 * Initializes test environment for real API testing
 */

module.exports = async () => {
  console.log('🚀 Initializing VibeCode test environment...')
  
  // Check required environment variables
  const requiredVars = ['DATABASE_URL']
  const optionalVars = ['OPENROUTER_API_KEY', 'DD_API_KEY', 'DD_APP_KEY']
  
  console.log('📋 Environment Configuration:')
  
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`  ✅ ${varName}: configured`)
    } else {
      console.log(`  ❌ ${varName}: missing (required)`)
    }
  })
  
  optionalVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`  ✅ ${varName}: configured`)
    } else {
      console.log(`  ⚠️  ${varName}: missing (optional)`)
    }
  })
  
  // Set test-specific environment variables
  process.env.NODE_ENV = 'test'
  process.env.SKIP_DOCKER_HEALTH_CHECKS = 'true'
  process.env.SKIP_EXTERNAL_MONITORING = 'true'
  
  console.log('🧪 Test environment ready')
}