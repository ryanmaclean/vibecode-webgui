import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { azureEmbeddingService } from '@/lib/ai/azureEmbeddingService';
import { EmbeddingService } from '@/lib/ai/embeddingService';
import { EmbeddingServiceFactory, EmbeddingServiceType } from '@/lib/ai/embeddingServiceFactory';
import { DatadogIntegration } from '@/lib/monitoring/datadog-integration';
import { PrismaClient } from '@prisma/client';
// import { logger } from '@/lib/logger';
// Global service instance for monitoring
let embeddingService: EmbeddingServiceType | null = null;
let serviceReleaseFunction: (() => Promise<void>) | null = null;

async function getEmbeddingService(): Promise<EmbeddingServiceType> {
  if (!embeddingService) {
    try {
      const service = await EmbeddingServiceFactory.createEmbeddingService();
      embeddingService = service;
      
    } catch (error) {
      console.error('Failed to create embedding service:', error);
      throw new Error('Embedding service not available');
    }
  }
  return embeddingService;
}

// Clean up function for graceful shutdown

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ 
      status: 'healthy',
      message: 'Embeddings monitoring endpoint is working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
