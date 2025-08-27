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

  /**
   * Perform a vector search using vector embeddings
   */
  async vectorSearch(_vector: number[], _options?: VectorSearchOptions): Promise<VectorSearchResults> {
    return {} as VectorSearchResults;
  }

  /**
   * Suggest completions for a partial search term
   */
  async suggest(_searchText: string, _suggesterName: string, _options?: SuggestOptions): Promise<SuggestResults> {
    return {} as SuggestResults;
  }

  /**
   * Autocomplete a partial search term
   */
  async autocomplete(_searchText: string, _suggesterName: string, _options?: AutocompleteOptions): Promise<AutocompleteResults> {
    return {} as AutocompleteResults;
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

  /**
   * Update an index
   */
  async updateIndex(_index: SearchIndex): Promise<SearchIndex> {
    return {} as SearchIndex;
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
  semanticRanker?: 'simple' | 'advanced';
  queryLanguage?: string;
  semanticConfiguration?: string;
  speller?: 'lexicon' | 'none';
}

/**
 * Vector search options
 */
export interface VectorSearchOptions {
  vector: number[];
  fields: string[];
  kind: 'vector';
  k: number;
  filter?: string;
  includeTotalCount?: boolean;
  select?: string[];
  minScore?: number;
}

/**
 * Vector search results
 */
export interface VectorSearchResults {
  count?: number;
  coverage?: number;
  results: AsyncIterable<VectorSearchResult>;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  score?: number;
  vectorScore?: number;
  document: SearchDocument;
}

/**
 * Suggest options
 */
export interface SuggestOptions {
  select?: string[];
  filter?: string;
  top?: number;
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  fuzzy?: boolean;
  searchFields?: string[];
}

/**
 * Suggest results
 */
export interface SuggestResults {
  coverage?: number;
  results: SuggestResult[];
}

/**
 * Suggest result
 */
export interface SuggestResult {
  text: string;
  highlights?: string;
  document: SearchDocument;
}

/**
 * Autocomplete options
 */
export interface AutocompleteOptions {
  filter?: string;
  top?: number;
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  fuzzy?: boolean;
  searchFields?: string[];
  mode?: 'oneTerm' | 'twoTerms' | 'oneTermWithContext';
  autocompleteMode?: 'oneTerm' | 'twoTerms' | 'oneTermWithContext';
}

/**
 * Autocomplete results
 */
export interface AutocompleteResults {
  coverage?: number;
  results: AutocompleteItem[];
}

/**
 * Autocomplete item
 */
export interface AutocompleteItem {
  text: string;
  queryPlusText: string;
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
  semanticScores?: SemanticScores;
  rerankerScores?: RerankerScores;
}

/**
 * Semantic scores
 */
export interface SemanticScores {
  score: number;
  answer?: SemanticAnswer;
}

/**
 * Semantic answer
 */
export interface SemanticAnswer {
  text: string;
  highlights: string;
  confidenceScore: number;
}

/**
 * Reranker scores
 */
export interface RerankerScores {
  relevanceScore: number;
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

/**
 * Scoring profile for customizing result scoring
 */
export interface ScoringProfile {
  name: string;
  text?: TextWeights;
  functions?: ScoringFunction[];
  functionAggregation?: 'sum' | 'average' | 'minimum' | 'maximum' | 'firstMatching';
}

/**
 * Text weights for scoring
 */
export interface TextWeights {
  weights: Record<string, number>;
}

/**
 * Scoring function
 */
export interface ScoringFunction {
  type: 'magnitude' | 'distance' | 'freshness' | 'tag';
  fieldName: string;
  boost: number;
  parameters?: Record<string, any>;
  interpolation?: 'linear' | 'constant' | 'quadratic' | 'logarithmic';
}

/**
 * CORS options
 */
export interface CorsOptions {
  allowedOrigins: string[];
  maxAgeInSeconds?: number;
}

/**
 * Suggester configuration
 */
export interface Suggester {
  name: string;
  sourceFields: string[];
  searchMode?: 'analyzingInfixMatching';
}

/**
 * Custom analyzer
 */
export interface Analyzer {
  name: string;
  '@odata.type': '#Microsoft.Azure.Search.CustomAnalyzer' | '#Microsoft.Azure.Search.PatternAnalyzer';
  tokenizer: string;
  tokenFilters?: string[];
  charFilters?: string[];
  pattern?: string;
  flags?: string;
  lowercase?: boolean;
  stopwords?: string[];
}

/**
 * Custom tokenizer
 */
export interface Tokenizer {
  name: string;
  '@odata.type': string;
  [key: string]: any;
}

/**
 * Token filter
 */
export interface TokenFilter {
  name: string;
  '@odata.type': string;
  [key: string]: any;
}

/**
 * Character filter
 */
export interface CharFilter {
  name: string;
  '@odata.type': string;
  [key: string]: any;
}

/**
 * Encryption key
 */
export interface EncryptionKey {
  keyVaultKeyName: string;
  keyVaultKeyVersion: string;
  keyVaultUri: string;
  accessCredentials?: Record<string, any>;
}

/**
 * Similarity configuration
 */
export interface Similarity {
  '@odata.type': '#Microsoft.Azure.Search.BM25Similarity';
  k1?: number;
  b?: number;
}

/**
 * Semantic configuration
 */
export interface SemanticConfiguration {
  configurations: SemanticConfigurationDetail[];
}

/**
 * Semantic configuration detail
 */
export interface SemanticConfigurationDetail {
  name: string;
  prioritizedFields: {
    titleField?: SemanticField;
    prioritizedContentFields?: SemanticField[];
    prioritizedKeywordsFields?: SemanticField[];
  };
}

/**
 * Semantic field
 */
export interface SemanticField {
  fieldName: string;
}

/**
 * Vector search configuration
 */
export interface VectorSearchConfiguration {
  profiles?: VectorSearchProfile[];
  algorithms?: VectorSearchAlgorithmConfiguration[];
}

/**
 * Vector search profile
 */
export interface VectorSearchProfile {
  name: string;
  algorithmConfigurationName: string;
}

/**
 * Vector search algorithm configuration
 */
export interface VectorSearchAlgorithmConfiguration {
  name: string;
  kind: 'hnsw' | 'exhaustiveKnn';
  parameters?: HnswParameters | ExhaustiveKnnParameters;
}

/**
 * HNSW algorithm parameters
 */
export interface HnswParameters {
  m?: number;
  efConstruction?: number;
  efSearch?: number;
  metric?: 'cosine' | 'dotProduct' | 'euclidean';
}

/**
 * Exhaustive KNN algorithm parameters
 */
export interface ExhaustiveKnnParameters {
  metric?: 'cosine' | 'dotProduct' | 'euclidean';
}