#!/usr/bin/env node

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

async function testValkeyConnection() {
  console.log('🔍 Testing Valkey connection...');
  
  try {
    // Import Redis client (Valkey is Redis-compatible)
    const { createClient } = require('redis');
    
    console.log('📡 Attempting to connect to Valkey...');
    
    // Create Valkey client using Redis protocol
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    // Connect to Valkey
    await client.connect();
    console.log('✅ Valkey connection successful!');
    
    // Test basic operations
    await client.set('test_key', 'test_value');
    const value = await client.get('test_key');
    console.log('📊 Test key value:', value);
    
    // Test ping
    const pong = await client.ping();
    console.log('🏓 Valkey ping response:', pong);
    
    // Clean up
    await client.del('test_key');
    
    // Disconnect
    await client.disconnect();
    console.log('🔌 Disconnected from Valkey');
    
  } catch (error) {
    console.error('❌ Valkey connection failed:');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 This usually means the Valkey server is not running or not accessible on localhost:6379');
    }
    
    process.exit(1);
  }
}

// Run the test
testValkeyConnection();
