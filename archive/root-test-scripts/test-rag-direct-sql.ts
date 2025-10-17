// Direct SQL test for RAG workflow (ES modules)
import pg from 'pg'
const { Client } = pg

async function testRAGDirectSQL() {
  console.log('🧪 DIRECT SQL RAG WORKFLOW TEST')
  console.log('===============================\n')

  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'vibecode',
    password: 'vibecode123',
    database: 'vibecode'
  })

  try {
    console.log('1. Connecting to database...')
    await client.connect()
    console.log('   ✅ Connected successfully')

    // 2. Insert test document
    console.log('\n2. Inserting test document...')
    const embedding = Array(1536).fill(0.1)
    await client.query(`
      INSERT INTO document_embeddings (document_id, content, embedding, metadata)
      VALUES ($1, $2, $3::vector, $4::jsonb)
      ON CONFLICT (document_id) DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        updated_at = CURRENT_TIMESTAMP
    `, [
      'direct-test-doc-1',
      'VibeCode is an AI-powered development platform with live VS Code integration, supporting multiple AI models and enterprise security.',
      embedding,
      { source: 'direct-test', type: 'documentation' }
    ])
    console.log('   ✅ Document inserted')

    // 3. Verify insertion
    console.log('\n3. Verifying document count...')
    const countResult = await client.query('SELECT COUNT(*) FROM document_embeddings')
    console.log(`   📈 Total documents: ${countResult.rows[0].count}`)

    // 4. Test similarity search
    console.log('\n4. Testing similarity search...')
    const queryEmbedding = Array(1536).fill(0.1)
    const searchResult = await client.query(`
      SELECT document_id, content, 1 - (embedding <=> $1::vector) AS similarity
      FROM document_embeddings
      ORDER BY similarity DESC
      LIMIT 3
    `, [queryEmbedding])

    console.log(`   ✅ Found ${searchResult.rows.length} similar documents:`)
    searchResult.rows.forEach((doc, i) => {
      console.log(`      ${i + 1}. ${doc.document_id} (similarity: ${doc.similarity.toFixed(4)})`)
      console.log(`         ${doc.content.slice(0, 80)}...`)
    })

    // 5. Test RAG query workflow
    console.log('\n5. Testing RAG query workflow...')
    const ragQueryEmbedding = Array(1536).fill(0.12) // Slightly different embedding
    const ragResult = await client.query(`
      SELECT document_id, content, 1 - (embedding <=> $1::vector) AS similarity
      FROM document_embeddings
      ORDER BY similarity DESC
      LIMIT 2
    `, [ragQueryEmbedding])

    const context = ragResult.rows.map(doc => doc.content).join('\n\n')
    console.log(`   🔍 Query embedding similarity search`)
    console.log(`   📄 Retrieved ${ragResult.rows.length} documents (${context.length} chars)`)
    console.log(`   🎯 Ready for LLM processing`)

    console.log('\n🎉 DIRECT SQL RAG WORKFLOW TESTED SUCCESSFULLY!')
    console.log('=============================================')

  } catch (error) {
    console.error('❌ RAG test failed:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      severity: error.severity
    })
  } finally {
    await client.end()
  }
}

testRAGDirectSQL()
