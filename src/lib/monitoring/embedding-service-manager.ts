/**
 * Embedding Service Manager
 * Manages global embedding service instance and cleanup
 */

import { EmbeddingServiceFactory, EmbeddingServiceType } from '@/lib/ai/embeddingServiceFactory';
import { logger } from '@/lib/logger';
// Global service instance for monitoring
let embeddingService: EmbeddingServiceType | null = null;
let serviceReleaseFunction: (() => Promise<void>) | null = null;

export async function getEmbeddingService(): Promise<EmbeddingServiceType> {
  if (!embeddingService) {
    try {
      const { service, releaseConnection } = await EmbeddingServiceFactory.createEmbeddingServiceWithRobustConnection();
      embeddingService = service;
      serviceReleaseFunction = releaseConnection;
    } catch (error) {
      logger.error('Failed to create embedding service:', error);
      throw new Error('Embedding service not available');
    }
  }
  return embeddingService;
}

// Clean up function for graceful shutdown
export async function cleanup() {
  if (serviceReleaseFunction) {
    await serviceReleaseFunction();
    serviceReleaseFunction = null;
  }
  embeddingService = null;
}