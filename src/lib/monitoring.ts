/**
 * Comprehensive monitoring and logging setup for VibeCode WebGUI
 * Integrates Datadog RUM, logs, and APM tracing
 */

import { datadogRum } from '@datadog/browser-rum'
import { datadogLogs } from '@datadog/browser-logs'

// Configuration interface
interface MonitoringConfig {
  datadogApplicationId: string
  datadogClientToken: string
  datadogSite: string
  environment: string
  version: string
  service: string
  enableRUM: boolean
  enableLogs: boolean
  enableTracing: boolean
  sampleRate: number
  trackInteractions: boolean
  trackResources: boolean
  trackLongTasks: boolean
}

// Default configuration
const defaultConfig: MonitoringConfig = {
  datadogApplicationId: process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID || '',
  datadogClientToken: process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN || '',
  datadogSite: process.env.NEXT_PUBLIC_DATADOG_SITE || 'datadoghq.com',
  environment: process.env.NODE_ENV || 'development',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  service: 'vibecode-webgui',
  enableRUM: true,
  enableLogs: true,
  enableTracing: true,
  sampleRate: 100,
  trackInteractions: true,
  trackResources: true,
  trackLongTasks: true,
}

class MonitoringService {
  private config: MonitoringConfig
  private isInitialized = false

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Initialize all monitoring services
   */
  initialize(): void {
    if (this.isInitialized) {
      console.warn('Monitoring service already initialized')
      return
    }

    if (typeof window === 'undefined') {
      console.warn('Monitoring service can only be initialized in browser environment')
      return
    }

    try {
      this.initializeRUM()
      this.initializeLogs()
      this.setupGlobalErrorHandling()
      this.trackPagePerformance()
      this.isInitialized = true
      
      console.log('✅ Monitoring service initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize monitoring service:', error)
    }
  }

  /**
   * Initialize Datadog Real User Monitoring (RUM)
   */
  private initializeRUM(): void {
    if (!this.config.enableRUM || !this.config.datadogApplicationId || !this.config.datadogClientToken) {
      console.warn('Datadog RUM not configured, skipping initialization')
      return
    }

    datadogRum.init({
      applicationId: this.config.datadogApplicationId,
      clientToken: this.config.datadogClientToken,
      site: this.config.datadogSite,
      service: this.config.service,
      env: this.config.environment,
      version: this.config.version,
      sessionSampleRate: this.config.sampleRate,
      sessionReplaySampleRate: 20,
      trackUserInteractions: this.config.trackInteractions,
      trackResources: this.config.trackResources,
      trackLongTasks: this.config.trackLongTasks,
      defaultPrivacyLevel: 'mask-user-input',
      enableExperimentalFeatures: ['clickmap'],
      beforeSend: (event, context) => {
        // Filter sensitive data
        if (event.type === 'resource' && event.resource.url.includes('api/auth')) {
          return false
        }
        return event
      }
    })

    datadogRum.startSessionReplayRecording()
    console.log('🔍 Datadog RUM initialized')
  }

  /**
   * Initialize Datadog browser logs
   */
  private initializeLogs(): void {
    if (!this.config.enableLogs || !this.config.datadogClientToken) {
      console.warn('Datadog Logs not configured, skipping initialization')
      return
    }

    datadogLogs.init({
      clientToken: this.config.datadogClientToken,
      site: this.config.datadogSite,
      service: this.config.service,
      env: this.config.environment,
      version: this.config.version,
      sessionSampleRate: this.config.sampleRate,
      beforeSend: (log) => {
        // Filter sensitive information
        if (log.message && typeof log.message === 'string') {
          // Remove potential passwords, tokens, etc.
          log.message = log.message.replace(/password[=:]\s*\S+/gi, 'password=***')
          log.message = log.message.replace(/token[=:]\s*\S+/gi, 'token=***')
          log.message = log.message.replace(/key[=:]\s*\S+/gi, 'key=***')
        }
        return log
      }
    })

    console.log('📝 Datadog Logs initialized')
  }

  /**
   * Set up global error handling and reporting
   */
  private setupGlobalErrorHandling(): void {
    // Handle unhandled Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError('Unhandled Promise Rejection', {
        reason: event.reason,
        promise: event.promise,
        stack: event.reason?.stack,
      })
    })

    // Handle global errors
    window.addEventListener('error', (event) => {
      this.logError('Global Error', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error,
        stack: event.error?.stack,
      })
    })

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        this.logError('Resource Loading Error', {
          element: event.target,
          source: (event.target as HTMLElement).getAttribute?.('src') || 
                  (event.target as HTMLElement).getAttribute?.('href'),
          type: (event.target as HTMLElement).tagName,
        })
      }
    }, true)

    console.log('🛡️ Global error handling set up')
  }

  /**
   * Track page performance metrics
   */
  private trackPagePerformance(): void {
    if ('performance' in window) {
      // Track Core Web Vitals
      this.trackWebVitals()
      
      // Track custom performance metrics
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navigationEntry = entry as PerformanceNavigationTiming
            this.logInfo('Page Performance', {
              domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.navigationStart,
              loadComplete: navigationEntry.loadEventEnd - navigationEntry.navigationStart,
              firstByte: navigationEntry.responseStart - navigationEntry.navigationStart,
              dnsLookup: navigationEntry.domainLookupEnd - navigationEntry.domainLookupStart,
              tcpConnection: navigationEntry.connectEnd - navigationEntry.connectStart,
            })
          }
        }
      })
      
      observer.observe({ entryTypes: ['navigation'] })
    }
  }

  /**
   * Track Core Web Vitals
   */
  private trackWebVitals(): void {
    if ('web-vitals' in window || typeof import !== 'undefined') {
      // We'll track these metrics manually since web-vitals is an external dependency
      // Track Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        this.logInfo('Core Web Vital - LCP', {
          value: lastEntry.startTime,
          rating: lastEntry.startTime < 2500 ? 'good' : lastEntry.startTime < 4000 ? 'needs-improvement' : 'poor'
        })
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // Track Cumulative Layout Shift (CLS)
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        }
        this.logInfo('Core Web Vital - CLS', {
          value: clsValue,
          rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor'
        })
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
    }
  }

  /**
   * Log an info message
   */
  logInfo(message: string, context?: Record<string, any>): void {
    if (this.config.enableLogs) {
      datadogLogs.logger.info(message, context)
    }
    console.log(`ℹ️ ${message}`, context)
  }

  /**
   * Log a warning message
   */
  logWarning(message: string, context?: Record<string, any>): void {
    if (this.config.enableLogs) {
      datadogLogs.logger.warn(message, context)
    }
    console.warn(`⚠️ ${message}`, context)
  }

  /**
   * Log an error message
   */
  logError(message: string, context?: Record<string, any>): void {
    if (this.config.enableLogs) {
      datadogLogs.logger.error(message, context)
    }
    console.error(`❌ ${message}`, context)
  }

  /**
   * Add custom user context
   */
  setUser(user: { id: string; name?: string; email?: string; [key: string]: any }): void {
    if (this.config.enableRUM) {
      datadogRum.setUser({
        id: user.id,
        name: user.name,
        email: user.email,
        ...user
      })
    }
    
    if (this.config.enableLogs) {
      datadogLogs.setUser({
        id: user.id,
        name: user.name,
        email: user.email,
        ...user
      })
    }
  }

  /**
   * Track custom actions
   */
  trackAction(name: string, context?: Record<string, any>): void {
    if (this.config.enableRUM) {
      datadogRum.addAction(name, context)
    }
    this.logInfo(`Action: ${name}`, context)
  }

  /**
   * Add custom attributes
   */
  addAttribute(key: string, value: any): void {
    if (this.config.enableRUM) {
      datadogRum.addAttribute(key, value)
    }
    
    if (this.config.enableLogs) {
      datadogLogs.addAttribute(key, value)
    }
  }

  /**
   * Track workspace-specific metrics
   */
  trackWorkspaceMetrics(workspaceId: string, metrics: {
    codeServerStartTime?: number
    terminalConnections?: number
    activeUsers?: number
    filesModified?: number
    aiInteractions?: number
  }): void {
    this.addAttribute('workspace.id', workspaceId)
    
    if (metrics.codeServerStartTime) {
      this.logInfo('Code Server Performance', {
        workspaceId,
        startTime: metrics.codeServerStartTime,
        performance: metrics.codeServerStartTime < 3000 ? 'excellent' : 
                    metrics.codeServerStartTime < 5000 ? 'good' : 'needs-improvement'
      })
    }

    if (metrics.aiInteractions) {
      this.trackAction('ai_interaction', {
        workspaceId,
        interactionCount: metrics.aiInteractions
      })
    }

    this.logInfo('Workspace Metrics', {
      workspaceId,
      ...metrics
    })
  }

  /**
   * Track development environment performance
   */
  trackDevelopmentPerformance(metrics: {
    buildTime?: number
    hotReloadTime?: number
    lintingTime?: number
    testRunTime?: number
    bundleSize?: number
  }): void {
    this.logInfo('Development Performance', metrics)
    
    // Track specific performance thresholds
    if (metrics.buildTime && metrics.buildTime > 30000) {
      this.logWarning('Slow Build Time', { buildTime: metrics.buildTime })
    }
    
    if (metrics.hotReloadTime && metrics.hotReloadTime > 1000) {
      this.logWarning('Slow Hot Reload', { hotReloadTime: metrics.hotReloadTime })
    }
  }
}

// Create singleton instance
const monitoring = new MonitoringService()

export { monitoring, MonitoringService }
export type { MonitoringConfig }