/**
 * @description Security Monitoring API - Provides real-time security status, threat detection metrics, and administrative controls for security monitoring. Tracks blocked IPs, rate limiting, authentication status, and security events.
 * @route GET /api/monitoring/security
 * @route POST /api/monitoring/security
 * @access Private (requires admin role)
 *
 * @param {NextRequest} request - Next.js request with authentication token
 *
 * @returns {Response} GET returns comprehensive security metrics:
 *   - timestamp: string - Current timestamp
 *   - status: 'healthy' | 'warning' | 'critical' - Overall security status
 *   - checks: { authentication, rateLimit, inputValidation, cors, headers } - Security check results
 *   - stats: { blockedIPs, allowedOrigins, rateLimitedRequests, suspiciousActivities } - Security statistics
 *   - recentEvents: Array<{ timestamp, type, severity, message }> - Recent security events
 *   - recommendations: string[] - Security improvement recommendations
 *
 * @returns {Response} POST executes security actions with body:
 *   - action: 'block_ip' | 'reset_counters' | 'test_alert'
 *   - ip: string - IP address for block_ip action
 *   - reason: string - Optional reason for IP block
 *
 * @example
 * // GET Request - Security status
 * GET /api/monitoring/security
 * Headers: { Authorization: "Bearer <admin_token>" }
 *
 * // Response
 * {
 *   "timestamp": "2025-10-01T00:00:00.000Z",
 *   "status": "healthy",
 *   "checks": {
 *     "authentication": true,
 *     "rateLimit": true,
 *     "inputValidation": true
 *   },
 *   "stats": {
 *     "blockedIPs": 5,
 *     "rateLimitedRequests": 125,
 *     "suspiciousActivities": 3
 *   },
 *   "recentEvents": [...],
 *   "recommendations": ["Enable middleware rate limiting"]
 * }
 *
 * // POST Request - Block IP
 * POST /api/monitoring/security
 * {
 *   "action": "block_ip",
 *   "ip": "192.168.1.100",
 *   "reason": "Suspicious activity detected"
 * }
 *
 * // Response
 * { "success": true, "message": "IP 192.168.1.100 blocked" }
 *
 * // POST Request - Reset counters
 * POST /api/monitoring/security
 * { "action": "reset_counters" }
 *
 * // Response
 * { "success": true, "message": "Counters reset" }
 *
 * @throws {403} Forbidden - Admin access required
 * @throws {400} Invalid action - Unknown action or missing required parameters
 * @throws {500} Internal server error - Security monitoring error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSecurityStats } from '../../../../middleware/security-middleware';
import { aiRateLimiter, AISecurityLogger } from '../../../../lib/security/input-validator';

interface SecurityMetrics {
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  checks: {
    authentication: boolean;
    rateLimit: boolean;
    inputValidation: boolean;
    cors: boolean;
    headers: boolean;
  };
  stats: {
    blockedIPs: number;
    allowedOrigins: number;
    endpointCount: number;
    rateLimitedRequests: number;
    suspiciousActivities: number;
  };
  recentEvents: Array<{
    timestamp: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  }>;
  recommendations: string[];
}

// In-memory storage for security events (in production, use Redis or database)
const securityEvents: Array<{
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}> = [];

let rateLimitedRequests = 0;
let suspiciousActivities = 0;

export async function GET(request: NextRequest) {
  try {
    // Check authentication for security endpoint access
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token || token.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const securityStats = getSecurityStats();
    const currentTime = new Date().toISOString();

    // Perform security checks
    const checks = {
      authentication: !!process.env.NEXTAUTH_SECRET,
      rateLimit: process.env.MIDDLEWARE_RATE_LIMIT_ENABLED !== 'false',
      inputValidation: true, // Always enabled
      cors: true, // Configured in Next.js config
      headers: true, // Configured in Next.js config
    };

    // Calculate overall status
    const failedChecks = Object.values(checks).filter(check => !check).length;
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (failedChecks > 0) {
      status = failedChecks >= 3 ? 'critical' : 'warning';
    }

    // Generate recommendations based on failed checks
    const recommendations: string[] = [];
    
    if (!checks.authentication) {
      recommendations.push('Configure NEXTAUTH_SECRET environment variable');
    }
    
    if (!checks.rateLimit) {
      recommendations.push('Enable middleware rate limiting (set MIDDLEWARE_RATE_LIMIT_ENABLED=true and configure Redis/Valkey if needed)');
    }

    if (securityStats.blockedIPs > 100) {
      recommendations.push('Review blocked IP list - consider automated IP reputation service');
    }

    if (rateLimitedRequests > 1000) {
      recommendations.push('High rate limit violations - consider adjusting rate limits or investigating attacks');
    }

    // Get recent security events (last 100)
    const recentEvents = securityEvents
      .slice(-100)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const metrics: SecurityMetrics = {
      timestamp: currentTime,
      status,
      checks,
      stats: {
        ...securityStats,
        rateLimitedRequests,
        suspiciousActivities
      },
      recentEvents,
      recommendations
    };

    return NextResponse.json(metrics);

  } catch (error) {
    console.error('Security monitoring error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token || token.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'block_ip':
        if (!body.ip) {
          return NextResponse.json(
            { error: 'IP address required' },
            { status: 400 }
          );
        }
        
        // Import and use the blockIP function
        const { blockIP } = await import('../../../../middleware/security-middleware');
        blockIP(body.ip, body.reason || 'Manual block via API');
        
        addSecurityEvent('admin_action', 'low', `IP ${body.ip} blocked manually`);
        
        return NextResponse.json({ success: true, message: `IP ${body.ip} blocked` });

      case 'reset_counters':
        rateLimitedRequests = 0;
        suspiciousActivities = 0;
        
        addSecurityEvent('admin_action', 'low', 'Security counters reset');
        
        return NextResponse.json({ success: true, message: 'Counters reset' });

      case 'test_alert':
        addSecurityEvent('test', 'medium', 'Test security alert triggered');
        return NextResponse.json({ success: true, message: 'Test alert added' });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Security action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to add security events
function addSecurityEvent(
  type: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  message: string
) {
  const event = {
    timestamp: new Date().toISOString(),
    type,
    severity,
    message
  };

  securityEvents.push(event);

  // Keep only last 1000 events to prevent memory issues
  if (securityEvents.length > 1000) {
    securityEvents.splice(0, securityEvents.length - 1000);
  }

  // Log critical and high severity events
  if (severity === 'critical' || severity === 'high') {
    console.warn(`[SECURITY_${severity.toUpperCase()}]`, event);
  }
}

// Export helper functions for use by middleware
function _incrementRateLimitCounter() {
  rateLimitedRequests++;
}

function _incrementSuspiciousActivityCounter() {
  suspiciousActivities++;
}

function _logSecurityEvent(
  type: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  message: string
) {
  addSecurityEvent(type, severity, message);
}
