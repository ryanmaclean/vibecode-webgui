import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testRAG() {
  try {
    // Insert test data
    await prisma.documentEmbeddings.create({
      data: {
        document_id: 'test-doc-1',
        content: 'VibeCode is a platform for AI-powered development with live VS Code experience, multi-AI model support, and enterprise-grade security.',
        embedding: Array(1536).fill(0.1), // Mock embedding
        metadata: { source: 'test' }
      }
    })

    console.log('✅ Inserted test document')

    // Test similarity search
    const queryEmbedding = Array(1536).fill(0.1)
    const results = await prisma.$queryRawUnsafe<{ document_id: string; content: string; similarity: number }[]>(
      `SELECT document_id, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM document_embeddings
       ORDER BY similarity DESC
       LIMIT 3;`,
      `[${queryEmbedding.join(',')}]`
    )

    console.log('✅ Found', results.length, 'similar documents')
    results.forEach((doc, i) => {
      console.log(`${i + 1}. ${doc.document_id} (similarity: ${doc.similarity.toFixed(3)})`)
      console.log(`   ${doc.content.slice(0, 100)}...`)
    })

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testRAG()
