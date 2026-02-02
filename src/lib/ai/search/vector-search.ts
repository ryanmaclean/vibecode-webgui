import { ChromaClient, type GetResult, type Metadata } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';

// Extended type for ChromaDB get result with distances
interface ChromaGetResult extends GetResult<Metadata> {
  distances?: number[][];
}

interface DocumentMetadata {
  source?: string;
  [key: string]: string | number | boolean | string[] | null | undefined;
}

export interface SearchResult {
  content: string;
  metadata: DocumentMetadata;
  score: number;
}

interface ChromaCollection {
  name: string;
  id: string;
  metadata?: Record<string, unknown>;
}

export class VectorSearch {
  private chroma: ChromaClient;
  private embeddings: OpenAIEmbeddings;
  private chromaAvailable: boolean = true;

  constructor() {
    this.chroma = new ChromaClient({
      path: process.env.CHROMA_DB_URL || 'http://localhost:8000'
    });
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    // Initial availability check (non-blocking)
    this.checkChromaAvailability();
  }

  private async checkChromaAvailability(): Promise<boolean> {
    try {
      await this.chroma.heartbeat();
      this.chromaAvailable = true;
      return true;
    } catch {
      this.chromaAvailable = false;
      console.warn('ChromaDB is not available - vector search features will be disabled');
      return false;
    }
  }

  private async createCollectionIfNotExists(collectionName: string): Promise<void> {
    if (!this.chromaAvailable) {
      return;
    }
    try {
      const collections = await this.chroma.listCollections();
      const exists = collections.some((collection: ChromaCollection) =>
        collection.name === collectionName
      );
      if (!exists) {
        await this.chroma.createCollection({
          name: collectionName,
          // Add any additional collection configuration here
        });
      }
    } catch (error) {
      this.chromaAvailable = false;
      console.warn('ChromaDB unavailable - cannot create collection:', error instanceof Error ? error.message : String(error));
    }
  }

  async addDocuments(documents: Document[], collectionName: string): Promise<void> {
    // Skip if ChromaDB is not available
    if (!this.chromaAvailable) {
      return;
    }
    try {
      await this.createCollectionIfNotExists(collectionName);
      const collection = await this.chroma.getCollection({
        name: collectionName
      });

      const texts = documents.map(doc => doc.pageContent);
      const embeddings = await this.embeddings.embedDocuments(texts);

      // Prepare metadata with proper type safety for ChromaDB
      const metadatas: Metadata[] = documents.map(doc => {
        const metadata: Record<string, string | number | boolean | null> = {};

        // Copy all metadata properties, handling type conversion
        if (doc.metadata) {
          Object.entries(doc.metadata).forEach(([key, value]) => {
            if (value === null || value === undefined) {
              metadata[key] = null;
            } else if (Array.isArray(value)) {
              // Convert arrays to comma-separated strings
              metadata[key] = value.join(',');
            } else if (typeof value === 'string' ||
                      typeof value === 'number' ||
                      typeof value === 'boolean') {
              // Directly use primitive types that ChromaDB supports
              metadata[key] = value;
            } else if (typeof value === 'object') {
              // Stringify objects for storage
              try {
                metadata[key] = JSON.stringify(value);
              } catch {
                // If JSON.stringify fails, use String() as fallback
                console.warn(`Could not stringify metadata value for key ${key}`, value);
                metadata[key] = String(value);
              }
            } else {
              // Fallback for any other types
              metadata[key] = String(value);
            }
          });
        }

        return metadata;
      });

      await collection.add({
        ids: documents.map((_, i) => `doc_${i}_${Date.now()}`),
        embeddings,
        documents: texts,
        metadatas
      });
    } catch (error) {
      // Mark ChromaDB as unavailable and log warning
      this.chromaAvailable = false;
      console.warn('ChromaDB unavailable - skipping document indexing:', error instanceof Error ? error.message : String(error));
    }
  }

  async semanticSearch(query: string, collectionName: string, k = 5): Promise<SearchResult[]> {
    // Return empty results if ChromaDB is unavailable
    if (!this.chromaAvailable) {
      return [];
    }
    try {
      await this.createCollectionIfNotExists(collectionName);
      const collection = await this.chroma.getCollection({ name: collectionName });
      const queryEmbedding = await this.embeddings.embedQuery(query);

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: k,
      });

      if (!results.ids?.[0]?.length) {
        return [];
      }

      return results.ids[0].map((_id: string, index: number) => {
        const document = results.documents?.[0]?.[index] || '';
        const metadata = (results.metadatas?.[0]?.[index] || {}) as DocumentMetadata;
        const distance = results.distances?.[0]?.[index] ?? 0;

        // Ensure tags is always an array of strings
        const processedMetadata: DocumentMetadata = {
          ...metadata,
          tags: typeof metadata.tags === 'string'
            ? metadata.tags.split(',').map(tag => tag.trim())
            : Array.isArray(metadata.tags)
              ? metadata.tags
              : [],
        };

        return {
          content: document,
          metadata: processedMetadata,
          score: 1 - distance, // distance is now guaranteed to be a number
        };
      });
    } catch (error) {
      this.chromaAvailable = false;
      console.warn('ChromaDB unavailable - returning empty search results');
      return [];
    }
  }

  async keywordSearch(
    query: string,
    collection: string,
    limit = 5
  ): Promise<SearchResult[]> {
    if (!this.chromaAvailable) {
      return [];
    }
    try {
      // Get the collection
      const col = await this.chroma.getCollection({ name: collection });
      
      // Get all documents for keyword search (this is a simplified approach)
      const result = await col.get() as ChromaGetResult;
      const documents = result.documents?.filter((doc): doc is string => doc !== null) || [];
      const metadatas = result.metadatas || [];
      const distances = result.distances?.[0] || [];
      
      // Simple keyword matching (for production, consider a proper search engine)
      const queryTerms = query.toLowerCase().split(/\s+/);
      
      const results = documents.map((doc: string, index: number) => {
        const content = doc || '';
        const metadata = (metadatas?.[index] || {}) as DocumentMetadata;
        const distance = Array.isArray(distances) && typeof distances[index] === 'number' 
          ? distances[index] 
          : 0;
        
        // Simple keyword matching score
        const contentLower = content.toLowerCase();
        const keywordScore = queryTerms.reduce((score, term) => 
          contentLower.includes(term) ? score + 1 : score, 0);
        
        return {
          content,
          metadata,
          score: keywordScore / Math.max(1, queryTerms.length) * (1 - distance * 0.5)
        };
      });
      
      // Sort by score and limit results
      return results
        .filter((result: SearchResult) => result.score > 0)
        .sort((a: SearchResult, b: SearchResult) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      this.chromaAvailable = false;
      console.warn('ChromaDB unavailable - returning empty keyword search results');
      return [];
    }
  }

  async hybridSearch(
    query: string,
    collection: string,
    keywords: string[] = [],
    limit = 5
  ): Promise<SearchResult[]> {
    if (!this.chromaAvailable) {
      return [];
    }
    try {
      const [semanticResults, keywordResults] = await Promise.all([
        this.semanticSearch(query, collection, limit * 2), // Get more results to have better candidates
        keywords.length > 0 
          ? this.keywordSearch(keywords.join(' '), collection, limit * 2)
          : Promise.resolve([] as SearchResult[])
      ]);

      // Create a map to store the best score for each unique document
      const resultsMap = new Map<string, SearchResult>();
      
      // Helper function to add results to the map
      const addToMap = (results: SearchResult[]) => {
        results.forEach(result => {
          // Create a unique ID based on content or metadata ID
          const id = typeof result.metadata.id === 'string' 
            ? result.metadata.id 
            : result.content.substring(0, 100);
            
          const existing = resultsMap.get(id);
          
          if (!existing || result.score > existing.score) {
            resultsMap.set(id, { ...result });
          }
        });
      };
      
      // Add both semantic and keyword results to the map
      addToMap(semanticResults);
      addToMap(keywordResults);
      
      // Convert map back to array, sort by score, and limit results
      return Array.from(resultsMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      this.chromaAvailable = false;
      console.warn('ChromaDB unavailable - returning empty hybrid search results');
      return [];
    }
  }

  async createCollection(
    name: string,
    metadata: Record<string, string | number | boolean | null> = {}
  ): Promise<boolean> {
    if (!this.chromaAvailable) {
      return false;
    }
    try {
      await this.chroma.createCollection({
        name,
        metadata: {
          created_at: new Date().toISOString(),
          ...metadata,
        },
      });
      return true;
    } catch (error) {
      this.chromaAvailable = false;
      console.warn(`ChromaDB unavailable - cannot create collection ${name}`);
      return false;
    }
  }

  async deleteCollection(collectionName: string): Promise<void> {
    if (!this.chromaAvailable) {
      return;
    }
    try {
      await this.chroma.deleteCollection({ name: collectionName });
    } catch (error) {
      this.chromaAvailable = false;
      console.warn('ChromaDB unavailable - cannot delete collection');
    }
  }

  async listCollections(): Promise<{ name: string; id: string; metadata: Record<string, unknown> }[]> {
    try {
      const collections = await this.chroma.listCollections();
      return collections.map((collection: { name: string; id: string; metadata?: Record<string, unknown> }) => ({
        name: collection.name,
        id: collection.id,
        metadata: collection.metadata || {}
      }));
    } catch (_error) {
      // Suppress console output in production; return empty list on failure
      return [];
    }
  }
}
