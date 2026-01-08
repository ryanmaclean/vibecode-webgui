/**
 * Embedding Service
 * Wrapper module that exports from the main implementation in src/lib/ai/
 * Provides interfaces and implementations for generating text embeddings
 */

// Re-export everything from the main implementation
export {
  EmbeddingService,
  EmbeddingServiceConfig,
  EmbeddingServiceFactory,
  BaseEmbeddingService,
  MockEmbeddingService
} from './ai/embedding-service';
