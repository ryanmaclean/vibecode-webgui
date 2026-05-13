'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DemoBanner } from '@/components/ui/DemoBanner'
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  Clock,
  Filter,
  ChevronRight,
  BellOff,
  Eye,
  Settings,
  X,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'info'
type AlertStatus = 'active' | 'acknowledged' | 'resolved'

interface Alert {
  id: string
  title: string
  message: string
  severity: Severity
  status: AlertStatus
  source: string
  triggeredAt: string
  acknowledgedAt?: string
  resolvedAt?: string
  rule: string
}

interface AlertRule {
  id: string
  name: string
  description: string
  severity: Severity
  enabled: boolean
  condition: string
  category: 'service' | 'budget' | 'performance' | 'resource'
}

// ── Helpers ────────────────────────────────────────────────────────────────

function severityIcon(severity: Severity, className?: string) {
  const cn = className ?? 'h-4 w-4'
  switch (severity) {
    case 'critical':
      return <AlertCircle className={cn} />
    case 'warning':
      return <AlertTriangle className={cn} />
    case 'info':
      return <Info className={cn} />
  }
}

function severityBadge(severity: Severity) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'
  switch (severity) {
    case 'critical':
      return `${base} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400`
    case 'warning':
      return `${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400`
    case 'info':
      return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400`
  }
}

function statusBadge(status: AlertStatus) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'
  switch (status) {
    case 'active':
      return `${base} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`
    case 'acknowledged':
      return `${base} bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400`
    case 'resolved':
      return `${base} bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400`
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

// ── Component ──────────────────────────────────────────────────────────────

type Tab = 'active' | 'history' | 'rules'

export default function MonitoringAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('active')
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [poolAlertStatus, setPoolAlertStatus] = useState<string | null>(null)

  // Fetch alerts and rules from API
  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/monitoring/alerts')
      if (!res.ok) {
        throw new Error(`Failed to fetch alerts (${res.status})`)
      }
      const data = await res.json()
      setAlerts(data.alerts ?? [])
      setRules(data.rules ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // Fetch pool alerts API status on mount
  useEffect(() => {
    fetch('/api/monitoring/pool-alerts')
      .then((res) => res.json())
      .then((data) => setPoolAlertStatus(data.status ?? 'unknown'))
      .catch(() => setPoolAlertStatus('error'))
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────

  const handleAcknowledge = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: 'acknowledged' as AlertStatus, acknowledgedAt: new Date().toISOString() }
          : a
      )
    )
  }, [])

  const handleResolve = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: 'resolved' as AlertStatus, resolvedAt: new Date().toISOString() }
          : a
      )
    )
  }, [])

  const handleSnooze = useCallback((id: string) => {
    // In production this would set a snooze timer; here we just acknowledge
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: 'acknowledged' as AlertStatus, acknowledgedAt: new Date().toISOString() }
          : a
      )
    )
  }, [])

  // ── Filtered views ─────────────────────────────────────────────────────

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    return true
  })

  const activeAlerts = filteredAlerts.filter((a) => a.status !== 'resolved')
  const historyAlerts = filteredAlerts.slice().sort(
    (a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
  )

  const counts = {
    active: alerts.filter((a) => a.status === 'active').length,
    acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
    resolved: alerts.filter((a) => a.status === 'resolved').length,
    critical: alerts.filter((a) => a.severity === 'critical' && a.status !== 'resolved').length,
  }

  // ── Render ─────────────────────────────────────────────────────────────

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
        <span className="text-gray-900 dark:text-gray-100 font-medium">Alerts</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Bell className="h-7 w-7" />
            Alerts
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Service health, budget, and performance alert management
          </p>
        </div>
        <div className="flex items-center gap-3">
          {poolAlertStatus && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  poolAlertStatus === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              Pool alerts: {poolAlertStatus}
            </span>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-12 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading alerts...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
          <button
            onClick={fetchAlerts}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && !error && (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            label="Critical"
            value={counts.critical}
            icon={<AlertCircle className="h-5 w-5 text-red-500" />}
            className="border-red-200 dark:border-red-800"
          />
          <SummaryCard
            label="Active"
            value={counts.active}
            icon={<Bell className="h-5 w-5 text-orange-500" />}
            className="border-orange-200 dark:border-orange-800"
          />
          <SummaryCard
            label="Acknowledged"
            value={counts.acknowledged}
            icon={<Eye className="h-5 w-5 text-yellow-500" />}
            className="border-yellow-200 dark:border-yellow-800"
          />
          <SummaryCard
            label="Resolved"
            value={counts.resolved}
            icon={<Check className="h-5 w-5 text-green-500" />}
            className="border-green-200 dark:border-green-800"
          />
        </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Severity:</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as Severity | 'all')}
              className="text-sm border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AlertStatus | 'all')}
              className="text-sm border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          {(severityFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSeverityFilter('all')
                setStatusFilter('all')
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="flex space-x-8">
          {([
            { key: 'active' as Tab, label: 'Active Alerts', count: activeAlerts.length },
            { key: 'history' as Tab, label: 'Alert History', count: historyAlerts.length },
            { key: 'rules' as Tab, label: 'Alert Rules', count: rules.length },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'active' && (
        <div className="space-y-3">
          {activeAlerts.length === 0 ? (
            <EmptyState message="No active alerts matching the current filters." />
          ) : (
            activeAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
                onResolve={handleResolve}
                onSnooze={handleSnooze}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          {historyAlerts.length === 0 ? (
            <EmptyState message="No alerts matching the current filters." />
          ) : (
            historyAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
                onResolve={handleResolve}
                onSnooze={handleSnooze}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="space-y-4">
          {rules.length === 0 ? (
            <EmptyState message="No alert rules configured." />
          ) : (
            (['service', 'budget', 'performance', 'resource'] as const).map((category) => {
              const categoryRules = rules.filter((r) => r.category === category)
              if (categoryRules.length === 0) return null
              return (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    {category === 'service'
                      ? 'Service Health'
                      : category === 'budget'
                        ? 'Budget Alerts'
                        : category === 'performance'
                          ? 'Performance'
                          : 'Resource Usage'}
                  </h3>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                    {categoryRules.map((rule) => (
                      <RuleRow key={rule.id} rule={rule} />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  className,
}: {
  label: string
  value: number
  icon: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`bg-white dark:bg-gray-900 border rounded-lg p-4 flex items-center gap-3 ${className ?? 'border-gray-200 dark:border-gray-800'}`}
    >
      {icon}
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  )
}

function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  onSnooze,
}: {
  alert: Alert
  onAcknowledge: (id: string) => void
  onResolve: (id: string) => void
  onSnooze: (id: string) => void
}) {
  return (
    <div
      data-testid={`alert-${alert.id}`}
      className={`bg-white dark:bg-gray-900 border rounded-lg p-4 ${
        alert.severity === 'critical'
          ? 'border-red-200 dark:border-red-800 border-l-4 border-l-red-500'
          : alert.severity === 'warning'
            ? 'border-yellow-200 dark:border-yellow-800 border-l-4 border-l-yellow-500'
            : 'border-blue-200 dark:border-blue-800 border-l-4 border-l-blue-500'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={severityBadge(alert.severity)}>
              {severityIcon(alert.severity, 'h-3 w-3')}
              {alert.severity}
            </span>
            <span className={statusBadge(alert.status)}>
              {alert.status === 'active' && <Bell className="h-3 w-3" />}
              {alert.status === 'acknowledged' && <Eye className="h-3 w-3" />}
              {alert.status === 'resolved' && <Check className="h-3 w-3" />}
              {alert.status}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(alert.triggeredAt)}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {alert.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{alert.message}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Source: {alert.source}</span>
            <span>Rule: {alert.rule}</span>
            {alert.acknowledgedAt && (
              <span>Acknowledged: {formatTimestamp(alert.acknowledgedAt)}</span>
            )}
            {alert.resolvedAt && <span>Resolved: {formatTimestamp(alert.resolvedAt)}</span>}
          </div>
        </div>

        {/* Actions */}
        {alert.status !== 'resolved' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {alert.status === 'active' && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                title="Acknowledge"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
              >
                <Eye className="h-3.5 w-3.5" />
                Acknowledge
              </button>
            )}
            <button
              onClick={() => onSnooze(alert.id)}
              title="Snooze for 1 hour"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
            >
              <BellOff className="h-3.5 w-3.5" />
              Snooze
            </button>
            <button
              onClick={() => onResolve(alert.id)}
              title="Resolve"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              Resolve
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function RuleRow({ rule }: { rule: AlertRule }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Settings className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{rule.name}</span>
            <span className={severityBadge(rule.severity)}>
              {severityIcon(rule.severity, 'h-3 w-3')}
              {rule.severity}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{rule.description}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
            {rule.condition}
          </p>
        </div>
      </div>
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          rule.enabled
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
        }`}
      >
        {rule.enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-8 text-center">
      <Bell className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  )
}
