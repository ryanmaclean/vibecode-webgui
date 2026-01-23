import { ChromaClient, type Collection, type Metadata } from 'chromadb';
import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';

// Simple text splitter implementation
class SimpleTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(chunkSize = 1000, chunkOverlap = 200) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  splitText(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk);
      start = end - this.chunkOverlap;
    }
    
    return chunks;
  }
}

const textSplitter = new SimpleTextSplitter();

export class DocumentationIngester {
  private chroma: ChromaClient;
  private embeddings: OpenAIEmbeddings;
  private splitter: SimpleTextSplitter;

  constructor() {
    this.chroma = new ChromaClient();
    this.embeddings = new OpenAIEmbeddings();
    this.splitter = textSplitter;
  }

  async ingestDocumentation(
    source: string, 
    content: string, 
    metadata: Record<string, string | number | boolean> = {}
  ): Promise<void> {
    // Split document into chunks
    const chunks = this.splitter.splitText(content);
    const docs = chunks.map((chunk, i) => new Document({
      pageContent: chunk,
      metadata: {
        source,
        chunkIndex: i,
        ...metadata,
        timestamp: new Date().toISOString(),
      }
    }));

    // Generate embeddings
    const embeddings = await this.embeddings.embedDocuments(
      docs.map(doc => doc.pageContent)
    );

    // Store in vector database via collection
    const collection: Collection = await this.chroma.getOrCreateCollection({ 
      name: 'documentation' 
    });
    
    // Prepare payload with properly typed metadata
    const metadatas: Metadata[] = docs.map(doc => {
      const meta: Metadata = {
        source: String(doc.metadata.source),
        chunkIndex: Number(doc.metadata.chunkIndex),
        timestamp: String(doc.metadata.timestamp),
      };
      // Copy additional metadata fields (only primitive types)
      for (const [key, value] of Object.entries(doc.metadata)) {
        if (![source, 'chunkIndex', 'timestamp'].includes(key)) {
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            meta[key] = value;
          }
        }
      }
      return meta;
    });

    const payload = {
      ids: docs.map((_, i) => `${source}-${i}`),
      embeddings,
      metadatas,
      documents: docs.map(doc => doc.pageContent),
    };

    // Use upsert if available, otherwise fall back to add
    if (typeof collection.upsert === 'function') {
      await collection.upsert(payload);
    } else {
      await collection.add(payload);
    }
  }
}
