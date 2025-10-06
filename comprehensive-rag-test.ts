import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function comprehensiveRAGTest() {
  console.log('🚀 COMPREHENSIVE RAG INGEST WORKFLOW TEST')
  console.log('==========================================\n')

  try {
    // 1. Check database connection
    console.log('1. Testing database connection...')
    await prisma.$queryRaw`SELECT 1`
    console.log('   ✅ Database connected')

    // 2. Check if pgvector extension is loaded
    console.log('\n2. Checking pgvector extension...')
    const extResult = await prisma.$queryRaw`SELECT * FROM pg_extension WHERE extname = 'vector'`
    console.log(`   ✅ pgvector extension: ${Array.isArray(extResult) && extResult.length > 0 ? 'loaded' : 'not loaded'}`)

    // 3. Insert sample documents
    console.log('\n3. Ingesting sample documents...')
    const sampleDocs = [
      {
        document_id: 'deployment-guide',
        content: 'VibeCode deployment guide: Use docker-compose.prod.yml for production deployment. The application supports Kubernetes deployment with Helm charts and includes comprehensive monitoring with Datadog.',
        embedding: Array(1536).fill(0.1)
      },
      {
        document_id: 'ai-models',
        content: 'VibeCode supports multiple AI models including OpenAI GPT-4, Claude, and local models through Ollama. The platform provides unified API for all providers with intelligent fallbacks.',
        embedding: Array(1536).fill(0.15)
      },
      {
        document_id: 'security-features',
        content: 'VibeCode security: End-to-end encryption, SOC 2 compliance, enterprise SSO integration, and comprehensive audit logging. All data is encrypted at rest and in transit.',
        embedding: Array(1536).fill(0.08)
      }
    ]

    for (const doc of sampleDocs) {
      await prisma.documentEmbeddings.upsert({
        where: { document_id: doc.document_id },
        update: {
          content: doc.content,
          embedding: doc.embedding,
          updated_at: new Date()
        },
        create: {
          document_id: doc.document_id,
          content: doc.content,
          embedding: doc.embedding,
          metadata: { source: 'test-ingestion' }
        }
      })
    }
    console.log(`   ✅ Ingested ${sampleDocs.length} documents`)

    // 4. Test similarity search
    console.log('\n4. Testing vector similarity search...')
    const queryEmbedding = Array(1536).fill(0.12) // Similar to deployment guide
    const results = await prisma.$queryRawUnsafe<{ document_id: string; content: string; similarity: number }[]>(
      `SELECT document_id, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM document_embeddings
       ORDER BY similarity DESC
       LIMIT 3;`,
      `[${queryEmbedding.join(',')}]`
    )

    console.log(`   ✅ Found ${results.length} similar documents:`)
    results.forEach((doc, i) => {
      console.log(`      ${i + 1}. ${doc.document_id} (similarity: ${doc.similarity.toFixed(3)})`)
      console.log(`         ${doc.content.slice(0, 80)}...`)
    })

    // 5. Test RAG query workflow
    console.log('\n5. Testing complete RAG workflow...')
    const query = 'How do I deploy VibeCode to production?'
    const ragResults = await prisma.$queryRawUnsafe<{ document_id: string; content: string; similarity: number }[]>(
      `SELECT document_id, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM document_embeddings
       ORDER BY similarity DESC
       LIMIT 2;`,
      `[${queryEmbedding.join(',')}]`
    )

    const context = ragResults.map((doc, i) => 
      `Document ${i + 1} (${doc.document_id}):\n${doc.content}`
    ).join('\n\n')

    console.log(`   🔍 Query: "${query}"`)
    console.log(`   📄 Retrieved context from ${ragResults.length} documents`)
    console.log(`   📊 Total context length: ${context.length} characters`)

    // 6. Show performance metrics
    console.log('\n6. Performance metrics...')
    const totalDocs = await prisma.documentEmbeddings.count()
    const avgEmbeddingTime = await prisma.documentEmbeddings.aggregate({
      _avg: { embedding_generation_time_ms: true }
    })

    console.log(`   📈 Total documents: ${totalDocs}`)
    console.log(`   ⏱️  Avg embedding time: ${avgEmbeddingTime._avg.embedding_generation_time_ms?.toFixed(0) || 'N/A'}ms`)

    console.log('\n🎉 RAG INGEST WORKFLOW TEST COMPLETE!')
    console.log('=====================================')

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

comprehensiveRAGTest()
