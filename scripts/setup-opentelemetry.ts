#!/usr/bin/env npx tsx
/**
 * OpenTelemetry Setup Script
 * Configures OpenTelemetry integration and validates configuration
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

interface OtelConfig {
  enabled: boolean
  otlpEndpoint: string
  prometheusPort: number
  datadogIntegration: boolean
  environment: string
}

class OpenTelemetrySetup {
  private config: OtelConfig

  constructor() {
    this.config = {
      enabled: process.env.OTEL_ENABLED === 'true',
      otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
      prometheusPort: parseInt(process.env.OTEL_PROMETHEUS_PORT || '9090'),
      datadogIntegration: !!process.env.DD_API_KEY,
      environment: process.env.NODE_ENV || 'development'
    }
  }

  async run() {
    console.log('🔧 Setting up OpenTelemetry integration...')
    console.log()

    try {
      await this.validateDependencies()
      await this.checkConfiguration()
      await this.generateEnvExample()
      await this.validateEndpoints()
      await this.displaySetupInstructions()

      console.log('✅ OpenTelemetry setup complete!')

    } catch (error) {
      console.error('❌ OpenTelemetry setup failed:', error)
      process.exit(1)
    }
  }

  private async validateDependencies() {
    console.log('📦 Validating OpenTelemetry dependencies...')

    const requiredPackages = [
      '@opentelemetry/api',
      '@opentelemetry/sdk-node',
      '@opentelemetry/auto-instrumentations-node',
      '@opentelemetry/exporter-otlp-http',
      '@opentelemetry/exporter-prometheus'
    ]

    const packageJsonPath = path.join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
    const allDependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }

    const missingPackages = requiredPackages.filter(pkg => !allDependencies[pkg])

    if (missingPackages.length > 0) {
      console.log('⚠️  Missing required packages:', missingPackages.join(', '))
      console.log('   Installing missing packages...')
      
      const installCommand = `npm install ${missingPackages.join(' ')} --legacy-peer-deps`
      await execAsync(installCommand)
      console.log('✅ Dependencies installed successfully')
    } else {
      console.log('✅ All required dependencies are installed')
    }
  }

  private async checkConfiguration() {
    console.log('🔍 Checking OpenTelemetry configuration...')

    console.log(`   OTEL_ENABLED: ${this.config.enabled ? '✅ true' : '⚠️  false (set to "true" to enable)'}`)
    console.log(`   OTLP Endpoint: ${this.config.otlpEndpoint}`)
    console.log(`   Prometheus Port: ${this.config.prometheusPort}`)
    console.log(`   Datadog Integration: ${this.config.datadogIntegration ? '✅ enabled' : '⚠️  disabled (set DD_API_KEY to enable)'}`)
    console.log(`   Environment: ${this.config.environment}`)
  }

  private async generateEnvExample() {
    console.log('📝 Generating environment configuration example...')

    const envExample = `
# OpenTelemetry Configuration
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_PROMETHEUS_PORT=9090
OTEL_PROMETHEUS_ENDPOINT=/metrics

# For client-side OpenTelemetry
NEXT_PUBLIC_OTEL_ENABLED=true
NEXT_PUBLIC_OTEL_EXPORTER_URL=/api/monitoring/traces

# Datadog Integration (optional)
DD_API_KEY=your_datadog_api_key_here
DD_SITE=datadoghq.com

# Service Information
DD_SERVICE=vibecode-webgui
DD_VERSION=1.0.0
DD_ENV=development
`.trim()

    const envExamplePath = path.join(process.cwd(), '.env.otel.example')
    await fs.writeFile(envExamplePath, envExample)
    console.log(`✅ Environment example saved to .env.otel.example`)
  }

  private async validateEndpoints() {
    console.log('🌐 Validating endpoints...')

    // Test Prometheus endpoint
    try {
      console.log(`   Testing Prometheus endpoint on port ${this.config.prometheusPort}...`)
      
      // Check if port is available
      const { stdout } = await execAsync(`lsof -i :${this.config.prometheusPort} || echo "port_available"`)
      
      if (stdout.includes('port_available')) {
        console.log(`   ✅ Port ${this.config.prometheusPort} is available for Prometheus metrics`)
      } else {
        console.log(`   ⚠️  Port ${this.config.prometheusPort} is in use - metrics may conflict`)
      }
    } catch (error) {
      console.log(`   ⚠️  Could not check port ${this.config.prometheusPort}: ${error}`)
    }

    // Test OTLP endpoint connectivity (if not localhost)
    if (!this.config.otlpEndpoint.includes('localhost')) {
      try {
        console.log(`   Testing OTLP endpoint connectivity: ${this.config.otlpEndpoint}`)
        
        const response = await fetch(this.config.otlpEndpoint, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        })
        
        console.log(`   ✅ OTLP endpoint is reachable (status: ${response.status})`)
      } catch (error) {
        console.log(`   ⚠️  OTLP endpoint may not be reachable: ${error}`)
      }
    }
  }

  private async displaySetupInstructions() {
    console.log()
    console.log('📋 Setup Instructions:')
    console.log()
    console.log('1. Environment Configuration:')
    console.log('   Copy .env.otel.example to .env.local and update values as needed')
    console.log()
    console.log('2. Enable OpenTelemetry:')
    console.log('   Set OTEL_ENABLED=true in your environment')
    console.log()
    console.log('3. Start the application:')
    console.log('   npm run dev')
    console.log()
    console.log('4. Verify setup:')
    console.log('   - Check OpenTelemetry config: npm run otel:config')
    console.log('   - Check health status: npm run otel:health')
    console.log('   - View Prometheus metrics: npm run otel:metrics')
    console.log()
    console.log('5. Integration Options:')
    
    if (this.config.datadogIntegration) {
      console.log('   ✅ Datadog: Configured via DD_API_KEY')
      console.log('      - Traces will be sent via OTLP to Datadog Agent')
      console.log('      - Metrics available in Datadog dashboard')
    } else {
      console.log('   ⚠️  Datadog: Set DD_API_KEY to enable integration')
    }
    
    console.log('   📊 Prometheus: Metrics available at http://localhost:9090/metrics')
    console.log('   🔍 OTLP: Generic endpoint for any OTLP-compatible backend')
    console.log()
    console.log('6. Client-side tracking:')
    console.log('   Set NEXT_PUBLIC_OTEL_ENABLED=true for browser instrumentation')
    console.log()
    console.log('For more information, see: https://opentelemetry.io/docs/languages/js/')
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new OpenTelemetrySetup()
  setup.run().catch(console.error)
}

export default OpenTelemetrySetup