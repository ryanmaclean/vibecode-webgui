import { ChromaClient } from 'chroma-js';
import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export class DocumentationIngester {
  private chroma: ChromaClient;
  private embeddings: OpenAIEmbeddings;
  private splitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.chroma = new ChromaClient();
    this.embeddings = new OpenAIEmbeddings();
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
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

    // Store in vector database
    await this.chroma.upsert({
      ids: docs.map((_, i) => `${source}-${i}`),
      embeddings,
      metadatas: docs.map(doc => doc.metadata),
      documents: docs.map(doc => doc.pageContent),
    });
  }
}
