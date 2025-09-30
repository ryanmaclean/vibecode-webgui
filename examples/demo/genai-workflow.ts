import { PrismaClient } from '@prisma/client';
import { EmbeddingServiceFactory } from '../src/lib/ai/embeddingServiceFactory';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize services
const prisma = new PrismaClient();
const factory = new EmbeddingServiceFactory(prisma);
const embeddingService = factory.createEmbeddingServiceFromEnv();

// Sample documents for demonstration
const SAMPLE_DOCUMENTS = [
  {
    id: 'doc1',
    title: 'Introduction to AI',
    content: 'Artificial Intelligence is the simulation of human intelligence processes by machines, especially computer systems.'
  },
  {
    id: 'doc2',
    title: 'Machine Learning Basics',
    content: 'Machine learning is a subset of AI that enables systems to learn and improve from experience without being explicitly programmed.'
  },
  {
    id: 'doc3',
    title: 'Deep Learning Overview',
    content: 'Deep learning is a specialized form of machine learning that uses neural networks with many layers to model complex patterns in data.'
  },
  {
    id: 'doc4',
    title: 'Natural Language Processing',
    content: 'NLP is a field of AI focused on enabling computers to understand, interpret, and generate human language.'
  },
  {
    id: 'doc5',
    title: 'Computer Vision',
    content: 'Computer vision is a field of AI that trains computers to interpret and understand the visual world.'
  }
];

async function main() {
  console.log('🚀 Starting GenAI with PostgreSQL Demo\n');

  try {
    // 1. Store sample documents with embeddings
    console.log('📝 Storing sample documents with embeddings...');
    for (const doc of SAMPLE_DOCUMENTS) {
      await embeddingService.storeDocument(
        doc.id,
        doc.content,
        { title: doc.title, source: 'demo' }
      );
      console.log(`  - Stored document: ${doc.title}`);
    }

    // 2. Perform a similarity search
    console.log('\n🔍 Performing similarity search...');
    const query = 'What is artificial intelligence and how does it relate to machine learning?';
    console.log(`  Query: "${query}"`);
    
    const similarDocs = await embeddingService.findSimilarDocuments(query, {
      threshold: 0.7,
      limit: 3
    });

    console.log('\n📊 Search Results:');
    similarDocs.forEach((doc, i) => {
      console.log(`\n  ${i + 1}. ${doc.document_id} (Similarity: ${(doc.similarity * 100).toFixed(1)}%)`);
      console.log(`     ${doc.content.substring(0, 100)}...`);
    });

    // 3. Perform a RAG query
    console.log('\n🤖 Performing RAG query...');
    const ragResult = await embeddingService.ragQuery(
      'Explain the difference between AI and machine learning',
      { threshold: 0.6, limit: 2 }
    );

    console.log('\n📚 Retrieved Documents:');
    if (ragResult.documents && ragResult.documents.length > 0) {
      ragResult.documents.forEach((doc, i) => {
        console.log(`\n  ${i + 1}. ${doc.document_id} (Similarity: ${(doc.similarity * 100).toFixed(1)}%)`);
        console.log(`     ${doc.content.substring(0, 100)}...`);
      });
    }

    // 4. Show statistics
    console.log('\n📈 Retrieving statistics...');
    const stats = await embeddingService.getStats();
    console.log('\n📊 Embedding Statistics:');
    console.table(stats);

    console.log('\n✅ Demo completed successfully!');
  } catch (error) {
    console.error('\n❌ Error during demo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
