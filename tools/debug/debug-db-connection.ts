import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugDB() {
  try {
    console.log('Testing basic connection...')
    await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Basic connection works')

    console.log('Checking table...')
    const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    console.log('Tables:', tables)

    console.log('Checking pgvector extension...')
    const ext = await prisma.$queryRaw`SELECT * FROM pg_extension WHERE extname = 'vector'`
    console.log('pgvector extension:', ext)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugDB()
