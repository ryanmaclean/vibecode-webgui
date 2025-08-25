/**
 * Type definitions for Azure Cognitive Search API
 * These types are adapted from the @azure/search-documents package
 */

/**
 * AzureKeyCredential for authentication with API key
 */
export class AzureKeyCredential {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  getKey(): string {
    return this.key;
  }
}

/**
 * Search client for interacting with Azure Cognitive Search indexes
 */
export class SearchClient {
  constructor(_endpoint: string, _indexName: string, _credential: AzureKeyCredential) {
    // Implementation provided by Azure SDK
  }

  /**
   * Search for documents
   */
  async search(_searchText: string | null, _options?: SearchOptions): Promise<SearchResults> {
    return {} as SearchResults;
  }

  /**
   * Upload documents to the index
   */
  async uploadDocuments(_documents: SearchDocument[]): Promise<IndexDocumentsResult> {
    return {} as IndexDocumentsResult;
  }

  /**
   * Delete documents from the index
   */
  async deleteDocuments(_documents: Pick<SearchDocument, 'id'>[]): Promise<IndexDocumentsResult> {
    return {} as IndexDocumentsResult;
  }

  /**
   * Get document count in the index
   */
  async getDocumentCount(): Promise<number> {
    return 0;
  }
}

/**
 * Search index client for managing search indexes
 */
export class SearchIndexClient {
  constructor(_endpoint: string, _credential: AzureKeyCredential) {
    // Implementation provided by Azure SDK
  }

  /**
   * List search indexes
   */
  async listIndexes(): Promise<AsyncIterable<SearchIndex>> {
    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            return { done: true, value: undefined };
          }
        };
      }
    };
  }

  /**
   * Get a search index by name
   */
  async getIndex(_indexName: string): Promise<SearchIndex> {
    return {} as SearchIndex;
  }

  /**
   * Create a search index
   */
  async createIndex(_index: SearchIndex): Promise<SearchIndex> {
    return {} as SearchIndex;
  }

  /**
   * Delete a search index
   */
  async deleteIndex(_indexName: string): Promise<void> {
    // Implementation provided by Azure SDK
  }
}

/**
 * Search options for querying documents
 */
export interface SearchOptions {
  select?: string[];
  searchFields?: string[];
  filter?: string;
  facets?: string[];
  top?: number;
  skip?: number;
  orderBy?: string[];
  highlight?: string[];
  highlightPreTag?: string;
  highlightPostTag?: string;
  scoringProfile?: string;
  scoringParameters?: string[];
  minimumCoverage?: number;
  queryType?: 'simple' | 'full';
  searchMode?: 'any' | 'all';
  includeTotalCount?: boolean;
  vectorQueries?: {
    vector: number[];
    fields: string[];
    kind: 'vector';
    k: number;
  }[];
}

/**
 * Search results
 */
export interface SearchResults {
  count?: number;
  coverage?: number;
  facets?: Record<string, Record<string, number>>;
  results: AsyncIterable<SearchResult>;
}

/**
 * Individual search result
 */
export interface SearchResult {
  score?: number;
  highlights?: Record<string, string[]>;
  document: SearchDocument;
}

/**
 * Search document
 */
export interface SearchDocument {
  id: string;
  [key: string]: any;
}

/**
 * Search index definition
 */
export interface SearchIndex {
  name: string;
  fields: SearchField[];
  scoring?: ScoringProfile[];
  defaultScoringProfile?: string;
  corsOptions?: CorsOptions;
  suggesters?: Suggester[];
  analyzers?: Analyzer[];
  tokenizers?: Tokenizer[];
  tokenFilters?: TokenFilter[];
  charFilters?: CharFilter[];
  encryptionKey?: EncryptionKey;
  similarity?: Similarity;
  semantic?: SemanticConfiguration;
  vectorSearch?: VectorSearchConfiguration;
}

/**
 * Result of index document operations
 */
export interface IndexDocumentsResult {
  key: string;
  status: boolean;
  errorMessage?: string;
  statusCode: number;
}

/**
 * Search field definition
 */
export interface SearchField {
  name: string;
  type: 'Edm.String' | 'Edm.Int32' | 'Edm.Int64' | 'Edm.Double' | 'Edm.Boolean' | 'Edm.DateTimeOffset' | 'Edm.GeographyPoint' | 'Collection(Edm.String)' | 'Edm.ComplexType' | string;
  key?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
  analyzer?: string;
  searchAnalyzer?: string;
  indexAnalyzer?: string;
  synonymMaps?: string[];
  fields?: SearchField[];
  dimensions?: number;
  vectorSearchProfile?: string;
}

// Additional type definitions as placeholders
export interface ScoringProfile {}
export interface CorsOptions {}
export interface Suggester {}
export interface Analyzer {}
export interface Tokenizer {}
export interface TokenFilter {}
export interface CharFilter {}
export interface EncryptionKey {}
export interface Similarity {}
export interface SemanticConfiguration {}
export interface VectorSearchConfiguration {
  profiles?: VectorSearchProfile[];
  algorithms?: VectorSearchAlgorithmConfiguration[];
}

export interface VectorSearchProfile {
  name: string;
  algorithmConfigurationName: string;
}

export interface VectorSearchAlgorithmConfiguration {
  name: string;
  kind: string;
  parameters?: any;
}