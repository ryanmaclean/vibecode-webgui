declare module 'weaviate-ts-client' {
  // Minimal typings for weaviate-ts-client
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
    schema?: any
    batch(): { objectsBatcher(): any }
    data?: any
  }

  const _default: {
    client(opts: WeaviateClientOptions): WeaviateClient
  }

  export default _default
}
