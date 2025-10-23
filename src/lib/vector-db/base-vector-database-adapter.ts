/**
 * Base Vector Database Adapter
 * Abstract base class for vector database implementations
 */

export interface VectorSearchOptions {
  limit?: number;
  filter?: Record<string, any>;
  threshold?: number;
}

export interface VectorDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export interface VectorSearchResult {
  document: VectorDocument;
  similarity: number;
  distance?: number;
}

export abstract class BaseVectorDatabaseAdapter {
  protected name: string;
  protected config: Record<string, any>;

  constructor(name: string, config: Record<string, any> = {}) {
    this.name = name;
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isHealthy(): Promise<boolean>;
  
  abstract addDocuments(documents: VectorDocument[]): Promise<void>;
  abstract removeDocument(id: string): Promise<boolean>;
  abstract updateDocument(id: string, document: Partial<VectorDocument>): Promise<boolean>;
  
  abstract search(query: string, options?: VectorSearchOptions): Promise<VectorSearchResult[]>;
  abstract searchByEmbedding(embedding: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]>;
  
  abstract getDocumentById(id: string): Promise<VectorDocument | null>;
  abstract getDocumentCount(): Promise<number>;
  
  abstract createCollection(name: string, options?: Record<string, any>): Promise<void>;
  abstract deleteCollection(name: string): Promise<void>;
  abstract listCollections(): Promise<string[]>;

  getName(): string {
    return this.name;
  }

  getConfig(): Record<string, any> {
    return { ...this.config };
  }
}
