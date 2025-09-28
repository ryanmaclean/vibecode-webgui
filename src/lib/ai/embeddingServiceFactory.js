/**
 * CommonJS wrapper for EmbeddingServiceFactory for testing
 * This file allows importing the TypeScript implementation from non-TypeScript environments
 */

// Re-export the TypeScript implementation without creating a circular import
export { EmbeddingServiceFactory, EmbeddingProvider } from './embeddingServiceFactory.ts';
