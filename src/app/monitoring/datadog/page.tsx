'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DemoBanner } from '@/components/ui/DemoBanner'
import {
  Zap,
  CheckCircle,
  XCircle,
  Settings,
  Activity,
  Shield,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronRight,
  Server,
  FileText,
  BarChart3,
  Bell,
  Clock,
  Code,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type MonitorStatus = 'OK' | 'Alert' | 'Warn'
type MonitorType = 'metric' | 'service' | 'log'

interface ServiceRow {
  name: string
  environment: string
  tracesPerMin: number
  errorRate: number
  p95Latency: number
  status: 'healthy' | 'degraded' | 'down'
}

interface Monitor {
  id: string
  name: string
  type: MonitorType
  status: MonitorStatus
  lastTriggered: string
}

interface EnvVar {
  key: string
  value: string
  description: string
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_SERVICES: ServiceRow[] = [
  {
    name: 'vibecode-webgui',
    environment: 'production',
    tracesPerMin: 245,
    errorRate: 0.12,
    p95Latency: 42,
    status: 'healthy',
  },
  {
    name: 'vibecode-api',
    environment: 'production',
    tracesPerMin: 512,
    errorRate: 0.34,
    p95Latency: 89,
    status: 'healthy',
  },
  {
    name: 'vibecode-vm-manager',
    environment: 'production',
    tracesPerMin: 78,
    errorRate: 0.08,
    p95Latency: 156,
    status: 'healthy',
  },
  {
    name: 'vibecode-health-checker',
    environment: 'production',
    tracesPerMin: 320,
    errorRate: 0.02,
    p95Latency: 18,
    status: 'healthy',
  },
  {
    name: 'vibecode-ai-gateway',
    environment: 'production',
    tracesPerMin: 134,
    errorRate: 0.67,
    p95Latency: 890,
    status: 'degraded',
  },
  {
    name: 'vibecode-websocket',
    environment: 'production',
    tracesPerMin: 198,
    errorRate: 0.05,
    p95Latency: 12,
    status: 'healthy',
  },
]

const MOCK_MONITORS: Monitor[] = [
  {
    id: 'mon-001',
    name: 'Service Health',
    type: 'service',
    status: 'OK',
    lastTriggered: '3 days ago',
  },
  {
    id: 'mon-002',
    name: 'API Error Rate',
    type: 'metric',
    status: 'OK',
    lastTriggered: '12 hours ago',
  },
  {
    id: 'mon-003',
    name: 'VM Boot Time',
    type: 'metric',
    status: 'Warn',
    lastTriggered: '45 min ago',
  },
  {
    id: 'mon-004',
    name: 'AI Response Latency',
    type: 'metric',
    status: 'Alert',
    lastTriggered: '8 min ago',
  },
  {
    id: 'mon-005',
    name: 'Database Connection Pool',
    type: 'metric',
    status: 'OK',
    lastTriggered: '2 days ago',
  },
  {
    id: 'mon-006',
    name: 'Memory Usage',
    type: 'metric',
    status: 'OK',
    lastTriggered: '6 hours ago',
  },
  {
    id: 'mon-007',
    name: 'WebSocket Connections',
    type: 'log',
    status: 'OK',
    lastTriggered: '1 day ago',
  },
  {
    id: 'mon-008',
    name: 'Certificate Expiry',
    type: 'service',
    status: 'OK',
    lastTriggered: '7 days ago',
  },
]

const MOCK_ENV_VARS: EnvVar[] = [
  {
    key: 'DD_AGENT_HOST',
    value: 'localhost',
    description: 'Datadog agent hostname',
  },
  {
    key: 'DD_TRACE_ENABLED',
    value: 'true',
    description: 'Enable APM tracing',
  },
  {
    key: 'DD_SERVICE',
    value: 'vibecode',
    description: 'Default service name',
  },
  {
    key: 'DD_ENV',
    value: 'production',
    description: 'Environment tag',
  },
  {
    key: 'DD_VERSION',
    value: '6.3.0',
    description: 'Application version tag',
  },
  {
    key: 'DD_LOGS_INJECTION',
    value: 'true',
    description: 'Inject trace IDs into logs',
  },
  {
    key: 'DD_TRACE_SAMPLE_RATE',
    value: '1.0',
    description: 'Trace sampling rate (0.0 - 1.0)',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

function latencyColor(ms: number): string {
  if (ms < 100) return 'text-green-600 dark:text-green-400'
  if (ms < 500) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function errorRateColor(rate: number): string {
  if (rate < 0.1) return 'text-green-600 dark:text-green-400'
  if (rate < 0.5) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function statusBadge(status: 'healthy' | 'degraded' | 'down'): string {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'
  switch (status) {
    case 'healthy':
      return `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`
    case 'degraded':
      return `${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400`
    case 'down':
      return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`
  }
}

function monitorStatusBadge(status: MonitorStatus): string {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'
  switch (status) {
    case 'OK':
      return `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`
    case 'Warn':
      return `${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400`
    case 'Alert':
      return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`
  }
}

function monitorTypeBadge(type: MonitorType): string {
  const base = 'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium'
  switch (type) {
    case 'metric':
      return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400`
    case 'service':
      return `${base} bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400`
    case 'log':
      return `${base} bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400`
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DatadogIntegrationPage() {
  const [showApiKey, setShowApiKey] = useState(false)
  const [showEnvValues, setShowEnvValues] = useState(false)

  const maskedApiKey = showApiKey ? 'dd-api-8f3b-2a1c-9e4d-7b6f' : 'dd-api-****-****'

  return (
    <div className="space-y-6">
      <DemoBanner />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <Link
          href="/monitoring"
          className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          Monitoring
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 dark:text-gray-100 font-medium">Datadog Integration</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Zap className="h-7 w-7" />
            Datadog Integration
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            APM, logs, metrics, and DogStatsD observability integration
          </p>
        </div>
        <a
          href="https://app.datadoghq.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Open Datadog Dashboard
        </a>
      </div>

      {/* Connection Status Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-green-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Connection Status
          </h2>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            Connected
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
              Agent Status
            </p>
            <p className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Connected
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
              API Key
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-mono text-gray-900 dark:text-gray-100">{maskedApiKey}</p>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
              Site
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">datadoghq.com</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
              Last Sync
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              2 min ago
            </p>
          </div>
        </div>
      </div>

      {/* Integration Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <IntegrationMetricCard
          label="APM Traces"
          value="12.4K"
          unit="/day"
          icon={<Activity className="h-5 w-5 text-blue-500" />}
        />
        <IntegrationMetricCard
          label="Log Events"
          value="45.8K"
          unit="/day"
          icon={<FileText className="h-5 w-5 text-purple-500" />}
        />
        <IntegrationMetricCard
          label="Custom Metrics"
          value="23"
          unit="active"
          icon={<BarChart3 className="h-5 w-5 text-indigo-500" />}
        />
        <IntegrationMetricCard
          label="Monitors"
          value="8"
          unit="configured"
          icon={<Bell className="h-5 w-5 text-orange-500" />}
        />
      </div>

      {/* Services Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            Traced Services
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {MOCK_SERVICES.length} services reporting APM traces
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Service
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Environment
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Traces/min
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Error Rate
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  P95 Latency
                </th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {MOCK_SERVICES.map((svc) => (
                <tr
                  key={svc.name}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-900 dark:text-gray-100">
                    {svc.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {svc.environment}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                    {svc.tracesPerMin}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${errorRateColor(svc.errorRate)}`}>
                    {svc.errorRate.toFixed(2)}%
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${latencyColor(svc.p95Latency)}`}>
                    {formatLatency(svc.p95Latency)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={statusBadge(svc.status)}>
                      {svc.status === 'healthy' && <CheckCircle className="h-3 w-3" />}
                      {svc.status === 'degraded' && <Activity className="h-3 w-3" />}
                      {svc.status === 'down' && <XCircle className="h-3 w-3" />}
                      {svc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Monitors */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-500" />
            Active Monitors
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {MOCK_MONITORS.length} monitors configured &middot;{' '}
            {MOCK_MONITORS.filter((m) => m.status === 'OK').length} OK &middot;{' '}
            {MOCK_MONITORS.filter((m) => m.status === 'Warn').length} Warning &middot;{' '}
            {MOCK_MONITORS.filter((m) => m.status === 'Alert').length} Alerting
          </p>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {MOCK_MONITORS.map((monitor) => (
            <div
              key={monitor.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {monitor.name}
                    </span>
                    <span className={monitorTypeBadge(monitor.type)}>{monitor.type}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last triggered: {monitor.lastTriggered}
                  </p>
                </div>
              </div>
              <span className={monitorStatusBadge(monitor.status)}>
                {monitor.status === 'OK' && <CheckCircle className="h-3 w-3" />}
                {monitor.status === 'Warn' && <Activity className="h-3 w-3" />}
                {monitor.status === 'Alert' && <XCircle className="h-3 w-3" />}
                {monitor.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-500" />
              Configuration
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Environment variables for Datadog agent and APM
            </p>
          </div>
          <button
            onClick={() => setShowEnvValues(!showEnvValues)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            {showEnvValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showEnvValues ? 'Hide Values' : 'Show Values'}
          </button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {MOCK_ENV_VARS.map((envVar) => (
            <div
              key={envVar.key}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <code className="text-sm font-mono font-medium text-blue-600 dark:text-blue-400">
                  {envVar.key}
                </code>
                <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
                  {envVar.description}
                </span>
              </div>
              <code className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                {showEnvValues ? envVar.value : '********'}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* VSCode Extension Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Code className="h-6 w-6 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                VSCode Extension
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                VibeCode Datadog integration for VS Code
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            Active
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
              Version
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">v2.0.0</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
              Commands
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">19 registered</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
              Connection
            </p>
            <p className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              Connected
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function IntegrationMetricCard({
  label,
  value,
  unit,
  icon,
}: {
  label: string
  value: string
  unit: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">{unit}</span>
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
