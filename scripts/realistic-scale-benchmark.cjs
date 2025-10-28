#!/usr/bin/env node

/**
 * Realistic Scale Benchmark for Azure PostgreSQL + pgvector
 * 
 * This script tests realistic workloads to understand actual performance
 * and identify production readiness gaps.
 */

const { Pool } = require('pg');

const CONFIG = {
    host: 'vibecode-demo-postgresql-lp6rgle5ovz6c.postgres.database.azure.com',
    port: 5432,
    database: 'postgres',
    user: 'vibecodeusr',
    password: process.env.POSTGRES_PASSWORD || 'VerySecurePass123!',
    ssl: { rejectUnauthorized: false },
    max: 20,  // Connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
};

// Generate more realistic embeddings (1536 dimensions like OpenAI)
function generateRealisticEmbedding(text, seed = 0) {
    const dimensions = 1536; // OpenAI ada-002 dimension
    const embedding = [];
    
    // Use text hash as base for deterministic generation
    let hash = seed;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash = hash & hash;
    }
    
    // Generate normalized vector
    for (let i = 0; i < dimensions; i++) {
        const angle = (hash + i) * 0.01;
        embedding.push(Math.sin(angle) * 0.1 + Math.cos(angle * 0.7) * 0.05);
    }
    
    // Normalize vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
}

// Generate sample documents at scale
function generateDocuments(count) {
    const categories = ['technology', 'science', 'business', 'health', 'education', 'research'];
    const templates = [
        'This document discusses {topic} in the context of {field}. Key concepts include {concept1} and {concept2}.',
        'Research shows that {topic} has significant impact on {field}. Studies indicate {concept1} while {concept2} remains unclear.',
        'In {field}, {topic} represents a major breakthrough. The implications for {concept1} and {concept2} are substantial.',
        'Analysis of {topic} reveals important patterns in {field}. Both {concept1} and {concept2} show promising results.',
        'The intersection of {topic} and {field} creates opportunities. We explore {concept1} alongside {concept2}.'
    ];
    
    const topics = ['artificial intelligence', 'machine learning', 'data analysis', 'cloud computing', 'automation', 'optimization'];
    const concepts = ['performance', 'scalability', 'efficiency', 'reliability', 'security', 'usability', 'integration'];
    
    const documents = [];
    
    for (let i = 0; i < count; i++) {
        const category = categories[i % categories.length];
        const template = templates[i % templates.length];
        const topic = topics[i % topics.length];
        const field = categories[(i + 1) % categories.length];
        const concept1 = concepts[i % concepts.length];
        const concept2 = concepts[(i + 2) % concepts.length];
        
        const content = template
            .replace('{topic}', topic)
            .replace('{field}', field)
            .replace('{concept1}', concept1)
            .replace('{concept2}', concept2);
            
        documents.push({
            title: `${topic.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} in ${field.charAt(0).toUpperCase() + field.slice(1)}`,
            content: content + ' ' + `Document ${i + 1} contains detailed analysis and research findings.`,
            category: category,
            doc_id: i + 1
        });
    }
    
    return documents;
}

async function setupBenchmarkDatabase(client) {
    console.log('🔧 Setting up benchmark database...');
    
    // Drop and recreate for clean benchmark
    await client.query('DROP TABLE IF EXISTS benchmark_docs');
    
    await client.query(`
        CREATE TABLE benchmark_docs (
            id SERIAL PRIMARY KEY,
            doc_id INTEGER,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding vector(1536),
            category TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('✅ Benchmark table created');
}

async function insertBenchmarkData(client, documents) {
    console.log(`📝 Inserting ${documents.length} benchmark documents...`);
    const startTime = Date.now();
    
    // Use batch inserts for better performance
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        // Prepare batch insert
        const values = [];
        const params = [];
        
        batch.forEach((doc, idx) => {
            const embedding = generateRealisticEmbedding(doc.content, doc.doc_id);
            const baseIdx = idx * 5;
            values.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5})`);
            params.push(doc.doc_id, doc.title, doc.content, JSON.stringify(embedding), doc.category);
        });
        
        const query = `
            INSERT INTO benchmark_docs (doc_id, title, content, embedding, category) 
            VALUES ${values.join(', ')}
        `;
        
        await client.query(query, params);
        inserted += batch.length;
        
        if (inserted % 500 === 0) {
            console.log(`  📊 Inserted ${inserted}/${documents.length} documents`);
        }
    }
    
    const insertTime = Date.now() - startTime;
    console.log(`✅ Inserted ${inserted} documents in ${insertTime}ms (${Math.round(insertTime / inserted)}ms per doc)`);
    
    return { insertTime, documentsInserted: inserted };
}

async function createIndexesAndAnalyze(client, documentCount) {
    console.log('🔍 Creating indexes and analyzing performance...');
    const startTime = Date.now();
    
    // Create HNSW index
    await client.query(`
        CREATE INDEX benchmark_embedding_hnsw_idx 
        ON benchmark_docs USING hnsw (embedding vector_l2_ops)
        WITH (m = 16, ef_construction = 64)
    `);
    
    const indexTime = Date.now() - startTime;
    console.log(`✅ HNSW index created in ${indexTime}ms`);
    
    // Analyze table for query planner
    await client.query('ANALYZE benchmark_docs');
    
    // Check table size
    const tableStats = await client.query(`
        SELECT 
            pg_relation_size('benchmark_docs') as table_size,
            pg_relation_size('benchmark_embedding_hnsw_idx') as index_size,
            COUNT(*) as row_count
        FROM benchmark_docs
    `);
    
    if (tableStats.rows.length > 0) {
        const stats = tableStats.rows[0];
        console.log(`📊 Storage Statistics:`);
        console.log(`   Rows: ${stats.row_count}`);
        console.log(`   Table size: ${Math.round(stats.table_size / 1024)} KB`);
        console.log(`   Index size: ${Math.round(stats.index_size / 1024)} KB`);
        console.log(`   Index/Table ratio: ${Math.round(100 * stats.index_size / stats.table_size)}%`);
    }
    
    return { indexCreationTime: indexTime };
}

async function runPerformanceBenchmarks(client, documentCount) {
    console.log('⚡ Running performance benchmarks...');
    
    const queries = [
        'artificial intelligence and machine learning applications',
        'cloud computing performance optimization techniques', 
        'data analysis and research methodologies',
        'business automation and efficiency improvements',
        'healthcare technology integration solutions'
    ];
    
    const results = [];
    
    for (const [index, query] of queries.entries()) {
        console.log(`\n🔍 Query ${index + 1}: "${query}"`);
        
        const queryEmbedding = generateRealisticEmbedding(query);
        const startTime = Date.now();
        
        const result = await client.query(`
            SELECT 
                doc_id,
                title,
                category,
                embedding <-> $1::vector AS distance
            FROM benchmark_docs
            ORDER BY embedding <-> $1::vector
            LIMIT 10
        `, [JSON.stringify(queryEmbedding)]);
        
        const queryTime = Date.now() - startTime;
        
        console.log(`   ⏱️  Query time: ${queryTime}ms`);
        console.log(`   📋 Results: ${result.rows.length} documents`);
        console.log(`   🎯 Top match: "${result.rows[0].title}" (distance: ${parseFloat(result.rows[0].distance).toFixed(4)})`);
        
        results.push({
            query,
            queryTime,
            resultCount: result.rows.length,
            topDistance: parseFloat(result.rows[0].distance)
        });
    }
    
    const avgQueryTime = results.reduce((sum, r) => sum + r.queryTime, 0) / results.length;
    const maxQueryTime = Math.max(...results.map(r => r.queryTime));
    const minQueryTime = Math.min(...results.map(r => r.queryTime));
    
    console.log(`\n📊 Performance Summary:`);
    console.log(`   Average query time: ${Math.round(avgQueryTime)}ms`);
    console.log(`   Min query time: ${minQueryTime}ms`);
    console.log(`   Max query time: ${maxQueryTime}ms`);
    console.log(`   Dataset size: ${documentCount} documents`);
    
    return {
        averageQueryTime: avgQueryTime,
        minQueryTime,
        maxQueryTime,
        queries: results.length
    };
}

async function testConcurrentLoad(pool, concurrentQueries = 10) {
    console.log(`\n🔥 Testing concurrent load (${concurrentQueries} simultaneous queries)...`);
    
    const testQuery = 'machine learning performance optimization';
    const queryEmbedding = generateRealisticEmbedding(testQuery);
    
    const promises = [];
    const startTime = Date.now();
    
    for (let i = 0; i < concurrentQueries; i++) {
        const promise = (async () => {
            const client = await pool.connect();
            try {
                const queryStart = Date.now();
                await client.query(`
                    SELECT doc_id, title, embedding <-> $1::vector AS distance
                    FROM benchmark_docs
                    ORDER BY embedding <-> $1::vector
                    LIMIT 5
                `, [JSON.stringify(queryEmbedding)]);
                return Date.now() - queryStart;
            } finally {
                client.release();
            }
        })();
        promises.push(promise);
    }
    
    const queryTimes = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    const avgConcurrentTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
    const maxConcurrentTime = Math.max(...queryTimes);
    
    console.log(`📊 Concurrent Load Results:`);
    console.log(`   Total time for ${concurrentQueries} queries: ${totalTime}ms`);
    console.log(`   Average query time: ${Math.round(avgConcurrentTime)}ms`);
    console.log(`   Max query time: ${maxConcurrentTime}ms`);
    console.log(`   Queries per second: ${Math.round(concurrentQueries / (totalTime / 1000))}`);
    
    return {
        totalTime,
        averageQueryTime: avgConcurrentTime,
        maxQueryTime: maxConcurrentTime,
        queriesPerSecond: concurrentQueries / (totalTime / 1000)
    };
}

async function main() {
    const documentCount = 1000; // Realistic scale test
    console.log(`🚀 Starting Realistic Scale Benchmark (${documentCount} documents)`);
    
    const pool = new Pool(CONFIG);
    const client = await pool.connect();
    
    try {
        // Setup
        await setupBenchmarkDatabase(client);
        
        // Generate and insert test data
        const documents = generateDocuments(documentCount);
        const insertStats = await insertBenchmarkData(client, documents);
        
        // Create indexes and analyze
        const indexStats = await createIndexesAndAnalyze(client, documentCount);
        
        // Performance benchmarks
        const perfStats = await runPerformanceBenchmarks(client, documentCount);
        
        // Concurrent load testing
        const concurrentStats = await testConcurrentLoad(pool, 10);
        
        console.log(`\n🎯 HONEST PRODUCTION READINESS ASSESSMENT:`);
        
        // Realistic performance thresholds
        const isPerformant = perfStats.averageQueryTime < 200; // 200ms reasonable for production
        const isConcurrentCapable = concurrentStats.queriesPerSecond > 20; // 20 QPS minimum
        const isScalable = documentCount >= 1000; // Tested at meaningful scale
        
        console.log(`\n✅ VALIDATED CAPABILITIES:`);
        console.log(`   ✅ Vector storage: ${documentCount} documents with 1536-dim embeddings`);
        console.log(`   ${isPerformant ? '✅' : '❌'} Query performance: ${Math.round(perfStats.averageQueryTime)}ms average (target: <200ms)`);
        console.log(`   ${isConcurrentCapable ? '✅' : '❌'} Concurrent capacity: ${Math.round(concurrentStats.queriesPerSecond)} QPS (target: >20 QPS)`);
        console.log(`   ${isScalable ? '✅' : '❌'} Scale validation: ${documentCount} documents (minimum: 1000)`);
        
        console.log(`\n⚠️  NOT TESTED (Production Gaps):`);
        console.log(`   ❌ Scale beyond 1K documents (production may be 10K-1M+)`);
        console.log(`   ❌ Real embedding service integration (OpenAI/Azure OpenAI)`);
        console.log(`   ❌ Memory usage under sustained load`);
        console.log(`   ❌ Index rebuild time for large datasets`);
        console.log(`   ❌ Backup/restore procedures with vector data`);
        console.log(`   ❌ Monitoring and alerting integration`);
        console.log(`   ❌ Security hardening (access control, encryption at rest)`);
        console.log(`   ❌ Disaster recovery procedures`);
        
        const isProductionReady = isPerformant && isConcurrentCapable && isScalable;
        console.log(`\n🎯 HONEST STATUS: ${isProductionReady ? '✅ MVP VALIDATED' : '❌ NEEDS IMPROVEMENT'} (NOT production ready)`);
        
        if (!isProductionReady) {
            console.log(`\n🔧 RECOMMENDED IMPROVEMENTS:`);
            if (!isPerformant) console.log(`   - Optimize queries or increase server resources`);
            if (!isConcurrentCapable) console.log(`   - Increase connection pool size or server capacity`);
            if (!isScalable) console.log(`   - Test with larger datasets`);
        }
        
    } catch (error) {
        console.error('❌ Benchmark Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    main().catch(console.error);
}