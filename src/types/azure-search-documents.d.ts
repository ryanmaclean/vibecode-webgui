/**
 * Type declarations for Azure Search Documents SDK
 * Provides types and interfaces for the @azure/search-documents package
 */

// ===== Basic credential class =====
export class AzureKeyCredential {
  constructor(key: string);
  private key: string;
  getKey(): string;
}

// ===== Data types =====
export enum SearchFieldDataType {
  String = 'Edm.String',
  Int32 = 'Edm.Int32',
  Int64 = 'Edm.Int64',
  Double = 'Edm.Double',
  Boolean = 'Edm.Boolean',
  DateTimeOffset = 'Edm.DateTimeOffset',
  GeographyPoint = 'Edm.GeographyPoint',
  Complex = 'Edm.ComplexType',
  Collection = (type: SearchFieldDataType) => `Collection(${type})`
}

// ===== Search Field =====
export interface SearchFieldOptions {
  name: string;
  type: SearchFieldDataType;
  key?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  hidden?: boolean;
  dimensions?: number;
  vectorSearchProfile?: string;
}

export class SearchField {
  constructor(options: SearchFieldOptions);
  name: string;
  type: SearchFieldDataType;
  key?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  hidden?: boolean;
  dimensions?: number;
  vectorSearchProfile?: string;
}

// ===== Vector Search =====
export interface VectorSearchOptions {
  profiles: Array<{
    name: string;
    algorithmConfiguration: string;
    vectorizer?: string;
  }>;
  algorithms: Array<{
    name: string;
    kind: string;
    parameters: Record<string, any>;
  }>;
}

export class VectorSearch {
  constructor(options: VectorSearchOptions);
  profiles: Array<{
    name: string;
    algorithmConfiguration: string;
    vectorizer?: string;
  }>;
  algorithms: Array<{
    name: string;
    kind: string;
    parameters: Record<string, any>;
  }>;
}

// ===== Semantic Search =====
export interface SemanticSearchOptions {
  configurations: Array<{
    name: string;
    prioritizedFields: {
      titleField?: { fieldName: string };
      contentFields?: Array<{ fieldName: string }>;
      keywordsFields?: Array<{ fieldName: string }>;
    };
  }>;
}

// ===== Search Index =====
export interface SearchIndexOptions {
  name: string;
  fields: SearchField[];
  vectorSearch?: VectorSearch;
  semanticSearch?: SemanticSearchOptions;
}

export class SearchIndex {
  constructor(options: SearchIndexOptions);
  name: string;
  fields: SearchField[];
  vectorSearch?: VectorSearch;
  semanticSearch?: SemanticSearchOptions;
}

// ===== Search Query Options =====
export interface SearchOptions {
  filter?: string;
  select?: string[];
  top?: number;
  skip?: number;
  orderBy?: string[];
  highlightFields?: string[];
  scoringProfile?: string;
  scoringParameters?: Record<string, any>;
  includeTotalCount?: boolean;
  queryType?: 'simple' | 'full' | 'semantic';
  searchMode?: 'any' | 'all';
  searchFields?: string[];
  vectorQueries?: Array<{
    vector: number[];
    fields: string[];
    kind: 'vector';
    k: number;
  }>;
  facets?: string[];
  semanticConfiguration?: string;
  queryLanguage?: string;
}

// ===== Search Results =====
export interface SearchDocument {
  [key: string]: any;
}

export interface SearchResult {
  score: number;
  document: SearchDocument;
  highlights?: Record<string, string[]>;
}

export interface SearchResults {
  count?: number;
  facets?: Record<string, Record<string, number>>;
  results: AsyncIterable<SearchResult>;
}

// ===== Document Operations Results =====
export interface IndexDocumentsResult {
  key: string;
  status: boolean;
  errorMessage?: string;
  statusCode: number;
}

export interface IndexDocumentsBatchResult {
  results: IndexDocumentsResult[];
}

// ===== Search Client =====
export class SearchClient {
  constructor(endpoint: string, indexName: string, credential: AzureKeyCredential, options?: any);
  
  readonly indexName: string;
  
  /**
   * Searches for documents in the Azure Cognitive Search index
   */
  search(searchText: string | null, options?: SearchOptions): Promise<SearchResults>;
  
  /**
   * Gets the count of documents in the index
   */
  getDocumentCount(): Promise<number>;
  
  /**
   * Retrieves a document from the index by key
   */
  getDocument<T extends SearchDocument>(key: string, options?: { select?: string[] }): Promise<T>;
  
  /**
   * Uploads documents to the index
   */
  uploadDocuments(documents: SearchDocument[]): Promise<IndexDocumentsBatchResult>;
  
  /**
   * Merges or uploads documents to the index
   */
  mergeOrUploadDocuments(documents: SearchDocument[]): Promise<IndexDocumentsBatchResult>;
  
  /**
   * Merges documents in the index
   */
  mergeDocuments(documents: SearchDocument[]): Promise<IndexDocumentsBatchResult>;
  
  /**
   * Deletes documents from the index
   */
  deleteDocuments(documents: SearchDocument[] | { key: string }[]): Promise<IndexDocumentsBatchResult>;
}

// ===== Search Index Client =====
export class SearchIndexClient {
  constructor(endpoint: string, credential: AzureKeyCredential, options?: any);
  
  /**
   * Lists all indexes in the search service
   */
  listIndexes(): Promise<AsyncIterable<SearchIndex>>;
  
  /**
   * Creates a new index
   */
  createIndex(index: SearchIndex): Promise<SearchIndex>;
  
  /**
   * Gets an index by name
   */
  getIndex(indexName: string): Promise<SearchIndex>;
  
  /**
   * Deletes an index
   */
  deleteIndex(indexName: string): Promise<void>;
  
  /**
   * Creates a search client for a specific index
   */
  getSearchClient(indexName: string): SearchClient;
}