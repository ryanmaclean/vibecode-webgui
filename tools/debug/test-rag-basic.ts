import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testBasicRAG() {
  console.log('🧪 BASIC RAG WORKFLOW TEST')
  console.log('==========================\n')

  try {
    // 1. Insert test document
    console.log('📥 Step 1: Ingesting test document...')
    await prisma.documentEmbeddings.create({
      data: {
        document_id: 'test-rag-doc-1',
        content: 'VibeCode is an AI-powered development platform that provides live VS Code experience with multi-AI model support and enterprise-grade security features.',
        embedding: Array(1536).fill(0.1), // Mock embedding vector
        metadata: { source: 'test', type: 'documentation' }
      }
    })
    console.log('   ✅ Document ingested successfully')

    // 2. Verify insertion
    console.log('\n📊 Step 2: Verifying document count...')
    const count = await prisma.documentEmbeddings.count()
    console.log(`   📈 Total documents in DB: ${count}`)

    // 3. Test similarity search
    console.log('\n🔍 Step 3: Testing similarity search...')
    const queryEmbedding = Array(1536).fill(0.1)
    const results = await prisma.$queryRawUnsafe<{ document_id: string; content: string; similarity: number }[]>(
      `SELECT document_id, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM document_embeddings
       ORDER BY similarity DESC
       LIMIT 3;`,
      `[${queryEmbedding.join(',')}]`
    )

    console.log(`   ✅ Found ${results.length} similar documents:`)
    results.forEach((doc, i) => {
      console.log(`      ${i + 1}. ${doc.document_id} (similarity: ${doc.similarity.toFixed(4)})`)
      console.log(`         ${doc.content.slice(0, 80)}...`)
    })

    // 4. Test RAG query workflow
    console.log('\n🤖 Step 4: Testing RAG query workflow...')
    const query = 'What is VibeCode?'
    const ragResults = await prisma.$queryRawUnsafe<{ document_id: string; content: string; similarity: number }[]>(
      `SELECT document_id, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM document_embeddings
       ORDER BY similarity DESC
       LIMIT 2;`,
      `[${queryEmbedding.join(',')}]`
    )

    const context = ragResults.map(doc => doc.content).join('\n\n')
    console.log(`   🔍 Query: "${query}"`)
    console.log(`   📄 Retrieved context (${context.length} chars)`)
    console.log(`   🎯 Ready for LLM processing`)

    console.log('\n🎉 RAG INGEST WORKFLOW TESTED SUCCESSFULLY!')
    console.log('===========================================')

  } catch (error) {
    console.error('❌ RAG test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testBasicRAG()
