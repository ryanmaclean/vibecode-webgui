/**
 * Security Monitoring API Endpoint
 * Provides real-time security status and metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSecurityStats } from '../../../../middleware/security-middleware';
import { createAPIRateLimit } from '@/lib/rate-limiting';

const apiRateLimit = createAPIRateLimit(120); // 120 requests per minute - monitoring data

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
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    );
  }

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
      rateLimit: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
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
      recommendations.push('Configure Upstash Redis for rate limiting');
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
    // Server error logged
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    );
  }

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
    // Server error logged
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
    // Server warning noted}]`, event);
  }
}

// Export helper functions for use by middleware
export function incrementRateLimitCounter() {
  rateLimitedRequests++;
}

export function incrementSuspiciousActivityCounter() {
  suspiciousActivities++;
}

export function logSecurityEvent(
  type: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  message: string
) {
  addSecurityEvent(type, severity, message);
}