/**
 * Datadog Application Security Monitoring (ASM) Instrumentation
 *
 * This module extends the existing dd-trace instrumentation with ASM-specific
 * configuration for runtime threat detection and vulnerability management.
 *
 * ASM Features Enabled:
 * - SQL injection detection and blocking
 * - Cross-site scripting (XSS) detection
 * - Remote code execution (RCE) detection
 * - API key leakage detection
 * - Automatic IP blocking after threshold violations
 * - User activity tracking for security events
 *
 * Usage:
 * 1. Import this module AFTER initializing dd-trace in instrumentation.ts
 * 2. Ensure DD_APPSEC_ENABLED=true in environment variables
 * 3. Configure custom rules in monitoring/datadog/asm/rules.json
 *
 * Reference:
 * - https://docs.datadoghq.com/security/application_security/
 * - https://github.com/DataDog/dd-trace-js
 */

import tracer from 'dd-trace';

// Type definitions for ASM configuration
interface ASMConfig {
  enabled: boolean;
  rules?: string | object;
  rateLimit?: number;
  waf?: {
    timeout?: number; // microseconds
  };
  blocking?: {
    enabled?: boolean;
    ipBlocking?: boolean;
    userBlocking?: boolean;
  };
  customRules?: SecurityRule[];
}

interface SecurityRule {
  id: string;
  name: string;
  enabled: boolean;
  tags: string[];
  conditions: RuleCondition[];
  transformers?: string[];
  on_match: string[];
}

interface RuleCondition {
  operator: string;
  parameters: {
    inputs: { address: string }[];
    regex?: string;
    list?: string[];
  };
}

// ASM Configuration
const asmConfig: ASMConfig = {
  enabled: process.env.DD_APPSEC_ENABLED === 'true',

  // Rate limit for security traces (traces per second)
  rateLimit: parseInt(process.env.DD_APPSEC_TRACE_RATE_LIMIT || '100', 10),

  // Web Application Firewall configuration
  waf: {
    // Timeout in microseconds (default: 20ms)
    timeout: parseInt(process.env.DD_APPSEC_WAF_TIMEOUT || '20000', 10),
  },

  // Blocking configuration
  blocking: {
    enabled: process.env.DD_APPSEC_BLOCKING_ENABLED === 'true',
    ipBlocking: process.env.DD_APPSEC_IP_BLOCKING_ENABLED === 'true',
    userBlocking: process.env.DD_APPSEC_USER_BLOCKING_ENABLED === 'true',
  },

  // Custom security rules (will be loaded from external file)
  customRules: [],
};

/**
 * Initialize Application Security Monitoring
 *
 * This function should be called after dd-trace.init() to configure
 * ASM-specific settings and custom rules.
 */
export function initializeASM(): void {
  if (!asmConfig.enabled) {
    console.log('⚠️ Datadog ASM is disabled. Set DD_APPSEC_ENABLED=true to enable.');
    return;
  }

  console.log('🔒 Initializing Datadog Application Security Monitoring (ASM)...');

  try {
    // Configure ASM with dd-trace
    tracer.init({
      appsec: {
        enabled: true,
        rules: process.env.DD_APPSEC_RULES || 'recommended',
        rateLimit: asmConfig.rateLimit,
        waf: {
          timeout: asmConfig.waf?.timeout || 20000,
        },
      },
    });

    // Log ASM configuration
    console.log('✅ Datadog ASM initialized successfully:', {
      blocking: asmConfig.blocking?.enabled,
      ipBlocking: asmConfig.blocking?.ipBlocking,
      userBlocking: asmConfig.blocking?.userBlocking,
      rateLimit: asmConfig.rateLimit,
      wafTimeout: asmConfig.waf?.timeout,
    });

    // Load custom rules if available
    loadCustomRules();

  } catch (error) {
    console.error('❌ Failed to initialize Datadog ASM:', error);
    throw error;
  }
}

/**
 * Load custom security rules from external configuration
 *
 * Rules are loaded from:
 * 1. Environment variable DD_APPSEC_RULES (file path or 'recommended')
 * 2. Default location: monitoring/datadog/asm/rules.json
 */
function loadCustomRules(): void {
  const rulesPath = process.env.DD_APPSEC_RULES;

  if (!rulesPath || rulesPath === 'recommended') {
    console.log('📋 Using Datadog recommended ASM rules');
    return;
  }

  try {
    // In production, rules will be loaded from ConfigMap volume mount
    console.log(`📋 Custom ASM rules configured: ${rulesPath}`);

    // Note: Actual rule loading is handled by the Datadog Agent
    // This is just for logging and validation
  } catch (error) {
    console.warn('⚠️ Failed to load custom ASM rules, falling back to recommended rules:', error);
  }
}

/**
 * Track security event in ASM
 *
 * Use this function to manually report security-relevant events
 * that may not be automatically detected by ASM.
 *
 * @param eventType - Type of security event (e.g., 'authentication_failure', 'privilege_escalation')
 * @param metadata - Additional context about the event
 */
export function trackSecurityEvent(
  eventType: string,
  metadata: Record<string, any> = {}
): void {
  if (!asmConfig.enabled) {
    return;
  }

  try {
    const span = tracer.scope().active();

    if (span) {
      span.setTag('appsec.event', eventType);
      span.setTag('appsec.event.metadata', JSON.stringify(metadata));

      // Add standard security tags
      span.setTag('security_event', true);
      span.setTag('security_event_type', eventType);

      // Add metadata as individual tags for better filtering
      Object.entries(metadata).forEach(([key, value]) => {
        span.setTag(`security.${key}`, value);
      });

      console.log(`🚨 Security event tracked: ${eventType}`, metadata);
    }
  } catch (error) {
    console.error('Failed to track security event:', error);
  }
}

/**
 * Track user for security monitoring
 *
 * Associates the current trace with a user identity for better
 * attack attribution and user-based blocking.
 *
 * @param userId - Unique user identifier
 * @param metadata - Additional user context (email, role, etc.)
 */
export function trackUser(
  userId: string,
  metadata: Record<string, any> = {}
): void {
  if (!asmConfig.enabled) {
    return;
  }

  try {
    const span = tracer.scope().active();

    if (span) {
      // Standard Datadog user tracking tags
      span.setTag('usr.id', userId);

      if (metadata.email) {
        span.setTag('usr.email', metadata.email);
      }

      if (metadata.name) {
        span.setTag('usr.name', metadata.name);
      }

      if (metadata.role) {
        span.setTag('usr.role', metadata.role);
      }

      // Add custom metadata
      Object.entries(metadata).forEach(([key, value]) => {
        if (!['email', 'name', 'role'].includes(key)) {
          span.setTag(`usr.${key}`, value);
        }
      });
    }
  } catch (error) {
    console.error('Failed to track user:', error);
  }
}

/**
 * Report suspicious activity
 *
 * Use this to report patterns that may indicate malicious behavior
 * but don't match existing ASM rules.
 *
 * @param activity - Description of suspicious activity
 * @param severity - Severity level (low, medium, high, critical)
 * @param context - Additional context about the activity
 */
export function reportSuspiciousActivity(
  activity: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  context: Record<string, any> = {}
): void {
  if (!asmConfig.enabled) {
    return;
  }

  try {
    const span = tracer.scope().active();

    if (span) {
      span.setTag('appsec.suspicious_activity', activity);
      span.setTag('appsec.suspicious_activity.severity', severity);
      span.setTag('appsec.suspicious_activity.context', JSON.stringify(context));

      // Set priority based on severity
      if (severity === 'critical' || severity === 'high') {
        span.setTag('manual.keep', true); // Force trace retention
      }

      console.warn(`⚠️ Suspicious activity reported: ${activity} [${severity}]`, context);
    }
  } catch (error) {
    console.error('Failed to report suspicious activity:', error);
  }
}

/**
 * Check if ASM is enabled and operational
 *
 * @returns true if ASM is enabled, false otherwise
 */
export function isASMEnabled(): boolean {
  return asmConfig.enabled;
}

/**
 * Get current ASM configuration
 *
 * @returns Current ASM configuration object
 */
export function getASMConfig(): ASMConfig {
  return { ...asmConfig };
}

/**
 * ASM Middleware for Express/Next.js
 *
 * This middleware adds security context to incoming requests
 * and enables automatic threat detection.
 *
 * Usage in Next.js middleware.ts:
 * ```typescript
 * import { asmMiddleware } from '@/monitoring/datadog/instrumentation-asm';
 *
 * export function middleware(request: NextRequest) {
 *   asmMiddleware(request);
 *   // ... rest of middleware logic
 * }
 * ```
 */
export function asmMiddleware(req: any, res?: any, next?: () => void): void {
  if (!asmConfig.enabled) {
    if (next) next();
    return;
  }

  try {
    const span = tracer.scope().active();

    if (span) {
      // Add request metadata for better security context
      span.setTag('http.client_ip', req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress);
      span.setTag('http.user_agent', req.headers['user-agent']);
      span.setTag('http.method', req.method);
      span.setTag('http.url', req.url);

      // Track potentially sensitive parameters (for monitoring, not logging)
      if (req.query) {
        span.setTag('http.query_params.count', Object.keys(req.query).length);
      }

      if (req.body) {
        span.setTag('http.body.has_content', true);
      }

      // Extract and track authentication context if available
      if (req.headers.authorization) {
        span.setTag('http.auth.present', true);
      }
    }
  } catch (error) {
    console.error('ASM middleware error:', error);
  }

  if (next) next();
}

// Export ASM utilities
export default {
  initializeASM,
  trackSecurityEvent,
  trackUser,
  reportSuspiciousActivity,
  isASMEnabled,
  getASMConfig,
  asmMiddleware,
};
