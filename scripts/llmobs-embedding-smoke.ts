// Minimal smoke test to emit Datadog LLM Observability spans around an OpenAI embedding call
import 'dd-trace/init'
import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'
import { LLMTracer } from '@/lib/monitoring/llm-tracer'
import { llmObservability } from '@/lib/datadog-llm'

async function main() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is required')
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  const client = new OpenAI({ apiKey })
  const prisma = new PrismaClient()

  const input = 'VibeCode embedding smoke test sentence.'

  const result = await LLMTracer.traceLLMCall('embedding', {
    model,
    provider: 'openai',
    input,
    userId: 'smoke-user',
    sessionId: 'smoke-session',
  }, async () => {
    const resp = await client.embeddings.create({ model, input })
    const embedding = resp.data[0].embedding

    // Annotate ai.* tags explicitly via observability helper
    llmObservability.annotate({
      input_data: input,
      output_data: { embedding_length: embedding.length },
      metadata: { provider: 'openai', model },
      tags: ['smoke', 'embedding']
    })

    return { usage: (resp as any).usage || undefined, output: `len:${embedding.length}` }
  })

  console.log('Smoke test completed:', result)
}

await main()
