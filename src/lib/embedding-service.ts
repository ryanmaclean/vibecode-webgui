/**
 * Embedding Service
 * Wrapper module that exports from the main implementation in src/lib/ai/
 * Provides interfaces and implementations for generating text embeddings
 */

// Re-export everything from the main implementation
// Use 'export type' for interfaces/types to satisfy isolatedModules
export type { EmbeddingService, EmbeddingServiceConfig } from './ai/embedding-service';
export {
  EmbeddingServiceFactory,
  BaseEmbeddingService,
  MockEmbeddingService
} from './ai/embedding-service';
