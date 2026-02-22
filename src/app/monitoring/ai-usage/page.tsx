/**
 * AI Usage Monitoring Page
 * Real-time dashboard for monitoring AI usage and costs
 */

import React from 'react'
import { Metadata } from 'next'
import AIUsageDashboard from '@/components/monitoring/AIUsageDashboard'
import AIUsageAlerts from './alerts'

export default function AIUsageMonitoringPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AI Usage Monitoring</h1>
        <p className="text-gray-600 mt-2">
          Real-time monitoring of AI usage, token consumption, and cost tracking.
        </p>
      </div>

      <AIUsageDashboard />

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
