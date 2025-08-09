import { datadogRum } from '@datadog/browser-rum';

// Define allowed site values according to Datadog RUM documentation
type DatadogSite = 'datadoghq.com' | 'us3.datadoghq.com' | 'us5.datadoghq.com' | 'datadoghq.eu' | 'ddog-gov.com' | 'ap1.datadoghq.com';

interface RUMConfig {
  applicationId: string;
  clientToken: string;
  site?: DatadogSite;
  service?: string;
  env?: string;
  version?: string;
  sessionSampleRate?: number;
  sessionReplaySampleRate?: number;
  trackUserInteractions?: boolean;
  trackResources?: boolean;
  trackLongTasks?: boolean;
  defaultPrivacyLevel?: 'allow' | 'mask' | 'mask-user-input';
}

class RUMMonitoring {
  private static initialized = false;

  /**
   * Initialize Datadog RUM with comprehensive monitoring
   */
  static init(config?: Partial<RUMConfig>) {
    // Only initialize once and only in browser
    if (this.initialized || typeof window === 'undefined') {
      return;
    }

    const rumConfig: RUMConfig = {
      applicationId: process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID || 
                   process.env.NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID || 
                   'vibecode-docs-rum',
      clientToken: process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN || 
                   process.env.NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN || 
                   '',
      site: (process.env.NEXT_PUBLIC_DATADOG_SITE as DatadogSite) || 'datadoghq.com',
      service: 'vibecode-webgui',
      env: process.env.NODE_ENV || 'development',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      trackUserInteractions: true,
      trackResources: true,
      trackLongTasks: true,
      defaultPrivacyLevel: 'mask-user-input',
      ...config
    };

    // Skip initialization if no client token
    if (!rumConfig.clientToken || rumConfig.clientToken.includes('placeholder')) {
      console.warn('[RUM] Skipping Datadog RUM initialization - no valid client token provided');
      return;
    }

    try {
      datadogRum.init({
        applicationId: rumConfig.applicationId,
        clientToken: rumConfig.clientToken,
        site: rumConfig.site,
        service: rumConfig.service,
        env: rumConfig.env,
        version: rumConfig.version,
        sessionSampleRate: rumConfig.sessionSampleRate,
        sessionReplaySampleRate: rumConfig.sessionReplaySampleRate,
        trackUserInteractions: rumConfig.trackUserInteractions,
        trackResources: rumConfig.trackResources,
        trackLongTasks: rumConfig.trackLongTasks,
        defaultPrivacyLevel: rumConfig.defaultPrivacyLevel,
        
        // Enhanced configuration
        trackViewsManually: false,
        enableExperimentalFeatures: ['clickmap'],
        
        // Custom global context
        beforeSend: (event) => {
          // Add custom attributes to all RUM events
          event.context = {
            ...event.context,
            deployment: {
              environment: rumConfig.env,
              version: rumConfig.version,
              commit: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'unknown'
            }
          };
          return true;
        }
      });

      datadogRum.startSessionReplayRecording();
      
      // Set user context if available
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const userInfo = localStorage.getItem('user-info');
          if (userInfo) {
            const user = JSON.parse(userInfo);
            this.setUser(user);
          }
        } catch (error) {
          console.warn('[RUM] Failed to set user context:', error);
        }
      }

      this.initialized = true;
      console.info('[RUM] Datadog RUM initialized successfully', {
        service: rumConfig.service,
        env: rumConfig.env,
        version: rumConfig.version
      });

    } catch (error) {
      console.error('[RUM] Failed to initialize Datadog RUM:', error);
    }
  }

  /**
   * Set user information for RUM tracking
   */
  static setUser(user: { id?: string; name?: string; email?: string; [key: string]: any }) {
    if (!this.initialized) return;

    try {
      datadogRum.setUser({
        id: user.id,
        name: user.name,
        email: user.email,
        ...user
      });
    } catch (error) {
      console.error('[RUM] Failed to set user:', error);
    }
  }

  /**
   * Add custom attribute to RUM
   */
  static addAttribute(key: string, value: any) {
    if (!this.initialized) return;

    try {
      datadogRum.setGlobalContextProperty(key, value);
    } catch (error) {
      console.error('[RUM] Failed to add attribute:', error);
    }
  }

  /**
   * Track custom action
   */
  static addAction(name: string, context?: Record<string, any>) {
    if (!this.initialized) return;

    try {
      datadogRum.addAction(name, context);
    } catch (error) {
      console.error('[RUM] Failed to add action:', error);
    }
  }

  /**
   * Track custom error
   */
  static addError(error: Error | string, context?: Record<string, any>) {
    if (!this.initialized) return;

    try {
      datadogRum.addError(error, context);
    } catch (error: any) {
      console.error('[RUM] Failed to add error:', error);
    }
  }

  /**
   * Track feature flag usage
   */
  static addFeatureFlag(key: string, value: any) {
    if (!this.initialized) return;

    try {
      datadogRum.addFeatureFlagEvaluation(key, value);
    } catch (error) {
      console.error('[RUM] Failed to add feature flag:', error);
    }
  }

  /**
   * Track AI interactions specifically
   */
  static trackAIInteraction(action: string, context: {
    model?: string;
    provider?: string;
    promptLength?: number;
    responseLength?: number;
    latency?: number;
    cost?: number;
    userId?: string;
    sessionId?: string;
  }) {
    this.addAction(`ai.${action}`, {
      ...context,
      timestamp: Date.now(),
      category: 'ai-interaction'
    });
  }

  /**
   * Track page performance
   */
  static trackPerformance(timing: {
    pageLoad?: number;
    domContentLoaded?: number;
    firstContentfulPaint?: number;
    largestContentfulPaint?: number;
    cumulativeLayoutShift?: number;
  }) {
    Object.entries(timing).forEach(([metric, value]) => {
      if (value !== undefined) {
        this.addAttribute(`performance.${metric}`, value);
      }
    });
  }

  /**
   * Track business metrics and conversions
   */
  static trackBusinessMetric(metric: string, value: number, attributes?: Record<string, any>) {
    this.addAction(`business.${metric}`, {
      value,
      ...attributes,
      timestamp: Date.now(),
      category: 'business-metric'
    });
  }

  /**
   * Track workspace interactions
   */
  static trackWorkspaceAction(action: string, workspaceId: string, metadata?: Record<string, any>) {
    this.addAction(`workspace.${action}`, {
      workspaceId,
      ...metadata,
      timestamp: Date.now(),
      category: 'workspace'
    });
  }

  /**
   * Track authentication events
   */
  static trackAuth(event: 'login' | 'logout' | 'signup' | 'password_reset', context?: Record<string, any>) {
    this.addAction(`auth.${event}`, {
      ...context,
      timestamp: Date.now(),
      category: 'authentication'
    });
  }

  /**
   * Track code editor interactions
   */
  static trackCodeEditor(action: string, context: {
    language?: string;
    fileType?: string;
    linesOfCode?: number;
    charactersTyped?: number;
    timeSpent?: number;
  }) {
    this.addAction(`editor.${action}`, {
      ...context,
      timestamp: Date.now(),
      category: 'code-editor'
    });
  }

  /**
   * Track terminal usage
   */
  static trackTerminal(action: string, context: {
    command?: string;
    exitCode?: number;
    duration?: number;
    workspaceId?: string;
  }) {
    // Sanitize potentially sensitive command data
    const sanitizedContext = {
      ...context,
      command: context.command ? this.sanitizeCommand(context.command) : undefined,
      timestamp: Date.now(),
      category: 'terminal'
    };

    this.addAction(`terminal.${action}`, sanitizedContext);
  }

  /**
   * Track user journey and flows
   */
  static trackUserJourney(step: string, flow: string, metadata?: Record<string, any>) {
    this.addAction(`journey.${flow}.${step}`, {
      flow,
      step,
      ...metadata,
      timestamp: Date.now(),
      category: 'user-journey'
    });
  }

  /**
   * Track API usage patterns
   */
  static trackAPIUsage(endpoint: string, method: string, context: {
    responseTime?: number;
    statusCode?: number;
    payloadSize?: number;
    rateLimitRemaining?: number;
  }) {
    this.addAction('api.request', {
      endpoint,
      method,
      ...context,
      timestamp: Date.now(),
      category: 'api-usage'
    });
  }

  /**
   * Track errors with enhanced context
   */
  static trackError(error: Error | string, context: {
    component?: string;
    action?: string;
    userId?: string;
    workspaceId?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, any>;
  }) {
    const errorContext = {
      ...context,
      timestamp: Date.now(),
      category: 'error',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown'
    };

    this.addError(error, errorContext);
  }

  /**
   * Set up enhanced Web Vitals tracking
   */
  static setupWebVitalsTracking() {
    if (typeof window === 'undefined') return;

    // Track Web Vitals with enhanced context
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        // Track Core Web Vitals
        if (entry.entryType === 'largest-contentful-paint') {
          this.trackPerformance({ largestContentfulPaint: entry.startTime });
        }
        
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          this.trackPerformance({ cumulativeLayoutShift: (entry as any).value });
        }
        
        if (entry.entryType === 'first-input') {
          this.addAttribute('performance.firstInputDelay', (entry as any).processingStart - entry.startTime);
        }
      });
    });

    // Observe various performance metrics
    try {
      observer.observe({ entryTypes: ['largest-contentful-paint', 'layout-shift', 'first-input'] });
    } catch (error) {
      console.warn('[RUM] Performance observer not supported:', error);
    }
  }

  /**
   * Initialize RUM with automatic tracking setup
   */
  static initializeWithTracking(config?: Partial<RUMConfig>) {
    this.init(config);
    
    if (this.initialized) {
      this.setupWebVitalsTracking();
      this.setupAutomaticTracking();
    }
  }

  /**
   * Set up automatic tracking for common user interactions
   */
  static setupAutomaticTracking() {
    if (typeof window === 'undefined') return;

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.addAction('page.visibility_change', {
        hidden: document.hidden,
        timestamp: Date.now(),
        category: 'page-lifecycle'
      });
    });

    // Track page unload
    window.addEventListener('beforeunload', () => {
      this.addAction('page.unload', {
        timestamp: Date.now(),
        category: 'page-lifecycle'
      });
    });
  }

  /**
   * Sanitize sensitive command data
   */
  private static sanitizeCommand(command: string): string {
    // Remove potential API keys, passwords, and sensitive data
    return command
      .replace(/--?(?:api-?key|password|token|secret)\s*[=:]?\s*\S+/gi, '--[REDACTED]')
      .replace(/(?:api_key|password|token|secret)\s*[=:]\s*\S+/gi, '[REDACTED]')
      .substring(0, 100); // Truncate long commands
  }

  /**
   * Get RUM session information
   */
  static getSessionInfo() {
    if (!this.initialized) return null;

    try {
      return {
        sessionId: datadogRum.getInternalContext()?.session_id,
        viewId: datadogRum.getInternalContext()?.view?.id,
        initialized: this.initialized
      };
    } catch (error) {
      console.error('[RUM] Failed to get session info:', error);
      return null;
    }
  }
}

export default RUMMonitoring;