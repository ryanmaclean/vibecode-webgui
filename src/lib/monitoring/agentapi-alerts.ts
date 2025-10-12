import { logger } from '@/lib/logger';


/**
 * Alerting Rules Configuration for AgentAPI
 * Defines alert conditions and notification strategies
 */

interface AlertRule {
  name: string;
  description: string;
  query: string;
  threshold: number;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  duration: string; // e.g., '5m', '10m', '1h'
  severity: 'critical' | 'warning' | 'info';
  tags: string[];
  notification_channels: string[];
}

interface DatadogMonitor {
  name: string;
  type: 'metric alert' | 'service check' | 'event alert' | 'query alert';
  query: string;
  message: string;
  tags: string[];
  options: {
    thresholds: {
      critical?: number;
      warning?: number;
      ok?: number;
    };
    notify_no_data: boolean;
    no_data_timeframe: number;
    require_full_window: boolean;
    notify_audit: boolean;
    include_tags: boolean;
    evaluation_delay?: number;
  };
  priority?: 1 | 2 | 3 | 4 | 5;
}

/**
 * High Error Rate Alert (>5% over 5 minutes)
 */
export const highErrorRateAlert: AlertRule = {
  name: 'AgentAPI High Error Rate',
  description: 'Agent failure rate exceeds 5% over the last 5 minutes',
  query: '(sum:agent_failure_total{*}.as_rate() / (sum:agent_success_total{*}.as_rate() + sum:agent_failure_total{*}.as_rate())) * 100',
  threshold: 5,
  operator: '>',
  duration: '5m',
  severity: 'critical',
  tags: ['service:agentapi', 'alert:error_rate', 'team:ai-platform'],
  notification_channels: ['slack', 'pagerduty', 'email']
};

/**
 * Slow Response Time Alert (P95 >1s)
 */
export const slowResponseTimeAlert: AlertRule = {
  name: 'AgentAPI Slow Response Time',
  description: 'P95 HTTP response time exceeds 1 second',
  query: 'avg:http_request_duration_seconds.95percentile{service:agentapi}',
  threshold: 1.0,
  operator: '>',
  duration: '5m',
  severity: 'warning',
  tags: ['service:agentapi', 'alert:latency', 'team:ai-platform'],
  notification_channels: ['slack', 'email']
};

/**
 * Agent Downtime Alert (offline >2 minutes)
 */
export const agentDowntimeAlert: AlertRule = {
  name: 'AgentAPI Service Downtime',
  description: 'AgentAPI service is offline for more than 2 minutes',
  query: 'avg(last_5m):avg:http_requests_total{service:agentapi}.as_count()',
  threshold: 0,
  operator: '==',
  duration: '2m',
  severity: 'critical',
  tags: ['service:agentapi', 'alert:downtime', 'team:ai-platform'],
  notification_channels: ['slack', 'pagerduty', 'email']
};

/**
 * High Agent Task Duration Alert (P95 >10 minutes)
 */
export const longTaskDurationAlert: AlertRule = {
  name: 'AgentAPI Long Task Duration',
  description: 'P95 agent task duration exceeds 10 minutes',
  query: 'avg:agent_task_duration_seconds.95percentile{*}',
  threshold: 600,
  operator: '>',
  duration: '10m',
  severity: 'warning',
  tags: ['service:agentapi', 'alert:performance', 'team:ai-platform'],
  notification_channels: ['slack', 'email']
};

/**
 * High Memory Usage Alert (>80%)
 */
export const highMemoryUsageAlert: AlertRule = {
  name: 'AgentAPI High Memory Usage',
  description: 'Memory usage exceeds 80% of available memory',
  query: '(avg:process_resident_memory_bytes{service:agentapi} / avg:system_mem_total{*}) * 100',
  threshold: 80,
  operator: '>',
  duration: '5m',
  severity: 'warning',
  tags: ['service:agentapi', 'alert:resources', 'team:ai-platform'],
  notification_channels: ['slack', 'email']
};

/**
 * High CPU Usage Alert (>85%)
 */
export const highCPUUsageAlert: AlertRule = {
  name: 'AgentAPI High CPU Usage',
  description: 'CPU usage exceeds 85% for sustained period',
  query: 'avg:process_cpu_seconds_total{service:agentapi}.as_rate() * 100',
  threshold: 85,
  operator: '>',
  duration: '5m',
  severity: 'warning',
  tags: ['service:agentapi', 'alert:resources', 'team:ai-platform'],
  notification_channels: ['slack', 'email']
};

/**
 * Too Many Concurrent Agents Alert (>4)
 */
export const tooManyConcurrentAgentsAlert: AlertRule = {
  name: 'AgentAPI Too Many Concurrent Agents',
  description: 'Number of concurrent agents exceeds configured limit',
  query: 'sum:agent_active_count{*}',
  threshold: 4,
  operator: '>',
  duration: '5m',
  severity: 'warning',
  tags: ['service:agentapi', 'alert:capacity', 'team:ai-platform'],
  notification_channels: ['slack', 'email']
};

/**
 * Agent Stuck Alert (no output for >5 minutes while running)
 */
export const agentStuckAlert: AlertRule = {
  name: 'AgentAPI Agent Stuck',
  description: 'Agent has not produced output for more than 5 minutes while running',
  query: 'avg(last_5m):avg:agent_output_lines_total{*}.as_rate()',
  threshold: 0,
  operator: '==',
  duration: '5m',
  severity: 'warning',
  tags: ['service:agentapi', 'alert:health', 'team:ai-platform'],
  notification_channels: ['slack', 'email']
};

/**
 * Convert alert rule to Datadog monitor
 */
export function convertToDatadogMonitor(rule: AlertRule): DatadogMonitor {
  return {
    name: rule.name,
    type: 'metric alert',
    query: `${rule.query}.over("${rule.duration}").last() ${rule.operator} ${rule.threshold}`,
    message: `${rule.description}\n\n{{#is_alert}}Alert: ${rule.name}{{/is_alert}}\n{{#is_recovery}}Recovery: ${rule.name}{{/is_recovery}}\n\nNotify: ${rule.notification_channels.map(c => `@${c}`).join(' ')}`,
    tags: rule.tags,
    options: {
      thresholds: {
        critical: rule.severity === 'critical' ? rule.threshold : undefined,
        warning: rule.severity === 'warning' ? rule.threshold : undefined
      },
      notify_no_data: rule.name.includes('Downtime'),
      no_data_timeframe: 10,
      require_full_window: false,
      notify_audit: false,
      include_tags: true,
      evaluation_delay: 60
    },
    priority: rule.severity === 'critical' ? 1 : rule.severity === 'warning' ? 3 : 5
  };
}

/**
 * Get all alert rules
 */
export function getAllAlertRules(): AlertRule[] {
  return [
    highErrorRateAlert,
    slowResponseTimeAlert,
    agentDowntimeAlert,
    longTaskDurationAlert,
    highMemoryUsageAlert,
    highCPUUsageAlert,
    tooManyConcurrentAgentsAlert,
    agentStuckAlert
  ];
}

/**
 * Deploy alert rules to Datadog
 */
export async function deployAlertRules(
  datadogApiKey: string,
  datadogAppKey: string,
  datadogSite: string = 'datadoghq.com'
): Promise<{ created: number; failed: number; errors: string[] }> {
  const rules = getAllAlertRules();
  const results = { created: 0, failed: 0, errors: [] as string[] };

  for (const rule of rules) {
    try {
      const monitor = convertToDatadogMonitor(rule);

      const response = await fetch(`https://api.${datadogSite}/api/v1/monitor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': datadogApiKey,
          'DD-APPLICATION-KEY': datadogAppKey
        },
        body: JSON.stringify(monitor)
      });

      if (!response.ok) {
        const error = await response.text();
        results.failed++;
        results.errors.push(`${rule.name}: ${response.status} ${error}`);
        logger.error(`❌ Failed to create alert: ${rule.name}`, error);
      } else {
        results.created++;
        logger.info(`✅ Created alert: ${rule.name}`);
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`${rule.name}: ${error}`);
      logger.error(`❌ Error creating alert: ${rule.name}`, error);
    }
  }

  return results;
}

/**
 * Export alert rules as Prometheus AlertManager format
 */
export function exportPrometheusAlerts(): string {
  const rules = getAllAlertRules();
  const groups = {
    name: 'agentapi_alerts',
    interval: '30s',
    rules: rules.map(rule => ({
      alert: rule.name.replace(/\s+/g, '_'),
      expr: rule.query,
      for: rule.duration,
      labels: {
        severity: rule.severity,
        service: 'agentapi',
        team: 'ai-platform'
      },
      annotations: {
        summary: rule.name,
        description: rule.description
      }
    }))
  };

  return `# AgentAPI Prometheus Alert Rules
groups:
  - ${JSON.stringify(groups, null, 4)}
`;
}

/**
 * Test alert condition against current metrics
 */
export async function testAlertCondition(
  rule: AlertRule,
  currentValue: number
): Promise<{ triggered: boolean; message: string }> {
  let triggered = false;

  switch (rule.operator) {
    case '>':
      triggered = currentValue > rule.threshold;
      break;
    case '<':
      triggered = currentValue < rule.threshold;
      break;
    case '>=':
      triggered = currentValue >= rule.threshold;
      break;
    case '<=':
      triggered = currentValue <= rule.threshold;
      break;
    case '==':
      triggered = currentValue === rule.threshold;
      break;
    case '!=':
      triggered = currentValue !== rule.threshold;
      break;
  }

  const message = triggered
    ? `🚨 ALERT: ${rule.name} - ${rule.description} (current: ${currentValue}, threshold: ${rule.operator} ${rule.threshold})`
    : `✅ OK: ${rule.name} (current: ${currentValue}, threshold: ${rule.operator} ${rule.threshold})`;

  return { triggered, message };
}

/**
 * Format alert notification message
 */
export function formatAlertNotification(
  rule: AlertRule,
  currentValue: number,
  isRecovery: boolean = false
): string {
  const emoji = isRecovery ? '✅' : rule.severity === 'critical' ? '🚨' : '⚠️';
  const status = isRecovery ? 'RECOVERY' : 'ALERT';

  return `${emoji} [${status}] ${rule.name}

**Description**: ${rule.description}

**Current Value**: ${currentValue.toFixed(2)}
**Threshold**: ${rule.operator} ${rule.threshold}
**Duration**: ${rule.duration}
**Severity**: ${rule.severity.toUpperCase()}

**Tags**: ${rule.tags.join(', ')}
**Notification Channels**: ${rule.notification_channels.join(', ')}

${isRecovery ? 'The alert condition has been resolved.' : 'Immediate attention required.'}
`;
}

// Export all alert rules and utilities
export {
  type AlertRule,
  type DatadogMonitor
};
