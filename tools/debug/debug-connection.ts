import { PrismaClient } from '@prisma/client'

async function debugConnection() {
  console.log('🔧 DEBUGGING PRISMA CONNECTION')
  console.log('==============================\n')

  const prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
    errorFormat: 'pretty'
  })

  try {
    console.log('1. Testing basic connection...')
    await prisma.$connect()
    console.log('   ✅ Connected to database')

    console.log('2. Testing query...')
    const result = await prisma.$queryRaw`SELECT current_database(), version()`
    console.log('   ✅ Query result:', result)

    console.log('3. Checking document_embeddings table...')
    const tableCheck = await prisma.$queryRaw`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'document_embeddings' 
      LIMIT 3
    `
    console.log('   ✅ Table structure:', tableCheck)

    console.log('4. Testing insert...')
    const insertResult = await prisma.documentEmbeddings.create({
      data: {
        document_id: 'debug-test-123',
        content: 'This is a debug test document for RAG workflow verification.',
        embedding: Array(1536).fill(0.1),
        metadata: { source: 'debug' }
      }
    })
    console.log('   ✅ Insert successful:', insertResult.document_id)

    console.log('5. Testing select...')
    const selectResult = await prisma.documentEmbeddings.findMany({
      take: 1
    })
    console.log('   ✅ Select successful, count:', selectResult.length)

    console.log('\n🎉 PRISMA CONNECTION DEBUGGING COMPLETE!')
    console.log('=====================================')

  } catch (error) {
    console.error('❌ Error during debugging:', error)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      meta: error.meta
    })
  } finally {
    await prisma.$disconnect()
  }
}

debugConnection()
