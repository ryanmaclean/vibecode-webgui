#!/usr/bin/env ts-node
/**
 * Script to set up PostgreSQL for Datadog Database Monitoring
 * Run this script after deploying database changes
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function setupDatadogDBM() {
  try {
    console.log('🔧 Setting up Datadog DBM for PostgreSQL...');

    // 1. Enable required extensions
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`;
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_stat_kcache;`;
    
    // 2. Parse database connection details
    const dbUrl = new URL(process.env.DATABASE_URL || 'postgresql://vibecode:vibecode@localhost:5432/vibecode');
    const dbName = dbUrl.pathname.replace(/^\/+/, '');
    const dbUser = dbUrl.username || 'vibecode';
    
    console.log(`📊 Configuring database: ${dbName} for user: ${dbUser}`);
    
    // 3. Grant permissions for Datadog monitoring
    await prisma.$executeRaw`
      GRANT USAGE ON SCHEMA public TO ${dbUser};
      GRANT USAGE ON SCHEMA public TO datadog;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO datadog;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datadog;
      GRANT SELECT ON pg_stat_database TO datadog;
    `;

    // 4. Configure PostgreSQL for monitoring
    await prisma.$executeRaw`
      ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements,pg_stat_kcache';
      ALTER SYSTEM SET track_io_timing = on;
      ALTER SYSTEM SET track_functions = 'all';
      ALTER SYSTEM SET track_activity_query_size = 4096;
    `;

    console.log('✅ Datadog DBM setup completed successfully!');
    console.log('🔄 Restarting PostgreSQL to apply changes...');
    
    // 5. Restart PostgreSQL (this might require sudo)
    try {
      console.log('♻️ Attempting to restart PostgreSQL...');
      execSync('sudo systemctl restart postgresql');
      console.log('✅ PostgreSQL restarted successfully');
    } catch (restartError) {
      console.warn('⚠️ Could not restart PostgreSQL automatically. Please restart it manually for changes to take effect.');
      if (restartError instanceof Error) {
        console.warn(`⚠️ Error details: ${restartError.message}`);
      }
    }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error setting up Datadog DBM:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error('❌ Unknown error setting up Datadog DBM:', String(error));
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupDatadogDBM();
