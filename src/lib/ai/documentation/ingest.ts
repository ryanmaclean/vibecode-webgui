import { ChromaClient } from 'chromadb';
import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';

// Custom text splitter implementation (replacement for @langchain/text-splitters)
class SimpleTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(chunkSize: number = 1000, chunkOverlap: number = 200) {
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

  splitDocuments(documents: Document[]): Document[] {
    const splitDocs: Document[] = [];
    
    for (const doc of documents) {
      const chunks = this.splitText(doc.pageContent);
      for (const chunk of chunks) {
        splitDocs.push(new Document({
          pageContent: chunk,
          metadata: doc.metadata
        }));
      }
    }
    
    return splitDocs;
  }

  async createDocuments(texts: string[], metadatas: Record<string, any>[] = []): Promise<Document[]> {
    const documents: Document[] = [];
    
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const metadata = metadatas[i] || {};
      const chunks = this.splitText(text);
      
      for (const chunk of chunks) {
        documents.push(new Document({
          pageContent: chunk,
          metadata: { ...metadata, chunkIndex: documents.length }
        }));
      }
    }
    
    return documents;
  }
}

export class DocumentationIngester {
  private chroma: ChromaClient;
  private embeddings: OpenAIEmbeddings;
  private splitter: SimpleTextSplitter;

  constructor() {
    this.chroma = new ChromaClient();
    this.embeddings = new OpenAIEmbeddings();
    this.splitter = new SimpleTextSplitter(1000, 200);
  }

  async ingestDocumentation(source: string, content: string, metadata: Record<string, any> = {}) {
    // Split document into chunks
    const docs = await this.splitter.createDocuments(
      [content],
      [{
        source,
        ...metadata,
        timestamp: new Date().toISOString(),
      }]
    );

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