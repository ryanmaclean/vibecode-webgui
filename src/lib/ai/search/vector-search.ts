import { ChromaClient, type GetResult, type Metadata } from 'chromadb';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { Document } from 'langchain/document';

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

  constructor() {
    this.chroma = new ChromaClient({
      path: process.env.CHROMA_DB_URL || 'http://localhost:8000'
    });
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  private async createCollectionIfNotExists(collectionName: string): Promise<void> {
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
      console.error('Error creating collection:', error);
      throw error instanceof Error ? error : new Error('Failed to create collection');
    }
  }

  async addDocuments(documents: Document[], collectionName: string): Promise<void> {
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
              } catch (_) {
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
      console.error('Error adding documents:', error);
      throw new Error('Failed to add documents to vector store');
    }
  }

  async semanticSearch(query: string, collectionName: string, k = 5): Promise<SearchResult[]> {
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
      console.error('Error in semantic search:', error);
      throw new Error('Failed to perform semantic search');
    }
  }

  async keywordSearch(
    query: string, 
    collection: string, 
    limit = 5
  ): Promise<SearchResult[]> {
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
      console.error('Error in keyword search:', error);
      throw new Error('Failed to perform keyword search');
    }
  }

  async hybridSearch(
    query: string, 
    collection: string, 
    keywords: string[] = [], 
    limit = 5
  ): Promise<SearchResult[]> {
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
      console.error('Error in hybrid search:', error);
      throw new Error('Failed to perform hybrid search');
    }
  }

  async createCollection(name: string, metadata: Record<string, any> = {}) {
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
      console.error(`Error creating collection ${name}:`, error);
      throw error instanceof Error ? error : new Error('Failed to create collection');
    }
  }

  async deleteCollection(collectionName: string): Promise<void> {
    try {
      await this.chroma.deleteCollection({ name: collectionName });
    } catch (error) {
      console.error('Error deleting collection:', error);
      throw new Error('Failed to delete collection');
    }
  }

  async listCollections(): Promise<Array<{name: string; id: string; metadata: Record<string, unknown>}>> {
    try {
      const collections = await this.chroma.listCollections();
      return collections.map((collection: { name: string; id: string; metadata?: Record<string, unknown> }) => ({
        name: collection.name,
        id: collection.id,
        metadata: collection.metadata || {}
      }));
    } catch (error) {
      console.error('Error listing collections:', error);
      return [];
    }
  }
}
