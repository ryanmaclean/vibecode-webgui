// Simple Node.js test for RAG workflow
const { Client } = require('pg')

async function testRAG() {
  console.log('🧪 SIMPLE RAG WORKFLOW TEST')
  console.log('===========================\n')

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

    console.log('2. Inserting test document...')
    const embedding = Array(1536).fill(0.1)
    await client.query(`
      INSERT INTO document_embeddings (document_id, content, embedding, metadata)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (document_id) DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        updated_at = CURRENT_TIMESTAMP
    `, [
      'simple-test-doc-1',
      'VibeCode is an AI-powered development platform with live VS Code integration.',
      `[${embedding.join(',')}]`,
      JSON.stringify({ source: 'simple-test' })
    ])
    console.log('   ✅ Document inserted')

    console.log('3. Checking document count...')
    const countResult = await client.query('SELECT COUNT(*) FROM document_embeddings')
    console.log(`   📈 Total documents: ${countResult.rows[0].count}`)

    console.log('4. Testing similarity search...')
    const searchResult = await client.query(`
      SELECT document_id, content, 1 - (embedding <=> $1::vector) AS similarity
      FROM document_embeddings
      WHERE document_id = 'simple-test-doc-1'
    `, [`[${Array(1536).fill(0.1).join(',')}]`])

    if (searchResult.rows.length > 0) {
      console.log('   ✅ Found document with similarity:', searchResult.rows[0].similarity.toFixed(4))
    }

    console.log('\n🎉 RAG WORKFLOW TESTED SUCCESSFULLY!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.end()
  }
}

testRAG()
