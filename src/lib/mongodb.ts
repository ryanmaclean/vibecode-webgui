import { MongoClient, Db } from 'mongodb'
import { logger } from './monitoring'

const MONGODB_URL = process.env.MONGODB_URL || process.env.MONGODB_URI;

if (!MONGODB_URL) {
  console.warn(`
⚠️  MongoDB not configured.

Chat features will be limited without MongoDB setup.
To enable MongoDB:
1. Set MONGODB_URL in your .env.local file
2. Example: mongodb://localhost:27017/vibecode_chat
3. Or run: npm run setup:env

See docs/wiki-archive/ENV_VARIABLES.md for more details.
`);
}

interface MongoConnection {
  client: MongoClient
  db: Db
}

let cachedConnection: MongoConnection | null = null

export async function connectToMongoDB(): Promise<MongoConnection> {
  if (!MONGODB_URL) {
    throw new Error(`
MongoDB connection not available.
Please set MONGODB_URL environment variable.

Example: MONGODB_URL=mongodb://localhost:27017/vibecode_chat
`);
  }

  if (cachedConnection) {
    return cachedConnection
  }

  try {
    const client = new MongoClient(MONGODB_URL, {
      // Connection options for better reliability
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    
    await client.connect()
    
    const dbName = new URL(MONGODB_URL).pathname.slice(1) || 'vibecode_chat'
    const db = client.db(dbName)
    
    // Test the connection
    await db.admin().ping();
    
    cachedConnection = { client, db }
    
    console.log('✅ Connected to MongoDB:', dbName)
    
    return cachedConnection
  } catch (error) {
    const errorMsg = `
❌ Failed to connect to MongoDB!

Connection string: ${MONGODB_URL}
Error: ${error instanceof Error ? error.message : 'Unknown error'}

Troubleshooting:
1. Ensure MongoDB is running
2. Check connection string format
3. Verify network connectivity
4. Check authentication credentials

See docs/wiki-archive/ENV_VARIABLES.md for setup help.
`;
    console.error(errorMsg);
    throw new Error(`MongoDB connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getDatabase(): Promise<Db> {
  const connection = await connectToMongoDB()
  return connection.db
}