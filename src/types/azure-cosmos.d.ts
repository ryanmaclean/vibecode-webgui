/**
 * Type declarations for Azure Cosmos DB SDK
 * Provides types and interfaces for the @azure/cosmos package
 */

// ===== Main export classes =====
export class CosmosClient {
  constructor(connectionString: string, options?: ConnectionPolicy);
  constructor(endpoint: string, key: string, options?: ConnectionPolicy);
  
  /**
   * Get database instance
   */
  database(id: string): Database;
  
  /**
   * Create a new database
   */
  databases: {
    create(options: DatabaseCreateOptions): Promise<DatabaseResponse>;
    createIfNotExists(options: DatabaseCreateOptions): Promise<DatabaseResponse>;
    readAll(): Promise<DatabaseResponse[]>;
    query(query: string | SqlQuerySpec, options?: FeedOptions): QueryIterator<DatabaseDefinition>;
  };
}

// ===== Database =====
export interface DatabaseCreateOptions {
  id: string;
  throughput?: number;
}

export interface DatabaseDefinition {
  id: string;
}

export interface DatabaseResponse {
  resource: DatabaseDefinition;
  database: Database;
  statusCode: number;
}

export class Database {
  /**
   * Get container instance
   */
  container(id: string): Container;
  
  /**
   * Create a new container
   */
  containers: {
    create(options: ContainerCreateOptions): Promise<ContainerResponse>;
    createIfNotExists(options: ContainerCreateOptions): Promise<ContainerResponse>;
    readAll(): Promise<ContainerResponse[]>;
    query(query: string | SqlQuerySpec, options?: FeedOptions): QueryIterator<ContainerDefinition>;
  };
}

// ===== Container =====
export interface ContainerCreateOptions {
  id: string;
  partitionKey: PartitionKeyDefinition;
  indexingPolicy?: IndexingPolicy;
  throughput?: number;
  uniqueKeyPolicy?: UniqueKeyPolicy;
}

export interface PartitionKeyDefinition {
  paths: string[];
  kind?: "Hash" | "Range";
  version?: 1 | 2;
}

export interface IndexingPolicy {
  automatic?: boolean;
  indexingMode?: "consistent" | "lazy" | "none";
  includedPaths?: {
    path: string;
    indexes?: {
      kind: "Hash" | "Range" | "Spatial";
      dataType: "String" | "Number" | "Point" | "Polygon" | "LineString";
      precision?: number;
    }[];
  }[];
  excludedPaths?: { path: string }[];
}

export interface UniqueKeyPolicy {
  uniqueKeys: { paths: string[] }[];
}

export interface ContainerDefinition {
  id: string;
  partitionKey: PartitionKeyDefinition;
  indexingPolicy?: IndexingPolicy;
}

export interface ContainerResponse {
  resource: ContainerDefinition;
  container: Container;
  statusCode: number;
}

export class Container {
  /**
   * Create or replace an item
   */
  items: {
    create<T>(item: T, options?: ItemRequestOptions): Promise<ItemResponse<T>>;
    upsert<T>(item: T, options?: ItemRequestOptions): Promise<ItemResponse<T>>;
    read<T>(id: string, partitionKey: string | number, options?: ItemRequestOptions): Promise<ItemResponse<T>>;
    delete<T>(id: string, partitionKey: string | number, options?: ItemRequestOptions): Promise<ItemResponse<T>>;
    query<T>(query: string | SqlQuerySpec, options?: FeedOptions): QueryIterator<T>;
  };
  
  /**
   * Execute a stored procedure
   */
  storedProcedures: {
    create(options: StoredProcedureCreateOptions): Promise<StoredProcedureResponse>;
    execute<T>(id: string, partitionKey: string | number, parameters?: any[]): Promise<StoredProcedureExecuteResponse<T>>;
  };
}

// ===== Item Operations =====
export interface ItemRequestOptions {
  partitionKey?: string | number;
  ifMatch?: string;
  ifNoneMatch?: string;
}

export interface ItemResponse<T> {
  resource: T;
  statusCode: number;
  activityId?: string;
  etag?: string;
}

// ===== Stored Procedures =====
export interface StoredProcedureCreateOptions {
  id: string;
  body: string;
}

export interface StoredProcedureResponse {
  body: string;
  id: string;
  statusCode: number;
}

export interface StoredProcedureExecuteResponse<T> {
  resource: T;
  statusCode: number;
  scriptLog: string;
}

// ===== Query Operations =====
export interface SqlQuerySpec {
  query: string;
  parameters?: {
    name: string;
    value: any;
  }[];
}

export interface FeedOptions {
  maxItemCount?: number;
  continuation?: string;
  enableCrossPartitionQuery?: boolean;
  partitionKey?: string | number;
  populateQueryMetrics?: boolean;
}

export class QueryIterator<T> {
  /**
   * Execute the query and return all results
   */
  fetchAll(): Promise<T[]>;
  
  /**
   * Execute the query and return the current batch of results
   */
  executeNext(): Promise<T[]>;
  
  /**
   * Get if there are more results
   */
  hasMoreResults(): boolean;
}

// ===== Connection Options =====
export interface ConnectionPolicy {
  endpoint?: string;
  key?: string;
  connectionString?: string;
  consistencyLevel?: "Strong" | "BoundedStaleness" | "Session" | "Eventual" | "ConsistentPrefix";
  requestTimeout?: number;
  enableEndpointDiscovery?: boolean;
  preferredLocations?: string[];
  retryOptions?: {
    maxRetryAttemptCount?: number;
    fixedRetryIntervalInMilliseconds?: number;
    maxWaitTimeInSeconds?: number;
  };
}