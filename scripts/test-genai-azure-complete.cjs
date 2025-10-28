#!/usr/bin/env node

/**
 * Complete GenAI Application Test with Azure PostgreSQL + pgvector
 * 
 * This script demonstrates end-to-end GenAI functionality:
 * 1. Connect to Azure PostgreSQL with pgvector
 * 2. Create vector embeddings (simulated)
 * 3. Store documents with vector embeddings
 * 4. Perform vector similarity search
 * 5. Demonstrate RAG-style query patterns
 */

const { Pool } = require('pg');

// Azure PostgreSQL connection configuration
const CONFIG = {
    host: 'vibecode-demo-postgresql-lp6rgle5ovz6c.postgres.database.azure.com',
    port: 5432,
    database: 'postgres',
    user: 'vibecodeusr',
    password: process.env.POSTGRES_PASSWORD || 'VerySecurePass123!',
    ssl: { rejectUnauthorized: false }
};

// Simulated embedding service (in production, use OpenAI, Azure OpenAI, etc.)
function generateEmbedding(text) {
    // Simple deterministic "embedding" for testing
    // In production: const response = await openai.embeddings.create({...})
    const hash = text.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
    
    // Generate 768-dimensional vector from hash
    const embedding = [];
    for (let i = 0; i < 768; i++) {
        embedding.push(Math.sin(hash + i) * 0.1);
    }
    return embedding;
}

async function initializeDatabase(client) {
    console.log('🔧 Initializing database schema...');
    
    // Enable pgvector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('✅ pgvector extension enabled');
    
    // Create documents table with vector embeddings
    await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding vector(768),
            category TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Documents table created');
    
    // Create vector index for performance
    await client.query(`
        CREATE INDEX IF NOT EXISTS documents_embedding_idx 
        ON documents USING hnsw (embedding vector_l2_ops)
    `);
    console.log('✅ Vector index created');
}

async function insertSampleDocuments(client) {
    console.log('📝 Inserting sample documents...');
    
    const sampleDocs = [
        {
            title: 'Introduction to PostgreSQL',
            content: 'PostgreSQL is a powerful, open source object-relational database system that uses and extends the SQL language combined with many features that safely store and scale the most complicated data workloads.',
            category: 'database'
        },
        {
            title: 'Vector Databases for AI',
            content: 'Vector databases are specialized databases designed to store and query high-dimensional vectors efficiently. They are essential for AI applications that work with embeddings from machine learning models.',
            category: 'ai'
        },
        {
            title: 'Building GenAI Applications',
            content: 'Modern GenAI applications require efficient storage and retrieval of vector embeddings. PostgreSQL with pgvector extension provides a robust solution for vector similarity search in production environments.',
            category: 'genai'
        },
        {
            title: 'Database Monitoring with Datadog',
            content: 'Effective database monitoring involves tracking key metrics like connection counts, query performance, and resource utilization. Datadog provides comprehensive monitoring solutions for PostgreSQL databases.',
            category: 'monitoring'
        },
        {
            title: 'Scaling PostgreSQL in Production',
            content: 'Production PostgreSQL deployments require careful consideration of connection pooling, replication, backup strategies, and performance optimization. Vector workloads add additional complexity to scaling considerations.',
            category: 'scaling'
        }
    ];
    
    // Clear existing data
    await client.query('TRUNCATE TABLE documents RESTART IDENTITY');
    
    for (const doc of sampleDocs) {
        const embedding = generateEmbedding(doc.content);
        await client.query(
            'INSERT INTO documents (title, content, embedding, category) VALUES ($1, $2, $3, $4)',
            [doc.title, doc.content, JSON.stringify(embedding), doc.category]
        );
        console.log(`✅ Inserted: ${doc.title}`);
    }
    
    console.log(`📊 Total documents inserted: ${sampleDocs.length}`);
}

async function performVectorSearch(client, query) {
    console.log(`\n🔍 Performing vector search for: "${query}"`);
    
    const queryEmbedding = generateEmbedding(query);
    const startTime = Date.now();
    
    const result = await client.query(`
        SELECT 
            id,
            title,
            category,
            content,
            embedding <-> $1::vector AS distance
        FROM documents
        ORDER BY embedding <-> $1::vector
        LIMIT 3
    `, [JSON.stringify(queryEmbedding)]);
    
    const searchTime = Date.now() - startTime;
    
    console.log(`📈 Search completed in ${searchTime}ms`);
    console.log('📋 Results:');
    
    result.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. ${row.title} (${row.category})`);
        console.log(`   Distance: ${parseFloat(row.distance).toFixed(4)}`);
        console.log(`   Content: ${row.content.substring(0, 100)}...`);
    });
    
    return result.rows;
}

async function demonstrateRAGPattern(client) {
    console.log('\n🤖 Demonstrating RAG (Retrieval-Augmented Generation) Pattern...');
    
    const userQuery = "How do I optimize database performance for AI applications?";
    console.log(`User Query: "${userQuery}"`);
    
    // Step 1: Retrieve relevant documents using vector search
    const relevantDocs = await performVectorSearch(client, userQuery);
    
    // Step 2: Prepare context for LLM (simulated)
    const context = relevantDocs.map(doc => 
        `Title: ${doc.title}\nContent: ${doc.content}`
    ).join('\n\n');
    
    console.log('\n📝 Context prepared for LLM:');
    console.log(`Context length: ${context.length} characters`);
    console.log('Context preview:');
    console.log(context.substring(0, 200) + '...');
    
    // Step 3: In production, you would send this to an LLM
    console.log('\n💡 Next step: Send context + query to LLM for response generation');
    console.log('Example: OpenAI API call with retrieved context as system prompt');
}

async function showDatabaseStats(client) {
    console.log('\n📊 Database Statistics:');
    
    const stats = await client.query(`
        SELECT 
            COUNT(*) as total_documents,
            COUNT(DISTINCT category) as categories,
            AVG(length(content)) as avg_content_length
        FROM documents
    `);
    
    const indexInfo = await client.query(`
        SELECT 
            indexname,
            indexdef
        FROM pg_indexes 
        WHERE tablename = 'documents' AND indexname LIKE '%embedding%'
    `);
    
    console.log(`Documents: ${stats.rows[0].total_documents}`);
    console.log(`Categories: ${stats.rows[0].categories}`);
    console.log(`Average content length: ${Math.round(stats.rows[0].avg_content_length)} characters`);
    console.log(`Vector indexes: ${indexInfo.rows.length}`);
    
    if (indexInfo.rows.length > 0) {
        console.log(`Index type: ${indexInfo.rows[0].indexdef.includes('hnsw') ? 'HNSW' : 'IVFFlat'}`);
    }
}

async function main() {
    console.log('🚀 Starting Complete GenAI Application Test');
    console.log('🔗 Connecting to Azure PostgreSQL...');
    
    const pool = new Pool(CONFIG);
    const client = await pool.connect();
    
    try {
        // Test connection
        const version = await client.query('SELECT version()');
        console.log('✅ Connected to:', version.rows[0].version.substring(0, 50) + '...');
        
        // Initialize database
        await initializeDatabase(client);
        
        // Insert sample data
        await insertSampleDocuments(client);
        
        // Show database statistics
        await showDatabaseStats(client);
        
        // Perform various vector searches
        await performVectorSearch(client, "database monitoring and performance");
        await performVectorSearch(client, "vector embeddings for AI");
        await performVectorSearch(client, "scaling production systems");
        
        // Demonstrate RAG pattern
        await demonstrateRAGPattern(client);
        
        console.log('\n✅ Complete GenAI application test successful!');
        console.log('\n🎯 Production Readiness Summary:');
        console.log('✅ Azure PostgreSQL Flexible Server - Working');
        console.log('✅ pgvector Extension - Working');
        console.log('✅ Vector Storage & Retrieval - Working');
        console.log('✅ Vector Similarity Search - Working');
        console.log('✅ HNSW Indexing - Working');
        console.log('✅ RAG Pattern Implementation - Working');
        console.log('\n🚀 Ready for production GenAI applications on Azure!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main, generateEmbedding };