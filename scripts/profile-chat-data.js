/* eslint-env node */
/* global console, require, process */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function seed() {
  const user = await prisma.user.upsert({
    where: { email: 'profiling@vibecode.local' },
    update: {},
    create: {
      email: 'profiling@vibecode.local',
      name: 'Perf Profiler',
      role: 'user'
    }
  })

  const workspace = await prisma.workspace.upsert({
    where: { workspace_id: 'workspace-perf' },
    update: {},
    create: {
      name: 'Perf Workspace',
      workspace_id: 'workspace-perf',
      user_id: user.id,
      status: 'active',
      description: 'Synthetic workspace for query profiling'
    }
  })

  const conversationTargets = 1000
  const messagesPerConversation = 40

  for (let i = 0; i < conversationTargets; i++) {
    const conversation = await prisma.conversation.create({
      data: {
        title: `Profiler Conversation ${i + 1}`,
        user_id: user.id,
        workspace_id: workspace.id,
        status: 'ACTIVE',
        message_count: messagesPerConversation,
        total_tokens: messagesPerConversation * 128,
        metadata: { seed: 'profile-chat-data', index: i }
      }
    })

    const messages = Array.from({ length: messagesPerConversation }, (_, idx) => ({
      conversation_id: conversation.id,
      role: idx % 2 === 0 ? 'USER' : 'ASSISTANT',
      content: `Synthetic message ${idx + 1} in conversation ${conversation.id}. Keywords: performance, postgres, search, slow query ${idx}.`,
      tokens: 128,
      model: 'gpt-4.1-mini',
      provider: 'openrouter',
      metadata: { conversationIndex: i, messageIndex: idx },
      created_at: new Date(Date.now() - (conversationTargets - i) * 60000 + idx * 1000),
      updated_at: new Date()
    }))

    await prisma.message.createMany({ data: messages })

    if ((i + 1) % 100 === 0) {
      console.log(`Inserted ${(i + 1)} conversations (${(i + 1) * messagesPerConversation} messages)`) 
    }
  }
}

seed()
  .then(async () => {
    console.log('Profiling dataset ready')
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error('Failed to seed profiling data', err)
    await prisma.$disconnect()
    process.exit(1)
  })
