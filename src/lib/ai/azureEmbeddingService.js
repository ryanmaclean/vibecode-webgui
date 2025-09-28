/**
 * CommonJS wrapper for AzureEmbeddingService for testing
 * This file allows importing the TypeScript implementation from non-TypeScript environments
 */

// Re-export the TypeScript implementation without creating a circular import
export { AzureEmbeddingService } from './azureEmbeddingService.ts';
