/**
 * RAG Document Ingestion API
 * POST /api/rag/ingest
 */

import { NextRequest, NextResponse } from 'next/server';
import { ragSystem } from '@/lib/rag';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documents } = body;

    if (!documents || !Array.isArray(documents)) {
      return NextResponse.json(
        { error: 'Invalid request: documents array required' },
        { status: 400 }
      );
    }

    // Initialize RAG system if needed
    await ragSystem.initialize();

    // Ingest documents
    const ids = await ragSystem.ingestBatch(documents);

    logger.info('Documents ingested via API', { count: ids.length });

    return NextResponse.json({
      success: true,
      count: ids.length,
      ids
    });
  } catch (error) {
    logger.error('Ingestion API error', { error });
    return NextResponse.json(
      { error: 'Failed to ingest documents' },
      { status: 500 }
    );
  }
}
