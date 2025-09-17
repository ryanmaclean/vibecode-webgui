// Minimal ambient type declarations for Azure Cosmos SDK types used by Cosmos adapter
// This is a stub to satisfy type-check until full SDK or concrete types are integrated.

export interface SqlParameter {
  name: string;
  value: unknown;
}

export interface SqlQuerySpec {
  query: string;
  parameters?: SqlParameter[];
}

export interface Container {
  items: {
    query: (query: string | SqlQuerySpec) => {
      fetchAll: () => Promise<{ resources: unknown[] }>
    }
  };
}

export interface Database {
  container: (id: string) => Container;
  read?: () => Promise<unknown>;
}

export interface CosmosClient {
  database: (id: string) => Database;
}

export {};
