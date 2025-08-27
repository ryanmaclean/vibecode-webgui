import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import VectorService using dynamic import for ESM compatibility
const { VectorService } = await import(join(__dirname, '../src/lib/db/vector.js'));

dotenv.config();

const prisma = new PrismaClient();
const vectorService = new VectorService(prisma);

const SAMPLE_QUERIES = [
  {
    query: 'What is artificial intelligence?',
    response: 'Artificial Intelligence is the simulation of human intelligence processes by machines.'
  },
  {
    query: 'How does machine learning work?',
    response: 'Machine learning uses algorithms to parse data, learn from it, and make predictions.'
  },
  {
    query: 'What is natural language processing?',
    response: 'NLP enables computers to understand, interpret, and generate human language.'
  }
];

async function setupDatabase() {
  console.log('🚀 Setting up demo database...');

  try {
    // 1. Clear existing data
    console.log('🧹 Cleaning up existing data...');
    await prisma.$executeRaw`TRUNCATE TABLE document_embeddings CASCADE`;

    // 2. Insert sample queries
    console.log('📝 Inserting sample queries...');
    for (const [index, item] of SAMPLE_QUERIES.entries()) {
      await vectorService.upsertEmbedding({
        documentId: `query-${index + 1}`,
        content: `${item.query}\n\n${item.response}`,
        metadata: {
          type: 'query',
          language: 'en',
          createdAt: new Date().toISOString()
        },
        embedding: Array(1536).fill(0.1) // Mock embedding for demo
      });
    }

    console.log('✅ Database setup complete!');
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupDatabase();
