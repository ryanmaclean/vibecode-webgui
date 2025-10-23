import { ChromaClient } from 'chromadb';
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

  async ingestDocumentation(source: string, content: string, metadata: Record<string, any> = {}) {
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
    const collection = await this.chroma.getOrCreateCollection({ name: 'documentation' } as any);
    const payload = {
      ids: docs.map((_, i) => `${source}-${i}`),
      embeddings,
      metadatas: docs.map(doc => doc.metadata as any),
      documents: docs.map(doc => doc.pageContent),
    } as any;
    if (typeof (collection as any).upsert === 'function') {
      await (collection as any).upsert(payload);
    } else {
      await (collection as any).add(payload);
    }
  }
}
