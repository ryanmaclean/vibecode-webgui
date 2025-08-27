#!/usr/bin/env node
// Test script specifically focused on vector database connectivity
import { initializeVectorDatabase, getPrismaClient } from './src/lib/db/vector-db-utils.ts';
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

async function testVectorDbConnection() {
  console.log('🔍 Testing vector database connection...');
  
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

  if (!dbUrl.startsWith('postgresql://')) {
    console.warn('⚠️ DATABASE_URL should start with postgresql://');
  }
  
  try {
    // Basic connection test with simple client
    console.log('\n🔄 Testing basic database connection...');
    const prisma = getPrismaClient();
    
    console.log('   Executing test query...');
    const result = await prisma.$queryRaw`SELECT 1 as test, version() as version`;
    
    console.log('✅ Basic database connection successful!');
    console.log(`   Database version: ${result[0].version}`);
    
    // Get database info
    const dbInfo = await prisma.$queryRaw`SELECT current_database() as db_name, current_user as user_name`;
    console.log(`   Connected to database: ${dbInfo[0].db_name} as user: ${dbInfo[0].user_name}`);
    
    // Check if pgvector extension is available
    console.log('\n🧩 Checking for pgvector extension...');
    try {
      const extResult = await prisma.$queryRaw`
        SELECT extname, extversion 
        FROM pg_extension 
        WHERE extname = 'vector'
      `;
      
      if (extResult.length > 0) {
        console.log(`✅ pgvector extension is installed (version: ${extResult[0].extversion})`);
      } else {
        console.warn('⚠️ pgvector extension is NOT installed');
        console.log('   Some vector operations may not work properly');
        
        // Try to create the extension
        console.log('   Attempting to create pgvector extension...');
        try {
          await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`;
          console.log('✅ pgvector extension created successfully!');
        } catch (createExtError) {
          console.error(`❌ Could not create pgvector extension: ${createExtError.message}`);
          console.error('   You may need superuser privileges or need to install the extension on the server');
        }
      }
    } catch (extCheckError) {
      console.error(`❌ Error checking for pgvector extension: ${extCheckError.message}`);
    }
    
    // Use the full initialization to test table creation and schema
    console.log('\n🛠️ Testing full vector database initialization...');
    const initResult = await initializeVectorDatabase({ 
      verbose: true,
      createExtensions: true,
      createTables: true
    });
    
    if (initResult.success) {
      console.log('✅ Full vector database initialization successful!');
      
      // Check if document_embeddings table exists and has the right structure
      console.log('\n📋 Checking document_embeddings table structure...');
      try {
        const tableInfo = await initResult.prisma.$queryRaw`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'document_embeddings'
          ORDER BY ordinal_position
        `;
        
        console.log('✅ document_embeddings table structure:');
        tableInfo.forEach(col => {
          console.log(`   - ${col.column_name}: ${col.data_type}`);
        });
        
        // Check indices on the table
        const indexInfo = await initResult.prisma.$queryRaw`
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE tablename = 'document_embeddings'
        `;
        
        console.log('\n📊 Indices on document_embeddings:');
        indexInfo.forEach(idx => {
          console.log(`   - ${idx.indexname}: ${idx.indexdef}`);
        });
        
      } catch (tableCheckError) {
        console.error(`❌ Error checking table structure: ${tableCheckError.message}`);
      }
      
    } else {
      console.error('❌ Full vector database initialization failed');
      if (initResult.error) {
        console.error(`   Error: ${initResult.error.message}`);
      }
    }
    
    // Check connection pool status
    console.log('\n🔄 Checking connection pool status...');
    try {
      const connInfo = await prisma.$queryRaw`
        SELECT count(*) as connection_count 
        FROM pg_stat_activity 
        WHERE application_name LIKE '%prisma%'
      `;
      
      console.log(`   Active Prisma connections: ${connInfo[0].connection_count}`);
    } catch (connCheckError) {
      console.error(`❌ Error checking connection pool: ${connCheckError.message}`);
    }
    
    // Test retry mechanism with a simple wrapper
    console.log('\n🔄 Testing connection retry mechanism...');
    
    // Simple retry function
    async function queryWithRetry(fn, retries = 3, delay = 1000) {
      let lastError;
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          console.log(`   Attempt ${attempt}/${retries}...`);
          const result = await fn();
          console.log('   ✅ Query succeeded!');
          return result;
        } catch (error) {
          console.log(`   ⚠️ Attempt ${attempt} failed: ${error.message}`);
          lastError = error;
          
          if (attempt < retries) {
            console.log(`   Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      throw new Error(`All ${retries} attempts failed. Last error: ${lastError.message}`);
    }
    
    try {
      // Test with a valid query that should succeed on first try
      const retryResult = await queryWithRetry(() => prisma.$queryRaw`SELECT 1 as retry_test`);
      console.log(`   Retry mechanism test successful: ${JSON.stringify(retryResult)}`);
      
      // Test with an intentionally bad query to see retry behavior
      console.log('\n   Testing retry with intentional failure:');
      try {
        await queryWithRetry(() => prisma.$queryRaw`SELECT * FROM nonexistent_table`, 2, 500);
      } catch (retryError) {
        console.log(`   ✅ Expected failure after retries: ${retryError.message}`);
      }
      
    } catch (retryTestError) {
      console.error(`❌ Retry mechanism test failed: ${retryTestError.message}`);
    }
    
    // Disconnect from database
    console.log('\n🔌 Disconnecting from database...');
    await prisma.$disconnect();
    if (initResult.prisma) {
      await initResult.prisma.$disconnect();
    }
    console.log('✅ Disconnected successfully');
    
    console.log('\n🎉 All database connectivity tests completed!');
    
  } catch (error) {
    console.error('\n❌ Database connection test failed:');
    console.error(`   Error: ${error.message}`);
    
    // Provide helpful diagnostics based on error type
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection was refused. This usually means:');
      console.error('   - The database server is not running');
      console.error('   - The database server is not accessible at the specified host/port');
      console.error('   - A firewall is blocking the connection');
      console.error('\n   Troubleshooting tips:');
      console.error('   1. Check if the database server is running');
      console.error('   2. Verify the host and port are correct in DATABASE_URL');
      console.error('   3. Check firewall settings');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n💡 Connection timed out. This usually means:');
      console.error('   - The database server is not accessible at the specified host');
      console.error('   - Network issues are preventing the connection');
      console.error('\n   Troubleshooting tips:');
      console.error('   1. Verify the host is correct in DATABASE_URL');
      console.error('   2. Check network connectivity to the database server');
    } else if (error.code === 'P1001') {
      console.error('\n💡 Prisma cannot reach the database server. This usually means:');
      console.error('   - The connection string is incorrect');
      console.error('   - The database server is not running');
      console.error('\n   Troubleshooting tips:');
      console.error('   1. Verify DATABASE_URL format and credentials');
      console.error('   2. Check if the database server is running');
    } else if (error.code === 'P1003') {
      console.error('\n💡 Database does not exist. This usually means:');
      console.error('   - The database name in the connection string is incorrect');
      console.error('   - The database has not been created');
      console.error('\n   Troubleshooting tips:');
      console.error('   1. Verify the database name in DATABASE_URL');
      console.error('   2. Create the database if it does not exist');
    } else if (error.code === 'P1017') {
      console.error('\n💡 Server rejected the connection. This usually means:');
      console.error('   - The username or password is incorrect');
      console.error('   - The user does not have permission to connect');
      console.error('\n   Troubleshooting tips:');
      console.error('   1. Verify the username and password in DATABASE_URL');
      console.error('   2. Check database user permissions');
    }
    
    process.exit(1);
  }
}

// Run the test
testVectorDbConnection();