// Database Utility for the Embedding Service
// This file provides utility functions for connecting to the database and
// creating tables needed by the embedding service

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
// import { logger } from '@/lib/logger';
interface VectorDatabaseOptions {
  connectionUrl?: string;
  createExtensions?: boolean;
  createTables?: boolean;
  verbose?: boolean;
}

/**
 * Initialize the database for vector embeddings
 */
export async function initializeVectorDatabase(options: VectorDatabaseOptions = {}) {
  const {
    connectionUrl = process.env.DATABASE_URL,
    createExtensions = true,
    createTables = true,
    verbose = true
  } = options;

  if (!connectionUrl) {
    throw new Error('Database connection URL is required. Set DATABASE_URL or provide connectionUrl.');
  }

  const log = verbose ? console.log : () => {};
  
  // Create PrismaClient with connection URL
  const prismaOptions = {
    datasources: {
      db: {
        url: connectionUrl,
      },
    },
  };
  
  const prisma = new PrismaClient(prismaOptions);
  
  try {
    // Test connection
    log('🔌 Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    log('✅ Database connection successful!');
    
    if (createExtensions) {
      // Create pgvector extension
      log('🛠️ Creating pgvector extension if needed...');
      try {
        await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`;
        log('✅ pgvector extension created or already exists');
      } catch (extError) {
        log(`⚠️ Could not create pgvector extension: ${extError.message}`);
        log('This may be due to insufficient database permissions or pgvector not being installed.');
        log('You can still use the embedding service, but vector storage and similarity search will not work.');
      }
    }
    
    if (createTables) {
      // Create document_embeddings table
      log('🛠️ Creating document_embeddings table if needed...');
      try {
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS document_embeddings (
            id SERIAL PRIMARY KEY,
            document_id VARCHAR(255) UNIQUE NOT NULL,
            content TEXT NOT NULL,
            embedding vector(1536),
            metadata JSONB DEFAULT '{}',
            embedding_generation_time_ms INTEGER,
            search_count INTEGER DEFAULT 0,
            last_accessed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `;
        
        await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS document_embeddings_document_id_idx ON document_embeddings(document_id);
        `;
        
        log('✅ document_embeddings table created or already exists');
        
        // Try to create vector indexes if possible
        try {
          await prisma.$executeRaw`
            CREATE INDEX IF NOT EXISTS document_embeddings_embedding_l2_idx ON document_embeddings 
            USING ivfflat (embedding vector_l2_ops);
          `;
          log('✅ Vector L2 index created or already exists');
        } catch (idxError) {
          log(`⚠️ Could not create vector L2 index: ${idxError.message}`);
        }
        
        try {
          await prisma.$executeRaw`
            CREATE INDEX IF NOT EXISTS document_embeddings_embedding_ip_idx ON document_embeddings 
            USING ivfflat (embedding vector_ip_ops);
          `;
          log('✅ Vector IP index created or already exists');
        } catch (idxError) {
          log(`⚠️ Could not create vector IP index: ${idxError.message}`);
        }
        
      } catch (tableError) {
        log(`⚠️ Could not create document_embeddings table: ${tableError.message}`);
        log('This may be due to insufficient database permissions.');
        throw tableError;
      }
    }
    
    return { prisma, success: true };
  } catch (error) {
    log(`❌ Database initialization failed: ${error.message}`);
    await prisma.$disconnect();
    return { prisma: null, success: false, error };
  }
}

/**
 * Create a schema file that can be used to initialize the vector database
 */
export function writeSchemaFile(filePath = './vector-schema.sql') {
  const schema = `
CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure the document_embeddings table exists
CREATE TABLE IF NOT EXISTS document_embeddings (
  id SERIAL PRIMARY KEY,
  document_id VARCHAR(255) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  embedding_generation_time_ms INTEGER,
  search_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indices if they don't exist
CREATE INDEX IF NOT EXISTS document_embeddings_document_id_idx ON document_embeddings(document_id);

-- Create vector indices if they don't exist
-- Note: This might fail if pgvector extension isn't properly installed
DO $$
BEGIN
  BEGIN
    -- Create L2 distance index (Euclidean distance)
    EXECUTE 'CREATE INDEX IF NOT EXISTS document_embeddings_embedding_l2_idx ON document_embeddings USING ivfflat (embedding vector_l2_ops)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create L2 index: %', SQLERRM;
  END;

  BEGIN
    -- Create inner product index (for cosine similarity)
    EXECUTE 'CREATE INDEX IF NOT EXISTS document_embeddings_embedding_ip_idx ON document_embeddings USING ivfflat (embedding vector_ip_ops)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create IP index: %', SQLERRM;
  END;
END
$$;
  `;
  
  fs.writeFileSync(filePath, schema, 'utf8');
  console.info(`Schema file written to ${filePath}`);
  return filePath;
}

/**
 * Get a PrismaClient instance configured with the given connection URL
 */
export function getPrismaClient(connectionUrl = process.env.DATABASE_URL) {
  if (!connectionUrl) {
    throw new Error('Database connection URL is required. Set DATABASE_URL or provide connectionUrl.');
  }
  
  return new PrismaClient({
    datasources: {
      db: {
        url: connectionUrl,
      },
    },
  });
}