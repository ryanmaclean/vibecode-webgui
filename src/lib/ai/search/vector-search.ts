import { ChromaClient } from 'chroma-js';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';

type SearchResult = {
  content: string;
  metadata: Record<string, any>;
  score: number;
};

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

  async semanticSearch(
    query: string, 
    collection: string, 
    limit = 5
  ): Promise<SearchResult[]> {
    try {
      const queryEmbedding = await this.embeddings.embedQuery(query);
      
      const results = await this.chroma.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where: { collection },
      });

      return results.map(result => ({
        content: result.document,
        metadata: result.metadata || {},
        score: result.distance || 0,
      }));
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
      // Implement basic keyword search logic
      // This is a simplified example - you might want to use a proper search engine
      const results = await this.chroma.query({
        queryTexts: [query],
        nResults: limit,
        where: { 
          collection,
          // Add any additional filters for keyword search
        },
      });

      return results.map(result => ({
        content: result.document,
        metadata: result.metadata || {},
        score: result.distance || 0,
      }));
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
        this.semanticSearch(query, collection, limit),
        keywords.length > 0 
          ? this.keywordSearch(keywords.join(' '), collection, limit)
          : Promise.resolve([] as SearchResult[])
      ]);

      // Merge and deduplicate results
      const merged = [...semanticResults, ...keywordResults]
        .reduce((acc: SearchResult[], current) => {
          const existing = acc.find(item => 
            item.metadata.id === current.metadata.id
          );
          if (!existing) {
            acc.push(current);
          } else {
            // If the same result appears in both searches, boost its score
            existing.score = Math.max(existing.score, current.score) * 1.2;
          }
          return acc;
        }, [])
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return merged;
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
      return false;
    }
  }

  async deleteCollection(name: string) {
    try {
      await this.chroma.deleteCollection({ name });
      return true;
    } catch (error) {
      console.error(`Error deleting collection ${name}:`, error);
      return false;
    }
  }

  async listCollections() {
    try {
      return await this.chroma.listCollections();
    } catch (error) {
      console.error('Error listing collections:', error);
      return [];
    }
  }
}
