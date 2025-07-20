/**
 * Global Teardown for No-Docker Tests
 * Cleans up test environment after all tests complete
 */

module.exports = async () => {
  console.log('🧹 Cleaning up test environment...')
  
  // Clean up any test data or connections
  try {
    // If we have a database connection, close it
    if (global.__PRISMA_CLIENT__) {
      await global.__PRISMA_CLIENT__.$disconnect()
      console.log('  📦 Database connection closed')
    }
    
    // Clean up any other resources
    if (global.__TEST_RESOURCES__) {
      for (const resource of global.__TEST_RESOURCES__) {
        if (typeof resource.cleanup === 'function') {
          await resource.cleanup()
        }
      }
      console.log('  🗑️  Test resources cleaned up')
    }
    
  } catch (error) {
    console.warn('⚠️  Warning during cleanup:', error.message)
  }
  
  console.log('✅ Test environment cleanup complete')
}