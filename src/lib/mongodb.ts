import { MongoClient, Db } from 'mongodb'
import { logger } from './monitoring'

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/vibecode_chat'

if (!MONGODB_URL) {
  throw new Error('Please define the MONGODB_URL environment variable')
}

interface MongoConnection {
  client: MongoClient
  db: Db
}

let cachedConnection: MongoConnection | null = null

export async function connectToMongoDB(): Promise<MongoConnection> {
  if (cachedConnection) {
    return cachedConnection
  }

  try {
    const client = new MongoClient(MONGODB_URL)
    await client.connect()
    
    const dbName = new URL(MONGODB_URL).pathname.slice(1) || 'vibecode_chat'
    const db = client.db(dbName)
    
    cachedConnection = { client, db }
    
    // Debug log removed
    
    return cachedConnection
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error)
    throw error
  }
}

export async function getDatabase(): Promise<Db> {
  const connection = await connectToMongoDB()
  return connection.db
}