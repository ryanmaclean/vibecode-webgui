/**
 * AI Usage Monitoring Page
 * Real-time dashboard for monitoring AI usage and costs
 */

import React from 'react'
import { Metadata } from 'next'
import AIUsageDashboard from '@/components/monitoring/AIUsageDashboard'
import AIUsageAlerts from './alerts'

export default function AIUsageMonitoringPage() {
  // Datadog dashboard configuration
  // Replace with actual Datadog dashboard URL from your Datadog account
  const datadogDashboardUrl = process.env.NEXT_PUBLIC_DATADOG_DASHBOARD_URL ||
    'https://app.datadoghq.com/dashboard/ai-operations?theme=dark&embed=true&from_ts=0&to_ts=0&live=true'

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AI Usage Monitoring</h1>
        <p className="text-gray-600 mt-2">
          Real-time monitoring of AI usage, token consumption, and cost tracking.
        </p>
      </div>

      {/* Native Dashboard Components */}
      <AIUsageDashboard />

      {/* Datadog Dashboard Embed */}
      <div className="mt-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900">Datadog AI Operations Dashboard</h2>
            <p className="text-sm text-gray-600 mt-1">
              Real-time metrics and visualizations from Datadog
            </p>
          </div>
          <div className="relative w-full" style={{ height: '800px' }}>
            <iframe
              src={datadogDashboardUrl}
              className="absolute inset-0 w-full h-full"
              frameBorder="0"
              title="Datadog AI Operations Dashboard"
              allow="clipboard-write"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
        </div>
      </div>

      {/* AI Usage Alerts */}
      <div className="mt-8">
        <AIUsageAlerts />
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'AI Usage Monitoring | VibeCode',
  description: 'Real-time monitoring dashboard for AI usage and costs'
}
