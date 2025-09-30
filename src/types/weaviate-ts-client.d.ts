declare module 'weaviate-ts-client' {
  // Minimal typings to satisfy dynamic import usage in vector-database-abstraction.ts
  export class ApiKey {
    constructor(key: string)
  }

  export interface WeaviateClientOptions {
    scheme?: 'http' | 'https'
    host: string
    apiKey?: ApiKey
  }

  export interface WeaviateClient {
    misc(): { liveChecker(): { do(): Promise<void> } }
    schema?: Record<string, unknown>
    batch(): { objectsBatcher(): Record<string, unknown> }
    data?: Record<string, unknown>
  }

  const _default: {
    client(opts: WeaviateClientOptions): WeaviateClient
  }

  export default _default
}
