import 'dd-trace/init'

import { verifyRAGFunctionality } from './verify-rag-functionality'
import { PrismaClient } from '@prisma/client'
import { VectorService } from '../src/lib/db/vector'
import { EmbeddingService } from '../src/lib/ai/embeddingService'

async function runVectorQueries(prisma: PrismaClient) {
  const vectorService = new VectorService(prisma)
  const embeddingService = new EmbeddingService(
    process.env.OPENAI_API_KEY || '',
    process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    prisma
  )

  const queries = [
    'How do we configure Datadog LLM observability in this project?',
    'Outline the Azure App Service migration plan for VibeCode.',
    'How do we run production smoke tests according to the docs?'
  ]

  for (const query of queries) {
    const embedding = await embeddingService.generateEmbedding(query)
    const results = await vectorService.findSimilarDocuments({
      embedding,
      threshold: parseFloat(process.env.RAG_VERIFICATION_THRESHOLD || '0.35'),
      limit: 3
    })

    console.log(`\n=== Query: ${query} ===`)
    console.log(`Results: ${results.length}`)
    results.forEach((row, idx) => {
      console.log(`\nResult ${idx + 1} (similarity=${row.similarity.toFixed(3)})`)
      console.log(row.content.substring(0, 220).replace(/\s+/g, ' ') + '...')
    })
  }
}

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
  })

  try {
    await verifyRAGFunctionality()
    await runVectorQueries(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
