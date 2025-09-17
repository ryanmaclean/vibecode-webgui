#!/usr/bin/env tsx
/**
 * Apply AI Gateway dashboards and monitors to Datadog
 * Requires: DD_API_KEY (or DATADOG_API_KEY), DD_APP_KEY (or DATADOG_APP_KEY)
 */

import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

function getEnv(name: string, fallback?: string) {
  return process.env[name] || (fallback ?? '');
}

function requireEnv(name: string, alt?: string) {
  const val = process.env[name] || (alt ? process.env[alt] : undefined);
  if (!val) {
    throw new Error(`Missing required env: ${name}${alt ? ` (or ${alt})` : ''}`);
  }
  return val;
}

async function main() {
  const DD_API_KEY = requireEnv('DD_API_KEY', 'DATADOG_API_KEY');
  const DD_APP_KEY = requireEnv('DD_APP_KEY', 'DATADOG_APP_KEY');
  const DD_SITE = getEnv('DD_SITE', getEnv('DATADOG_SITE', 'datadoghq.com'));

  const baseUrl = `https://api.${DD_SITE}`;
  const headers = {
    'DD-API-KEY': DD_API_KEY,
    'DD-APPLICATION-KEY': DD_APP_KEY,
    'Content-Type': 'application/json'
  };

  const root = process.cwd();
  const dashboardPath = path.join(root, 'monitoring/datadog/dashboards/ai-gateway-observability.json');
  const monitorsDir = path.join(root, 'monitoring/datadog/monitors');

  // Apply dashboard
  if (fs.existsSync(dashboardPath)) {
    const dashboardBody = JSON.parse(fs.readFileSync(dashboardPath, 'utf-8'));
    console.log(`Applying dashboard: ${dashboardBody.title}`);
    try {
      // Create dashboard
      const resp = await axios.post(`${baseUrl}/api/v1/dashboard`, dashboardBody, { headers });
      console.log(`✅ Dashboard created: ${resp.data?.url || resp.data?.id || dashboardBody.title}`);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data || err?.message;
      console.warn(`⚠️ Dashboard apply failed (${status}): ${JSON.stringify(msg)}`);
    }
  } else {
    console.warn(`⚠️ Dashboard file not found: ${dashboardPath}`);
  }

  // Apply monitors
  if (fs.existsSync(monitorsDir)) {
    const files = fs.readdirSync(monitorsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const full = path.join(monitorsDir, file);
      const monitorBody = JSON.parse(fs.readFileSync(full, 'utf-8'));
      console.log(`Applying monitor: ${monitorBody.name}`);
      try {
        const resp = await axios.post(`${baseUrl}/api/v1/monitor`, monitorBody, { headers });
        console.log(`✅ Monitor created: ${resp.data?.id || monitorBody.name}`);
      } catch (err: any) {
        const status = err?.response?.status;
        const msg = err?.response?.data || err?.message;
        console.warn(`⚠️ Monitor apply failed (${status}): ${JSON.stringify(msg)}`);
      }
    }
  } else {
    console.warn(`⚠️ Monitors directory not found: ${monitorsDir}`);
  }

  console.log('Done. Note: This script creates new dashboards/monitors and may be non-idempotent.');
}

main().catch((e) => {
  console.error('💥 Failed to apply AI Gateway monitoring:', e);
  process.exit(1);
});
