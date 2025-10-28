#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    // Create Prisma client
    const prisma = new PrismaClient();
    
    console.log('📡 Attempting to connect to database...');
    
    // Test connection with a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test, version() as version`;
    
    console.log('✅ Database connection successful!');
    console.log('📊 Query result:', result);
    
    // Test if we can access the database
    const dbInfo = await prisma.$queryRaw`SELECT current_database() as db_name, current_user as user_name`;
    console.log('🗄️  Database info:', dbInfo);
    
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 This usually means the database server is not running or not accessible on localhost:5432');
    } else if (error.code === 'P1001') {
      console.error('💡 This usually means the database server is not accessible or the connection string is wrong');
    }
    
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection();
