#!/usr/bin/env node
// Test script for robust database connectivity
import { 
  createRobustConnection, 
  initializeVectorDatabaseRobust,
  executeWithRetry,
  closeAllConnections,
  getConnectionPoolStatus
} from './src/lib/db/robust-db-connection.ts';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from specified file or default
const envFile = process.argv[2] || '.env';
if (fs.existsSync(envFile)) {
  console.log(`📄 Loading environment from ${envFile}`);
  dotenv.config({ path: envFile });
} else {
  console.log('📄 Using default environment variables');
  dotenv.config();
}

async function testRobustDbConnection() {
  console.log('🔍 Testing robust database connection...');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('Please set DATABASE_URL in your environment or .env file');
    process.exit(1);
  }
  
  console.log('🔌 Database URL format check:');
  const dbUrl = process.env.DATABASE_URL;
  const maskedUrl = dbUrl.replace(/([:@])[^:@]*([^:@]*)/, '$1***$2');
  console.log(`   URL: ${maskedUrl}`);
  
  try {
    // Basic connection test
    console.log('\n🔄 Testing basic connection...');
    const connection = await createRobustConnection({ debug: true });
    
    if (connection.success && connection.prisma) {
      console.log('✅ Basic connection successful!');
      
      // Get database info
      console.log('\n📊 Querying database info with retry...');
      const dbInfo = await executeWithRetry(connection.prisma, () => 
        connection.prisma.$queryRaw`SELECT current_database() as db_name, current_user as user_name`
      );
      console.log(`   Connected to database: ${dbInfo[0].db_name} as user: ${dbInfo[0].user_name}`);
      
      // Test connection pool
      console.log('\n🔄 Testing connection pool...');
      console.log('   Creating additional connections...');
      
      // Create a few more connections to test the pool
      const connections = [connection];
      for (let i = 0; i < 3; i++) {
        connections.push(await createRobustConnection({ 
          debug: true, 
          poolKey: `test-${i}` 
        }));
      }
      
      // Test connection reuse
      console.log('\n🔄 Testing connection reuse...');
      const reusedConn = await createRobustConnection({ debug: true });
      console.log(`   Connection from pool: ${reusedConn.fromPool}`);
      
      // Get pool status
      const poolStatus = getConnectionPoolStatus();
      console.log('\n📊 Connection pool status:');
      console.log(`   Size: ${poolStatus.size}`);
      console.log(`   In use: ${poolStatus.inUse}`);
      console.log(`   Max size: ${poolStatus.maxSize}`);
      console.log(`   Available: ${poolStatus.available}`);
      
      // Test full initialization
      console.log('\n🛠️ Testing full database initialization...');
      const initResult = await initializeVectorDatabaseRobust({ 
        debug: true,
        createExtensions: true,
        createTables: true
      });
      
      if (initResult.success && initResult.prisma) {
        console.log('✅ Full initialization successful!');
        
        // Check if document_embeddings table exists
        console.log('\n📋 Checking document_embeddings table...');
        try {
          const tableInfo = await executeWithRetry(initResult.prisma, () => 
            initResult.prisma.$queryRaw`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'document_embeddings'
              ) as table_exists
            `
          );
          
          if (tableInfo[0].table_exists) {
            console.log('✅ document_embeddings table exists');
          } else {
            console.warn('⚠️ document_embeddings table does not exist');
          }
        } catch (tableCheckError) {
          console.error(`❌ Error checking table: ${tableCheckError.message}`);
        }
        
        // Release this connection
        if (initResult.release) {
          initResult.release();
          console.log('   Released initialization connection back to pool');
        }
      } else {
        console.error('❌ Full initialization failed');
        if (initResult.error) {
          console.error(`   Error: ${initResult.error.message}`);
        }
      }
      
      // Test retry with deliberate failure
      console.log('\n🧪 Testing retry with deliberate failure...');
      try {
        await executeWithRetry(connection.prisma, () => 
          connection.prisma.$queryRaw`SELECT * FROM nonexistent_table`
        , 2, 500);
        console.log('❌ This should have failed!');
      } catch (retryError) {
        console.log(`✅ Expected failure after retries: ${retryError.message}`);
      }
      
      // Close all connections
      console.log('\n🔌 Closing all connections...');
      const closeResult = await closeAllConnections();
      console.log(`✅ Closed ${closeResult.closed} connections`);
      
      console.log('\n🎉 All robust database connectivity tests completed!');
      
    } else {
      console.error('❌ Basic connection failed');
      if (connection.error) {
        console.error(`   Error: ${connection.error.message}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Database connection test failed:');
    console.error(`   Error: ${error.message}`);
    
    // Close all connections
    try {
      await closeAllConnections();
    } catch (closeError) {
      console.error(`   Error closing connections: ${closeError.message}`);
    }
    
    process.exit(1);
  }
}

// Run the test
testRobustDbConnection();