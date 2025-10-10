import { Pool } from 'pg';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const config = {
  // PostgreSQL configuration
  pgConfig: {
    user: process.env.USER || 'ryan.maclean', // Use the current system username
    host: 'localhost',
    database: 'vibecode',
    password: '', // No password for local development
    port: 5432,
  },
  
  // Azure OpenAI configuration
  openai: {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'text-embedding-ada-002',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
  },
};

// Initialize PostgreSQL client
const pool = new Pool(config.pgConfig);

// Initialize Azure OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: `${config.openai.endpoint}/openai/deployments/${config.openai.deploymentName}`,
  defaultQuery: { 'api-version': config.openai.apiVersion },
  defaultHeaders: { 'api-key': config.openai.apiKey },
});

// Test data
const testDocuments = [
  'PostgreSQL is a powerful, open source object-relational database system',
  'pgvector is a PostgreSQL extension for vector similarity search',
  'Azure OpenAI provides access to powerful language models like GPT-4',
  'VibeCode integrates with Azure OpenAI and pgvector for semantic search',
  'Vector databases enable efficient similarity search for AI applications'
];

// Initialize database
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Enable pgvector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    // Create documents table with vector column
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding VECTOR(1536),
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Create index for vector search
    await client.query(`
      CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents 
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    `);
    
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Generate embeddings using Azure OpenAI
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: config.openai.deploymentName,
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Error generating embedding:', error);
    throw error;
  }
}

// Store document with embedding
async function storeDocument(content: string, metadata: Record<string, any> = {}) {
  const client = await pool.connect();
  try {
    // Generate embedding
    const embedding = await generateEmbedding(content);
    
    // Store in database
    const result = await client.query(
      'INSERT INTO documents (content, embedding, metadata) VALUES ($1, $2, $3) RETURNING id',
      [content, JSON.stringify(embedding), metadata]
    );
    
    console.log(`✅ Stored document with ID: ${result.rows[0].id}`);
    return result.rows[0].id;
  } catch (error) {
    console.error('❌ Error storing document:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Semantic search
async function semanticSearch(query: string, limit = 3) {
  const client = await pool.connect();
  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);
    
    // Perform similarity search
    const result = await client.query(
      `SELECT id, content, 
             1 - (embedding <=> $1) as similarity
       FROM documents
       ORDER BY embedding <=> $1
       LIMIT $2`,
      [JSON.stringify(queryEmbedding), limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error performing semantic search:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting GenAI + pgvector Integration Tests');
  
  try {
    // 1. Initialize database
    console.log('\n1. Initializing database...');
    await initializeDatabase();
    
    // 2. Store test documents
    console.log('\n2. Storing test documents...');
    const docIds = [];
    for (const content of testDocuments) {
      const docId = await storeDocument(content, { source: 'test', timestamp: new Date() });
      docIds.push(docId);
    }
    
    // 3. Test semantic search
    console.log('\n3. Testing semantic search...');
    const query = 'What is pgvector used for?';
    console.log(`\nSearching for: "${query}"`);
    
    const results = await semanticSearch(query);
    console.log('\nSearch results:');
    results.forEach((row, index) => {
      console.log(`\n${index + 1}. Similarity: ${(row.similarity * 100).toFixed(1)}%`);
      console.log(`   Content: ${row.content.substring(0, 80)}...`);
    });
    
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Clean up
    await pool.end();
  }
}

// Run the tests
runTests().catch(console.error);
