#!/usr/bin/env tsx
/**
 * AgentAPI Monitoring Setup Script
 * Automates deployment of monitoring stack components
 */

import * as fs from 'fs';
import * as path from 'path';

interface SetupConfig {
  datadogApiKey?: string;
  datadogAppKey?: string;
  datadogSite: string;
  prometheusPort: number;
  deployDashboard: boolean;
  deployAlerts: boolean;
  exportConfigs: boolean;
  outputDir: string;
}

async function setupAgentAPIMonitoring(config: SetupConfig): Promise<void> {
  console.log('🚀 AgentAPI Monitoring Setup');
  console.log('================================\n');

  const results = {
    dashboard: { success: false, url: '' },
    alerts: { created: 0, failed: 0, errors: [] as string[] },
    configs: { exported: false, location: '' }
  };

  // 1. Deploy Datadog Dashboard
  if (config.deployDashboard) {
    console.log('📊 Deploying Datadog Dashboard...');

    if (!config.datadogApiKey || !config.datadogAppKey) {
      console.warn('⚠️  Skipping dashboard deployment - DD_API_KEY or DD_APP_KEY not set');
    } else {
      try {
        const { deployAgentAPIDashboard } = await import('../src/lib/monitoring/agentapi-datadog-dashboard');

        const { id, url } = await deployAgentAPIDashboard(
          config.datadogApiKey,
          config.datadogAppKey,
          config.datadogSite
        );

        results.dashboard.success = true;
        results.dashboard.url = url;

        console.log(`✅ Dashboard deployed: ${url}`);
        console.log(`   Dashboard ID: ${id}\n`);
      } catch (error) {
        console.error(`❌ Dashboard deployment failed:`, error);
      }
    }
  }

  // 2. Deploy Alert Rules
  if (config.deployAlerts) {
    console.log('🚨 Deploying Alert Rules...');

    if (!config.datadogApiKey || !config.datadogAppKey) {
      console.warn('⚠️  Skipping alert deployment - DD_API_KEY or DD_APP_KEY not set');
    } else {
      try {
        const { deployAlertRules } = await import('../src/lib/monitoring/agentapi-alerts');

        const alertResults = await deployAlertRules(
          config.datadogApiKey,
          config.datadogAppKey,
          config.datadogSite
        );

        results.alerts = alertResults;

        console.log(`✅ Alerts deployed: ${alertResults.created} created, ${alertResults.failed} failed`);

        if (alertResults.errors.length > 0) {
          console.log('\n⚠️  Alert errors:');
          alertResults.errors.forEach(error => console.log(`   - ${error}`));
        }

        console.log('');
      } catch (error) {
        console.error(`❌ Alert deployment failed:`, error);
      }
    }
  }

  // 3. Export Configuration Files
  if (config.exportConfigs) {
    console.log('📄 Exporting Configuration Files...');

    try {
      const outputDir = path.resolve(config.outputDir);

      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Export Datadog dashboard JSON
      const { exportDashboardJSON } = await import('../src/lib/monitoring/agentapi-datadog-dashboard');
      const dashboardJson = exportDashboardJSON();
      const dashboardPath = path.join(outputDir, 'datadog-dashboard.json');
      fs.writeFileSync(dashboardPath, dashboardJson);
      console.log(`✅ Exported Datadog dashboard: ${dashboardPath}`);

      // Export Prometheus alerts
      const { exportPrometheusAlerts } = await import('../src/lib/monitoring/agentapi-alerts');
      const prometheusConfig = exportPrometheusAlerts();
      const alertsPath = path.join(outputDir, 'prometheus-alerts.yaml');
      fs.writeFileSync(alertsPath, prometheusConfig);
      console.log(`✅ Exported Prometheus alerts: ${alertsPath}`);

      // Copy monitoring config
      const monitoringConfigSource = path.resolve('configs/agentapi-monitoring.yaml');
      const monitoringConfigDest = path.join(outputDir, 'agentapi-monitoring.yaml');
      if (fs.existsSync(monitoringConfigSource)) {
        fs.copyFileSync(monitoringConfigSource, monitoringConfigDest);
        console.log(`✅ Copied monitoring config: ${monitoringConfigDest}`);
      }

      results.configs.exported = true;
      results.configs.location = outputDir;

      console.log('');
    } catch (error) {
      console.error(`❌ Config export failed:`, error);
    }
  }

  // 4. Print Summary
  console.log('📋 Setup Summary');
  console.log('================================');

  if (config.deployDashboard) {
    if (results.dashboard.success) {
      console.log(`✅ Dashboard: ${results.dashboard.url}`);
    } else {
      console.log('❌ Dashboard: Failed to deploy');
    }
  }

  if (config.deployAlerts) {
    console.log(`✅ Alerts: ${results.alerts.created} created, ${results.alerts.failed} failed`);
  }

  if (config.exportConfigs) {
    if (results.configs.exported) {
      console.log(`✅ Configs: Exported to ${results.configs.location}`);
    } else {
      console.log('❌ Configs: Export failed');
    }
  }

  console.log('\n🎉 Setup complete!\n');

  // 5. Print Next Steps
  console.log('Next Steps:');
  console.log('================================');
  console.log('1. Start Prometheus exporter:');
  console.log('   npm run otel:setup\n');
  console.log('2. Verify metrics endpoint:');
  console.log(`   curl http://localhost:${config.prometheusPort}/metrics\n`);
  console.log('3. Configure Prometheus scraping:');
  console.log('   Add scrape config for localhost:' + config.prometheusPort + '\n');
  console.log('4. View Datadog dashboard:');
  if (results.dashboard.url) {
    console.log(`   ${results.dashboard.url}\n`);
  } else {
    console.log('   Import dashboard.json to Datadog manually\n');
  }
  console.log('5. Configure AlertManager:');
  console.log('   Use prometheus-alerts.yaml from output directory\n');
}

// Parse command line arguments
function parseArgs(): SetupConfig {
  const args = process.argv.slice(2);

  const config: SetupConfig = {
    datadogApiKey: process.env.DD_API_KEY,
    datadogAppKey: process.env.DD_APP_KEY,
    datadogSite: process.env.DD_SITE || 'datadoghq.com',
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
    deployDashboard: false,
    deployAlerts: false,
    exportConfigs: false,
    outputDir: './monitoring-configs'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--deploy-dashboard':
        config.deployDashboard = true;
        break;
      case '--deploy-alerts':
        config.deployAlerts = true;
        break;
      case '--export-configs':
        config.exportConfigs = true;
        break;
      case '--output-dir':
        config.outputDir = args[++i];
        break;
      case '--dd-api-key':
        config.datadogApiKey = args[++i];
        break;
      case '--dd-app-key':
        config.datadogAppKey = args[++i];
        break;
      case '--dd-site':
        config.datadogSite = args[++i];
        break;
      case '--prometheus-port':
        config.prometheusPort = parseInt(args[++i], 10);
        break;
      case '--all':
        config.deployDashboard = true;
        config.deployAlerts = true;
        config.exportConfigs = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  // Default to export configs if no other options specified
  if (!config.deployDashboard && !config.deployAlerts && !config.exportConfigs) {
    config.exportConfigs = true;
  }

  return config;
}

function printHelp(): void {
  console.log(`
AgentAPI Monitoring Setup Script

Usage:
  tsx scripts/setup-agentapi-monitoring.ts [options]

Options:
  --deploy-dashboard     Deploy Datadog dashboard (requires DD_API_KEY and DD_APP_KEY)
  --deploy-alerts        Deploy alert rules to Datadog
  --export-configs       Export configuration files (default if no other options)
  --all                  Deploy dashboard, alerts, and export configs
  --output-dir <path>    Output directory for exported configs (default: ./monitoring-configs)
  --dd-api-key <key>     Datadog API key (or use DD_API_KEY env var)
  --dd-app-key <key>     Datadog Application key (or use DD_APP_KEY env var)
  --dd-site <site>       Datadog site (default: datadoghq.com)
  --prometheus-port <n>  Prometheus port (default: 9090)
  --help                 Show this help message

Examples:
  # Export configs only (default)
  tsx scripts/setup-agentapi-monitoring.ts

  # Deploy everything (requires Datadog credentials)
  tsx scripts/setup-agentapi-monitoring.ts --all

  # Deploy dashboard only
  tsx scripts/setup-agentapi-monitoring.ts --deploy-dashboard

  # Export to custom directory
  tsx scripts/setup-agentapi-monitoring.ts --export-configs --output-dir ./configs/monitoring
  `);
}

// Main execution
if (require.main === module) {
  const config = parseArgs();

  setupAgentAPIMonitoring(config)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

export { setupAgentAPIMonitoring, type SetupConfig };
