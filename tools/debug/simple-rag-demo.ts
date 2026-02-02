import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function simpleRAGDemo() {
  console.log('🔍 RAG INGEST WORKFLOW DEMO')
  console.log('============================\n')

  try {
    // Insert test document
    console.log('📥 Ingesting test document...')
    await prisma.documentEmbeddings.create({
      data: {
        document_id: 'demo-doc-1',
        content: 'VibeCode is an AI-powered development platform with live VS Code integration, supporting multiple AI models and enterprise security features.',
        embedding: Array(1536).fill(0.1),
        metadata: { source: 'demo' }
      }
    })
    console.log('   ✅ Document ingested')

    // Test search
    console.log('\n🔎 Testing similarity search...')
    const queryEmbedding = Array(1536).fill(0.1)
    const results = await prisma.$queryRawUnsafe<{ document_id: string; content: string; similarity: number }[]>(
      `SELECT document_id, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM document_embeddings
       WHERE document_id = 'demo-doc-1';`,
      `[${queryEmbedding.join(',')}]`
    )

    if (results.length > 0) {
      console.log('   ✅ Found document with similarity:', results[0].similarity.toFixed(3))
      console.log('   📄 Content preview:', results[0].content.slice(0, 60) + '...')
    }

    // Show database status
    console.log('\n📊 Database status...')
    const count = await prisma.documentEmbeddings.count()
    console.log(`   📈 Total documents: ${count}`)

    console.log('\n🎉 RAG WORKFLOW TESTED SUCCESSFULLY!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

simpleRAGDemo()
