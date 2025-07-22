import { datadogRum } from '@datadog/browser-rum';

interface RUMConfig {
  applicationId: string;
  clientToken: string;
  site?: string;
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
      site: process.env.NEXT_PUBLIC_DATADOG_SITE || 'datadoghq.com',
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
        trackFrustrations: true,
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
}

export default RUMMonitoring;