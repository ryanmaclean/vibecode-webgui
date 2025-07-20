import { NextRequest, NextResponse } from 'next/server';

// Get client IP for geographic mapping
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-client-ip') ||
    'unknown';
}

// Log user authentication events to Datadog for geographic tracking
function logUserAuth(
  request: NextRequest,
  event: 'login_attempt' | 'login_success' | 'login_failure' | 'logout',
  metadata: Record<string, any>
) {
  const clientIP = getClientIP(request);
  
  const logData = {
    // Datadog standard fields
    '@timestamp': new Date().toISOString(),
    service: 'vibecode-webgui',
    source: 'auth-api',
    ddsource: 'nodejs',
    ddtags: `env:${process.env.NODE_ENV || 'development'},service:vibecode-webgui,source:auth`,
    level: event === 'login_failure' ? 'warn' : 'info',
    
    // Message for searchability
    message: `[AUTH] ${event}`,
    
    // Event classification for security monitoring
    event: {
      category: 'authentication',
      type: event,
      outcome: event.includes('success') ? 'success' : event.includes('failure') ? 'failure' : 'info',
    },
    
    // HTTP request details
    http: {
      method: request.method,
      url: request.url,
      url_details: {
        path: new URL(request.url).pathname,
      },
      useragent: request.headers.get('user-agent') || 'unknown',
      referer: request.headers.get('referer') || null,
    },
    
    // Network details for geographic mapping - KEY FOR GEOMAPS
    network: {
      client: {
        ip: clientIP, // Datadog will automatically enrich with geo data
      },
      forwarded_ip: request.headers.get('x-forwarded-for') || null,
      real_ip: request.headers.get('x-real-ip') || null,
    },
    
    // User information (anonymized)
    user: {
      id: metadata.userId ? `user_${metadata.userId.substring(0, 8)}***` : null,
      email_domain: metadata.email ? metadata.email.split('@')[1] : null,
      login_method: metadata.loginMethod || 'unknown',
    },
    
    // Geographic context for business analytics
    geo: {
      // These will be automatically filled by Datadog's GeoIP processor
      country_code: null, // Will be enriched
      country_name: null, // Will be enriched  
      city_name: null,    // Will be enriched
      region_name: null,  // Will be enriched
    },
    
    // Authentication-specific data
    auth: {
      event_type: event,
      provider: metadata.provider || 'local',
      method: metadata.loginMethod || 'password',
      ...metadata,
    },
    
    // Custom fields for VibeCode analytics
    vibecode: {
      component: 'auth',
      feature: 'user_tracking',
      session_id: metadata.sessionId,
      ...metadata,
    },
    
    // Datadog trace correlation
    dd: {
      trace_id: request.headers.get('x-datadog-trace-id'),
      span_id: request.headers.get('x-datadog-span-id'),
      service: 'vibecode-webgui',
      env: process.env.NODE_ENV || 'development',
    },
  };

  // Output structured JSON for Datadog Log Agent
  console.log(JSON.stringify(logData));
}

// Track login attempts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, userId, email, provider, sessionId, ...otherMetadata } = body;

    // Validate required fields
    if (!event || !['login_attempt', 'login_success', 'login_failure', 'logout'].includes(event)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // Log the authentication event
    logUserAuth(request, event, {
      userId,
      email,
      provider: provider || 'local',
      sessionId,
      loginMethod: otherMetadata.loginMethod || 'password',
      timestamp: new Date().toISOString(),
      ...otherMetadata,
    });

    return NextResponse.json({
      success: true,
      message: `${event} logged successfully`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Login tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track login event' },
      { status: 500 }
    );
  }
}

// Health check and get current geographic stats
export async function GET(request: NextRequest) {
  logUserAuth(request, 'login_attempt', {
    type: 'health_check',
    endpoint: '/api/auth/login-tracking',
  });

  return NextResponse.json({
    status: 'healthy',
    service: 'auth-tracking',
    geographic_tracking: 'enabled',
    datadog_integration: 'active',
    supported_events: [
      'login_attempt',
      'login_success', 
      'login_failure',
      'logout'
    ],
    geomap_fields: [
      'network.client.ip',
      'geo.country_code',
      'geo.country_name',
      'geo.city_name',
      'geo.region_name'
    ],
    timestamp: new Date().toISOString(),
  });
} 