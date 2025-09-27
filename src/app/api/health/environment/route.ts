/**
 * Environment Health Check API Route
 * Provides environment validation status for monitoring and debugging
 */

import { NextRequest } from 'next/server';
import { createEnvironmentHealthHandler } from '../../../../middleware/env-validation-middleware';
import { validateDatabaseConnections } from '../../../../lib/env-validation';

const healthHandler = createEnvironmentHealthHandler();

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const includeConnections = searchParams.get('connections') === 'true';
  
  // Get basic health status
  const baseResponse = await healthHandler(req);
  const baseData = await baseResponse.json();
  
  // Add database connection tests if requested
  if (includeConnections) {
    try {
      const connectionResults = await validateDatabaseConnections();
      baseData.connections = connectionResults;
    } catch (error) {
      baseData.connections = {
        error: 'Failed to test connections',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  return new Response(JSON.stringify(baseData, null, 2), {
    status: baseResponse.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}