/**
 * Secure AI query API endpoint with comprehensive input validation
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { ai } from '../../../lib/ai';
import { validateAIQuery, AISecurityLogger } from '../../../lib/security/input-validator';
import { aiAnalytics } from '../../../lib/ai/analytics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authentication check
    const token = await getToken({ req });
    const userId = token?.sub || 'anonymous';
    
    // Log the request attempt
    AISecurityLogger.logSuspiciousActivity(userId, 'AI_QUERY_REQUEST', {
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      bodySize: JSON.stringify(req.body).length
    });

    // Input validation
    const validatedInput = validateAIQuery(req.body);

    // Perform secure AI query
    const results = await ai.secureQuery(validatedInput, userId);

    // Track successful query
    if (aiAnalytics) {
      aiAnalytics.logEvent('api_secure_query_success', {
        userId,
        queryLength: validatedInput.query.length,
        resultsCount: Array.isArray(results) ? results.length : 0
      });
    }

    res.status(200).json({
      success: true,
      results,
      metadata: {
        queryLength: validatedInput.query.length,
        resultsCount: Array.isArray(results) ? results.length : 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log security-related errors
    AISecurityLogger.logValidationFailure(
      'unknown',
      JSON.stringify(req.body),
      errorMessage
    );

    // Track failed query
    if (aiAnalytics) {
      aiAnalytics.trackError(error instanceof Error ? error : new Error(errorMessage));
    }

    // Don't expose internal error details to prevent information leakage
    if (errorMessage.includes('Rate limit exceeded')) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: '3600' // 1 hour
      });
    }

    if (errorMessage.includes('Invalid') || errorMessage.includes('unsafe')) {
      return res.status(400).json({ 
        error: 'Invalid input format' 
      });
    }

    console.error('AI Query API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
}