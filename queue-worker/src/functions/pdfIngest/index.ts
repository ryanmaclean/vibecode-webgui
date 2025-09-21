import { app, InvocationContext, QueueMessage } from '@azure/functions'
import { BlobServiceClient } from '@azure/storage-blob'
import pdfParse from 'pdf-parse'
import { OpenAIClient, AzureKeyCredential } from '@azure/openai'
import { Pool, PoolClient } from 'pg'

export type PdfIngestQueueMessage = {
  jobId: string
  uploadId?: number | null
  blobName: string
  blobContainer: string
  originalFileName: string
  size: number
  uploader?: string | null
  workspaceId?: string | null
  options?: {
    projectId?: string | null
    source?: string | null
  }
  requestedAt: string
}

const storageConnection = process.env.STORAGE_ACCOUNT_CONNECTION
const blobServiceClient = storageConnection
  ? BlobServiceClient.fromConnectionString(storageConnection)
  : undefined

const openAiEndpoint = process.env.AZURE_OPENAI_ENDPOINT
const openAiKey = process.env.AZURE_OPENAI_API_KEY
const embeddingDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-3-large'

const openAiClient = openAiEndpoint && openAiKey
  ? new OpenAIClient(openAiEndpoint, new AzureKeyCredential(openAiKey))
  : undefined

const databaseUrl = process.env.DATABASE_URL
const pgPool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined

function ensureEnv(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function splitIntoChunks(text: string, chunkSizeWords = 400, overlapWords = 80) {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: { content: string; index: number; tokenCount: number }[] = []

  if (words.length === 0) {
    return chunks
  }

  let index = 0
  let start = 0
  const step = Math.max(chunkSizeWords - overlapWords, 50)

  while (start < words.length) {
    const slice = words.slice(start, Math.min(start + chunkSizeWords, words.length))
    const content = slice.join(' ').trim()
    if (content.length > 0) {
      chunks.push({
        content,
        index,
        tokenCount: Math.ceil(content.length / 4) // rough estimate
      })
      index += 1
    }
    start += step
  }

  return chunks
}

async function streamToBuffer(readable: NodeJS.ReadableStream | null | undefined): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!readable) {
      reject(new Error('No readable stream'))
      return
    }
    const chunks: Buffer[] = []
    readable.on('data', (data) => chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data)))
    readable.on('end', () => resolve(Buffer.concat(chunks)))
    readable.on('error', reject)
  })
}

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  ensureEnv(pgPool, 'DATABASE_URL is not configured')
  const client = await pgPool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

async function markJobStatus(id: string, status: string, fields: Record<string, unknown> = {}) {
  const columns = Object.keys(fields)
  const assignments = columns.map((col, idx) => `"${col}" = $${idx + 2}`)
  const values = Object.values(fields)
  const updateFragments = [`status = $1`]
  if (!columns.includes('updated_at')) {
    updateFragments.push('updated_at = now()')
  }
  if (assignments.length) {
    updateFragments.push(...assignments)
  }
  await withClient(async (client) => {
    await client.query(
      `UPDATE rag_ingest_jobs SET ${updateFragments.join(', ')} WHERE id = $${columns.length + 2}`,
      [status, ...values, id]
    )
  })
}

async function processJob(payload: PdfIngestQueueMessage, context: InvocationContext) {
  ensureEnv(blobServiceClient, 'STORAGE_ACCOUNT_CONNECTION is not configured')
  ensureEnv(openAiClient, 'Azure OpenAI endpoint/key not configured')

  const containerClient = blobServiceClient.getContainerClient(payload.blobContainer)
  const blobClient = containerClient.getBlockBlobClient(payload.blobName)
  const download = await blobClient.download()
  const pdfBuffer = await streamToBuffer(download.readableStreamBody)

  const pdfData = await pdfParse(pdfBuffer)
  const text = pdfData.text?.trim() ?? ''
  if (!text) {
    throw new Error('Extracted PDF text is empty')
  }

  const chunks = splitIntoChunks(text)
  if (chunks.length === 0) {
    throw new Error('Unable to create chunks from PDF text')
  }

  const jobRow = await withClient(async (client) => {
    const result = await client.query('SELECT * FROM rag_ingest_jobs WHERE id = $1', [payload.jobId])
    if (result.rowCount === 0) {
      throw new Error(`Job ${payload.jobId} not found in rag_ingest_jobs`)
    }
    return result.rows[0]
  })

  const uploadId = jobRow.upload_id as number | null
  if (!uploadId) {
    throw new Error('Job missing upload reference')
  }

  const uploadRow = await withClient(async (client) => {
    const res = await client.query('SELECT * FROM uploads WHERE id = $1', [uploadId])
    if (res.rowCount === 0) {
      throw new Error(`Upload ${uploadId} not found`)
    }
    return res.rows[0]
  })

  const userId: number = uploadRow.user_id
  const workspaceId: number | null = uploadRow.workspace_id
  const projectId: number | null = jobRow.project_identifier ? Number(jobRow.project_identifier) : null

  const fileId = await withClient(async (client) => {
    const result = await client.query(
      `INSERT INTO files (name, path, size, mime_type, user_id, workspace_id, project_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) RETURNING id`,
      [payload.originalFileName, `${payload.blobContainer}/${payload.blobName}`, payload.size, 'application/pdf', userId, workspaceId, projectId]
    )
    return result.rows[0].id as number
  })

  const embeddingVectors: number[][] = []
  for (const chunk of chunks) {
    const embeddingResult = await openAiClient!.getEmbeddings(embeddingDeployment, [chunk.content])
    const embedding = embeddingResult.data[0]?.embedding
    if (!embedding) {
      throw new Error('Failed to generate embedding for chunk')
    }
    embeddingVectors.push(embedding)
  }

  await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i]
        const embedding = embeddingVectors[i]
        const embeddingLiteral = `[${embedding.join(',')}]`
        await client.query(
          `INSERT INTO rag_chunks (content, metadata, file_id, user_id, workspace_id, project_id, chunk_index, token_count, start_line, end_line, chunk_id, embedding, created_at, updated_at)
           VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, NULL, NULL, $9, $10::vector, now(), now())`,
          [
            chunk.content,
            JSON.stringify({
              jobId: payload.jobId,
              uploadId,
              chunkIndex: chunk.index,
              source: payload.options?.source ?? 'manual-upload'
            }),
            fileId,
            userId,
            workspaceId,
            projectId,
            chunk.index,
            chunk.tokenCount,
            `${payload.jobId}:${chunk.index}`,
            embeddingLiteral
          ]
        )
      }

      await client.query(
        `UPDATE rag_ingest_jobs
           SET status = $1,
               chunk_count = $2,
               completed_at = now(),
               updated_at = now()
         WHERE id = $3`,
        ['completed', chunks.length, payload.jobId]
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })

  context.log(`Job ${payload.jobId} completed with ${chunks.length} chunks`)
}

app.queue('pdfIngest', {
  name: 'message',
  queueName: process.env.STORAGE_QUEUE_NAME || 'pdf-processing',
  connection: 'STORAGE_ACCOUNT_CONNECTION'
}, async (message: QueueMessage<PdfIngestQueueMessage>, context: InvocationContext) => {
  const raw = (message as QueueMessage<unknown>).body ?? message
  const payload: PdfIngestQueueMessage = typeof raw === 'string' ? JSON.parse(raw) : (raw as PdfIngestQueueMessage)
  try {
    await markJobStatus(payload.jobId, 'processing', { started_at: new Date() })
    await processJob(payload, context)
  } catch (error) {
    context.error(`Error processing job ${payload.jobId}`, error)
    await markJobStatus(payload.jobId, 'failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      completed_at: new Date(),
      chunk_count: 0
    })
    throw error
  }
})
