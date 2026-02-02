/* eslint-env node */
/* global console, require, process */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function ensureProject(userId, workspaceId) {
  const existing = await prisma.project.findFirst({
    where: { name: 'Perf Project', user_id: userId }
  })

  if (existing) return existing

  return prisma.project.create({
    data: {
      name: 'Perf Project',
      description: 'Synthetic project for rag chunk profiling',
      user_id: userId,
      workspace_id: workspaceId,
      language: 'typescript',
      framework: 'nextjs',
      status: 'active'
    }
  })
}

async function ensureFile(userId, workspaceId, projectId) {
  const existing = await prisma.file.findFirst({
    where: { path: '/perf/file.ts', user_id: userId }
  })

  if (existing) return existing

  return prisma.file.create({
    data: {
      name: 'perf-file.ts',
      path: '/perf/file.ts',
      content: 'Synthetic file for rag chunk profiling',
      size: 1024,
      mime_type: 'text/plain',
      language: 'typescript',
      lines: 200,
      checksum: 'perfchecksum',
      user_id: userId,
      workspace_id: workspaceId,
      project_id: projectId
    }
  })
}

async function seed() {
  const user = await prisma.user.findUnique({ where: { email: 'profiling@vibecode.local' } })
  if (!user) throw new Error('profiling user missing - run profile-chat-data script first')
  const workspace = await prisma.workspace.findUnique({ where: { workspace_id: 'workspace-perf' } })
  if (!workspace) throw new Error('workspace missing')

  const project = await ensureProject(user.id, workspace.id)
  const file = await ensureFile(user.id, workspace.id, project.id)

  const target = 50000
  const batchSize = 1000
  let created = 0

  await prisma.rAGChunk.deleteMany({ where: { chunk_id: { startsWith: 'perf-chunk-' } } })

  while (created < target) {
    const batch = Array.from({ length: Math.min(batchSize, target - created) }, (_, idx) => ({
      file_id: file.id,
      user_id: user.id,
      workspace_id: workspace.id,
      project_id: project.id,
      chunk_id: `perf-chunk-${created + idx}`,
      content: `Synthetic rag chunk ${(created + idx)} describing vector search, slow query tuning, and postgres performance insights ${(created + idx) % 50}.`,
      start_line: ((created + idx) % 1000) + 1,
      end_line: ((created + idx) % 1000) + 5,
      tokens: 256,
      token_count: 256,
      chunk_index: created + idx,
      metadata: { perfSeed: true, batch: Math.floor(created / batchSize) },
      created_at: new Date(),
      updated_at: new Date()
    }))

    await prisma.rAGChunk.createMany({ data: batch })
    created += batch.length
    console.log(`Inserted ${created} rag chunks`)
  }
}

seed()
  .then(async () => {
    console.log('RAG chunk dataset ready')
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error('Failed to seed rag chunks', err)
    await prisma.$disconnect()
    process.exit(1)
  })
