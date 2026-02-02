/**
 * Comprehensive Monitoring Setup Script for VibeCode WebGUI
 * Initializes all monitoring components for production deployment
 */

import { logger } from '@/lib/logger'
import { monitoring } from './datadog-client'
import { alertsManager } from './alerts-configuration'
import { enhancedAlerting } from './enhanced-alerting'
import { performanceBaselines } from './performance-baselines'
import { monitoringDashboard } from './monitoring-dashboard'
import { initializeOpenTelemetry } from './opentelemetry'

export interface MonitoringSetupConfig {
  enableDatadog: boolean
  enableOpenTelemetry: boolean
  enableAlerting: boolean
  enableDashboards: boolean
  enableBaselines: boolean
  environment: 'development' | 'staging' | 'production'
  skipHealthChecks: boolean
}

export interface MonitoringSetupResult {
  success: boolean
  components: {
    datadog: boolean
    opentelemetry: boolean
    alerts: boolean
    dashboards: boolean
    baselines: boolean
  }
  errors: string[]
  warnings: string[]
  dashboardUrls: { [key: string]: string }
  monitorIds: { [key: string]: string }
}

class MonitoringSetupService {
  private config: MonitoringSetupConfig
  private result: MonitoringSetupResult

  constructor(config: Partial<MonitoringSetupConfig> = {}) {
    const envToEnvironment = (env: string | undefined): 'development' | 'staging' | 'production' => {
      if (env === 'production' || env === 'staging' || env === 'development') {
        return env;
      }
      return 'development';
    };

    this.config = {
      enableDatadog: process.env.NODE_ENV === 'production',
      enableOpenTelemetry: process.env.NODE_ENV === 'production',
      enableAlerting: process.env.NODE_ENV === 'production',
      enableDashboards: process.env.NODE_ENV === 'production',
      enableBaselines: true,
      environment: envToEnvironment(process.env.NODE_ENV),
      skipHealthChecks: false,
      ...config
    }

    this.result = {
      success: false,
      components: {
        datadog: false,
        opentelemetry: false,
        alerts: false,
        dashboards: false,
        baselines: false
      },
      errors: [],
      warnings: [],
      dashboardUrls: {},
      monitorIds: {}
    }
  }

  /**
   * Run complete monitoring setup
   */
  async setupMonitoring(): Promise<MonitoringSetupResult> {
    console.log('🚀 Starting comprehensive monitoring setup', {
      environment: this.config.environment,
      components: Object.entries(this.config)
        .filter(([key, value]) => key.startsWith('enable') && value)
        .map(([key]) => key.replace('enable', '').toLowerCase())
    })

    try {
      // Step 1: Initialize OpenTelemetry (if enabled)
      if (this.config.enableOpenTelemetry) {
        await this.setupOpenTelemetry()
      }

      // Step 2: Setup Datadog integration (if enabled)
      if (this.config.enableDatadog) {
        await this.setupDatadog()
      }

      // Step 3: Initialize performance baselines
      if (this.config.enableBaselines) {
        await this.setupPerformanceBaselines()
      }

      // Step 4: Setup alerting (if enabled)
      if (this.config.enableAlerting) {
        await this.setupAlerting()
      }

      // Step 5: Create monitoring dashboards (if enabled)
      if (this.config.enableDashboards) {
        await this.setupDashboards()
      }

      // Step 6: Run health checks (if not skipped)
      if (!this.config.skipHealthChecks) {
        await this.runHealthChecks()
      }

      // Step 7: Generate setup report
      this.generateSetupReport()

      this.result.success = this.result.errors.length === 0

      console.log('✅ Monitoring setup completed', {
        success: this.result.success,
        components_enabled: Object.entries(this.result.components)
          .filter(([, enabled]) => enabled)
          .map(([component]) => component),
        errors: this.result.errors.length,
        warnings: this.result.warnings.length
      })

    } catch (error) {
      this.result.errors.push(`Critical setup failure: ${error instanceof Error ? error.message : String(error)}`)
      this.result.success = false

      console.error('❌ Monitoring setup failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    }

    return this.result
  }

  /**
   * Setup OpenTelemetry instrumentation
   */
  private async setupOpenTelemetry(): Promise<void> {
    try {
      console.log('🔧 Initializing OpenTelemetry...')
      
      const otelSDK = initializeOpenTelemetry()
      
      if (otelSDK) {
        this.result.components.opentelemetry = true
        console.log('✅ OpenTelemetry initialized successfully')
      } else {
        this.result.warnings.push('OpenTelemetry initialization skipped (dependencies not available)')
        console.warn('⚠️ OpenTelemetry initialization skipped')
      }

    } catch (error) {
      const message = `OpenTelemetry setup failed: ${error instanceof Error ? error.message : String(error)}`
      this.result.errors.push(message)
      console.error('❌ OpenTelemetry setup failed', { error: message })
    }
  }

  /**
   * Setup Datadog integration
   */
  private async setupDatadog(): Promise<void> {
    try {
      console.log('🔧 Setting up Datadog integration...')

      // Check Datadog configuration
      if (!monitoring.isConfigured()) {
        this.result.warnings.push('Datadog API key not configured - metrics will be logged only')
        console.warn('⚠️ Datadog API key not configured')
        return
      }

      // Test Datadog connectivity
      const testMetric = await monitoring.submitMetric({
        metric: 'vibecode.monitoring.setup_test',
        value: 1,
        tags: ['environment:' + this.config.environment, 'setup:test']
      })

      if (testMetric) {
        this.result.components.datadog = true
        console.log('✅ Datadog integration verified')
      } else {
        this.result.warnings.push('Datadog metric submission test failed')
        console.warn('⚠️ Datadog metric submission test failed')
      }

    } catch (error) {
      const message = `Datadog setup failed: ${error instanceof Error ? error.message : String(error)}`
      this.result.errors.push(message)
      console.error('❌ Datadog setup failed', { error: message })
    }
  }

  /**
   * Setup performance baselines
   */
  private async setupPerformanceBaselines(): Promise<void> {
    try {
      console.log('🔧 Initializing performance baselines...')

      // Import existing baselines if available
      if (process.env.PERFORMANCE_BASELINES_DATA) {
        try {
          performanceBaselines.importBaselines(process.env.PERFORMANCE_BASELINES_DATA)
          console.log('📊 Imported existing performance baselines')
        } catch (error) {
          this.result.warnings.push('Failed to import existing performance baselines')
        }
      }

      this.result.components.baselines = true
      console.log('✅ Performance baselines initialized')

    } catch (error) {
      const message = `Performance baselines setup failed: ${error instanceof Error ? error.message : String(error)}`
      this.result.errors.push(message)
      console.error('❌ Performance baselines setup failed', { error: message })
    }
  }

  /**
   * Setup alerting system
   */
  private async setupAlerting(): Promise<void> {
    try {
      console.log('🔧 Setting up alerting system...')

      // Setup traditional Datadog alerts
      if (monitoring.isConfigured()) {
        const monitorIds = await alertsManager.setupAllAlerts()
        this.result.monitorIds = monitorIds

        console.log(`📊 Created ${Object.keys(monitorIds).length} Datadog monitors`)
      }

      // Enhanced alerting system is automatically initialized
      const alertingHealth = enhancedAlerting.getHealthStatus()
      
      this.result.components.alerts = true
      console.log('✅ Alerting system initialized', {
        traditional_monitors: Object.keys(this.result.monitorIds).length,
        smart_alerts: alertingHealth.enabled_alerts,
        anomaly_detection: alertingHealth.anomaly_detection_status.enabled_configs
      })

    } catch (error) {
      const message = `Alerting setup failed: ${error instanceof Error ? error.message : String(error)}`
      this.result.errors.push(message)
      console.error('❌ Alerting setup failed', { error: message })
    }
  }

  /**
   * Setup monitoring dashboards
   */
  private async setupDashboards(): Promise<void> {
    try {
      console.log('🔧 Creating monitoring dashboards...')

      if (!monitoring.isConfigured()) {
        this.result.warnings.push('Datadog not configured - dashboards cannot be created')
        return
      }

      const dashboardIds = await monitoringDashboard.setupAllDashboards()
      
      if (Object.keys(dashboardIds).length > 0) {
        this.result.components.dashboards = true
        
        // Generate dashboard URLs
        const site = process.env.DD_SITE || 'datadoghq.com'
        for (const [name, id] of Object.entries(dashboardIds)) {
          this.result.dashboardUrls[name] = `https://app.${site}/dashboard/${id}`
        }

        console.log('✅ Monitoring dashboards created', {
          dashboards: Object.keys(dashboardIds),
          count: Object.keys(dashboardIds).length
        })
      } else {
        this.result.warnings.push('No dashboards were successfully created')
      }

    } catch (error) {
      const message = `Dashboard setup failed: ${error instanceof Error ? error.message : String(error)}`
      this.result.errors.push(message)
      console.error('❌ Dashboard setup failed', { error: message })
    }
  }

  /**
   * Run comprehensive health checks
   */
  private async runHealthChecks(): Promise<void> {
    try {
      console.log('🔧 Running monitoring health checks...')

      const healthChecks = await Promise.allSettled([
        monitoring.checkDatabase(),
        monitoring.checkValkey(),
        monitoring.checkAIService()
      ])

      const results = healthChecks.map((result, index) => {
        const services = ['database', 'redis', 'ai_service']
        if (result.status === 'fulfilled') {
          return { service: services[index], ...result.value }
        } else {
          return {
            service: services[index],
            status: 'error' as const,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason)
          }
        }
      })

      // Log health check results
      results.forEach(result => {
        if (result.status === 'healthy') {
          console.log(`✅ ${result.service} health check passed`, result.details)
        } else if (result.status === 'warning') {
          console.warn(`⚠️ ${result.service} health check warning`, result.details || { error: result.error })
          this.result.warnings.push(`${result.service}: ${result.error || 'warning'}`)
        } else {
          console.error(`❌ ${result.service} health check failed`, { error: result.error })
          this.result.warnings.push(`${result.service}: ${result.error}`)
        }
      })

    } catch (error) {
      const message = `Health checks failed: ${error instanceof Error ? error.message : String(error)}`
      this.result.warnings.push(message)
      console.warn('⚠️ Health checks failed', { error: message })
    }
  }

  /**
   * Generate comprehensive setup report
   */
  private generateSetupReport(): void {
    const enabledComponents = Object.entries(this.result.components)
      .filter(([, enabled]) => enabled)
      .map(([component]) => component)

    const report = {
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      setup_status: this.result.success ? 'success' : 'partial_failure',
      enabled_components: enabledComponents,
      components_summary: {
        total: Object.keys(this.result.components).length,
        enabled: enabledComponents.length,
        success_rate: `${Math.round((enabledComponents.length / Object.keys(this.result.components).length) * 100)}%`
      },
      dashboards: Object.keys(this.result.dashboardUrls),
      monitors: Object.keys(this.result.monitorIds),
      issues: {
        errors: this.result.errors.length,
        warnings: this.result.warnings.length
      }
    }

    console.log('📊 Monitoring setup report', report)

    // Submit setup metrics
    logger.info('Monitoring setup completed', {
      metric: 'vibecode.monitoring.setup.completed',
      environment: this.config.environment,
      success: this.result.success.toString(),
      components_enabled: enabledComponents.length.toString()
    })
  }

  /**
   * Export monitoring configuration for backup/restore
   */
  exportConfiguration(): string {
    const config = {
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      setup_result: this.result,
      dashboards: monitoringDashboard.exportDashboardConfigs(),
      baselines: performanceBaselines.exportBaselines(),
      alerting_health: enhancedAlerting.getHealthStatus()
    }

    return JSON.stringify(config, null, 2)
  }
}

/**
 * Quick setup function for common scenarios
 */
export async function setupProductionMonitoring(): Promise<MonitoringSetupResult> {
  const setup = new MonitoringSetupService({
    enableDatadog: true,
    enableOpenTelemetry: true,
    enableAlerting: true,
    enableDashboards: true,
    enableBaselines: true,
    environment: 'production',
    skipHealthChecks: false
  })

  return await setup.setupMonitoring()
}

export async function setupDevelopmentMonitoring(): Promise<MonitoringSetupResult> {
  const setup = new MonitoringSetupService({
    enableDatadog: false,
    enableOpenTelemetry: false,
    enableAlerting: false,
    enableDashboards: false,
    enableBaselines: true,
    environment: 'development',
    skipHealthChecks: true
  })

  return await setup.setupMonitoring()
}

// Export the service class
export { MonitoringSetupService }