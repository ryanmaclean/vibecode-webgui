#!/usr/bin/env tsx
/**
 * Datadog Monitoring Setup Script
 * Creates dashboards, alerts, and configures monitoring for VibeCode platform
 */

import { dashboardManager } from '../src/lib/monitoring/advanced-datadog-dashboards'
import { alertsManager } from '../src/lib/monitoring/alerts-configuration'
import { getDatadogApiKey, getDatadogAppKey, getDatadogSite, getServiceEnvVersion } from '../src/lib/monitoring/datadog-env'

interface SetupResults {
  dashboards: {
    aiFeatures?: string
    userExperience?: string
    infrastructure?: string
  }
  alerts: { [key: string]: string }
  success: boolean
  errors: string[]
}

async function setupDatadogMonitoring(): Promise<SetupResults> {
  console.log('🚀 Starting Datadog monitoring setup for VibeCode...\n')

  const results: SetupResults = {
    dashboards: {},
    alerts: {},
    success: false,
    errors: []
  }

  // Check environment variables (prefer DD_* with DATADOG_* fallback)
  const apiKey = getDatadogApiKey()
  const appKey = getDatadogAppKey()
  const missing: string[] = []
  if (!apiKey) missing.push('DD_API_KEY (or DATADOG_API_KEY)')
  if (!appKey) missing.push('DD_APP_KEY (or DATADOG_APP_KEY)')

  if (missing.length > 0) {
    const error = `Missing required environment variables: ${missing.join(', ')}`
    results.errors.push(error)
    console.error(`❌ ${error}`)
    console.log('\nPlease set the following environment variables (prefer DD_*):')
    console.log('export DD_API_KEY="your-api-key"             # falls back to DATADOG_API_KEY if set')
    console.log('export DD_APP_KEY="your-app-key"             # falls back to DATADOG_APP_KEY if set')
    console.log('export DD_SITE="datadoghq.com"               # optional, falls back to DATADOG_SITE')
    return results
  }

  console.log('✅ Environment variables configured')
  const site = getDatadogSite()
  const { service } = getServiceEnvVersion()
  console.log(`   Site: ${site}`)
  console.log(`   Service: ${service}\n`)

  // Set up dashboards
  console.log('📊 Setting up Datadog dashboards...')
  try {
    results.dashboards = await dashboardManager.setupAllDashboards()
    console.log('✅ Dashboards created successfully\n')
  } catch (error) {
    const errorMsg = `Failed to create dashboards: ${error}`
    results.errors.push(errorMsg)
    console.error(`❌ ${errorMsg}\n`)
  }

  // Set up alerts
  console.log('🚨 Setting up Datadog alerts...')
  try {
    results.alerts = await alertsManager.setupAllAlerts()
    console.log('✅ Alerts created successfully\n')
  } catch (error) {
    const errorMsg = `Failed to create alerts: ${error}`
    results.errors.push(errorMsg)
    console.error(`❌ ${errorMsg}\n`)
  }

  // Test connectivity
  console.log('🔍 Testing Datadog connectivity...')
  try {
    const existingDashboards = await dashboardManager.listDashboards()
    const existingMonitors = await alertsManager.listMonitors()
    
    console.log(`✅ Found ${existingDashboards.length} VibeCode dashboards`)
    console.log(`✅ Found ${existingMonitors.length} VibeCode monitors`)
    
    if (existingDashboards.length > 0) {
      console.log('\n📈 Dashboard URLs:')
      existingDashboards.forEach(dashboard => {
        console.log(`   • ${dashboard.title}: ${dashboard.url}`)
      })
    }
  } catch (error) {
    const errorMsg = `Failed to test connectivity: ${error}`
    results.errors.push(errorMsg)
    console.error(`❌ ${errorMsg}`)
  }

  results.success = results.errors.length === 0

  if (results.success) {
    console.log('\n🎉 Datadog monitoring setup completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Check your Datadog dashboard for new VibeCode dashboards')
    console.log('2. Verify alerts are configured in the Monitors section')
    console.log('3. Start using the application to generate metrics')
  } else {
    console.log('\n⚠️  Setup completed with some errors:')
    results.errors.forEach(error => console.log(`   • ${error}`))
  }

  return results
}

// Run the setup if called directly
if (require.main === module) {
  setupDatadogMonitoring().catch(error => {
    console.error('💥 Setup failed:', error)
    process.exit(1)
  })
}

export { setupDatadogMonitoring }