#!/usr/bin/env tsx

import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'
import { generateLocalEmbedding, sanitizeText } from '../src/lib/ai/localEmbedding'

const prisma = new PrismaClient()

const LOCAL_DIM = parseInt(process.env.LOCAL_EMBEDDING_DIM || '1536', 10)
const USE_LOCAL = process.env.USE_LOCAL_EMBEDDINGS === 'true'
const USE_OPENROUTER = process.env.USE_OPENROUTER === 'true'
const OPENAI_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

async function fetchSimilarDocuments(embedding: number[], limit = 3) {
  const vectorLiteral = `[${embedding.join(',')}]`
  const rows = await prisma.$queryRawUnsafe<{
    document_id: string
    content: string
    similarity: number
  }>(
    `SELECT document_id, content, 1 - (embedding <=> $1::vector) AS similarity
     FROM document_embeddings
     ORDER BY similarity DESC
     LIMIT ${limit};`,
    vectorLiteral
  )

  return rows.map((row) => ({
    id: row.document_id,
    content: sanitizeText(row.content),
    similarity: Number(row.similarity ?? 0)
  }))
}

async function answerWithOpenRouter(query: string, context: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.warn('⚠️  OPENROUTER_API_KEY not provided; skipping LLM response.')
    return null
  }

  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://vibecode.ai',
      'X-Title': process.env.OPENROUTER_APP_TITLE || 'VibeCode WebGUI'
    }
  })

  const model = process.env.OPENROUTER_MODEL || 'mistralai/mistral-small-24b-instruct-2501:free'

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are the VibeCode documentation assistant. Answer using only the supplied context.'
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${query}\nProvide a concise answer and cite the relevant section titles.`
      }
    ]
  })

  return completion.choices?.[0]?.message?.content ?? null
}

async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_KEY) {
    throw new Error('OPENAI_API_KEY is required for OpenAI embeddings');
  }

  const client = new OpenAI({ apiKey: OPENAI_KEY });
  const response = await client.embeddings.create({
    model: OPENAI_MODEL,
    input: text,
  });

  const embedding = response.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error('OpenAI returned no embedding data');
  }

  return embedding;
}

async function createEmbedding(text: string): Promise<number[]> {
  if (USE_LOCAL) {
    return generateLocalEmbedding(text, LOCAL_DIM);
  }

  if (USE_OPENROUTER) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY required when USE_OPENROUTER=true');
    }

    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://vibecode.ai',
        'X-Title': process.env.OPENROUTER_APP_TITLE || 'VibeCode WebGUI'
      }
    });

    const model = process.env.OPENROUTER_EMBEDDING_MODEL || 'text-embedding-3-small';
    try {
      const response = await client.embeddings.create({
        model,
        input: text,
      });

      const embedding = response.data?.[0]?.embedding;
      if (embedding && embedding.length) {
        return embedding;
      }

      console.warn(`⚠️  OpenRouter embedding response missing data (model ${model}); falling back to OpenAI`);
    } catch (err) {
      console.warn(`⚠️  OpenRouter embedding request failed (${(err as Error).message}); attempting fallback.`);
    }

    if (OPENAI_KEY) {
      return generateOpenAIEmbedding(text);
    }

    if (USE_LOCAL) {
      return generateLocalEmbedding(text, LOCAL_DIM);
    }

    throw new Error('OpenRouter embedding failed and no fallback provider is configured');
  }

  if (OPENAI_KEY) {
    return generateOpenAIEmbedding(text);
  }

  throw new Error('No embedding provider configured. Set USE_LOCAL_EMBEDDINGS, USE_OPENROUTER, or OPENAI_API_KEY.');
}

async function main() {
  try {
    const query = process.argv.slice(2).join(' ') || 'How do I deploy VibeCode to production?'

    console.log(`🔍 Query: ${query}`)

    const embedding = await createEmbedding(query)
    const docs = await fetchSimilarDocuments(embedding, 3)

    if (docs.length === 0) {
      console.log('⚠️  No similar documents found.')
      return
    }

    console.log('\n📄 Top Matches:')
    docs.forEach((doc, index) => {
      console.log(` ${index + 1}. ${doc.id} (similarity ${(doc.similarity * 100).toFixed(2)}%)`)
      console.log(`    Preview: ${doc.content.slice(0, 120)}...`)
    })

    const context = docs
      .map((doc, index) => `Source ${index + 1} (similarity ${(doc.similarity * 100).toFixed(2)}%):\n${doc.content}`)
      .join('\n\n')

    const llmAnswer = await answerWithOpenRouter(query, context)
    if (llmAnswer) {
      console.log('\n💬 LLM Response (OpenRouter):\n')
      console.log(llmAnswer)
    }
  } catch (error) {
    console.error('❌ RAG demo failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
