import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { tracer } from '../../../lib/server-monitoring';
import NetworkDiagnostics from '../../../lib/network-diagnostics';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const span = tracer.scope().active();
  const { host = 'api.datadoghq.com', port = '443' } = req.query;

  try {
    // Verify authentication
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate input
    if (typeof host !== 'string' || typeof port !== 'string') {
      return res.status(400).json({ error: 'Invalid host or port' });
    }

    // Run connectivity test
    const connectivity = await NetworkDiagnostics.testConnectivity(host, parseInt(port, 10));
    
    // If connectivity fails, return early
    if (!connectivity.success) {
      return res.status(200).json({
        success: false,
        message: `Failed to connect to ${host}:${port}`,
        error: connectivity.error,
        connectivity
      });
    }

    // Run full trace route if connectivity is successful
    const traceResults = await NetworkDiagnostics.traceRoute(host);

    // Return results
    return res.status(200).json({
      success: true,
      host,
      port,
      connectivity,
      trace: traceResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    span?.setTag('error', true);
    span?.setTag('error.msg', errorMessage);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to run network diagnostics',
      details: errorMessage
    });
  }
}

// Add rate limiting configuration
export const config = {
  api: {
    externalResolver: true,
    responseLimit: '10mb',
  },
};
