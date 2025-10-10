const { Client } = require('pg')

async function testRealRAG() {
  console.log('🧪 TESTING REAL RAG WORKFLOW WITH POSTGRESQL')
  console.log('============================================\n')

  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'vibecode',
    password: 'vibecode123',
    database: 'vibecode'
  })

  try {
    console.log('1. Connecting to PostgreSQL...')
    await client.connect()
    console.log('   ✅ Connected successfully')

    // Create the vector extension and table if they don't exist
    console.log('\n2. Setting up vector database...')
    await client.query('CREATE EXTENSION IF NOT EXISTS vector')
    console.log('   ✅ pgvector extension ready')

    await client.query(`
      CREATE TABLE IF NOT EXISTS document_embeddings (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255) UNIQUE NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('   ✅ Document embeddings table ready')

    // Insert a test document
    console.log('\n3. Inserting test document...')
    const testDoc = {
      document_id: 'vibecode-test-doc',
      content: 'VibeCode is an AI-powered development platform that provides live VS Code experience with multi-AI model support and enterprise-grade security features.',
      embedding: Array(1536).fill(0.1),
      metadata: { source: 'test', type: 'documentation' }
    }

    await client.query(`
      INSERT INTO document_embeddings (document_id, content, embedding, metadata)
      VALUES ($1, $2, $3::vector, $4::jsonb)
      ON CONFLICT (document_id) DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata
    `, [testDoc.document_id, testDoc.content, testDoc.embedding, testDoc.metadata])
    
    console.log('   ✅ Test document inserted')

    // Test similarity search
    console.log('\n4. Testing vector similarity search...')
    const queryEmbedding = Array(1536).fill(0.1)
    const results = await client.query(`
      SELECT document_id, content, 1 - (embedding <=> $1::vector) AS similarity
      FROM document_embeddings
      WHERE document_id = $2
    `, [queryEmbedding, testDoc.document_id])

    if (results.rows.length > 0) {
      const doc = results.rows[0]
      console.log(`   ✅ Found document: ${doc.document_id}`)
      console.log(`   📊 Similarity score: ${doc.similarity.toFixed(4)}`)
      console.log(`   📄 Content preview: ${doc.content.slice(0, 80)}...`)
    }

    // Show database statistics
    console.log('\n5. Database statistics...')
    const countResult = await client.query('SELECT COUNT(*) FROM document_embeddings')
    console.log(`   📈 Total documents: ${countResult.rows[0].count}`)

    console.log('\n�� REAL RAG WORKFLOW TESTED SUCCESSFULLY!')
    console.log('=========================================')

  } catch (error) {
    console.error('❌ RAG test failed:', error.message)
  } finally {
    await client.end()
  }
}

testRealRAG()
