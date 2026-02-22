/**
 * Rate Limit Monitoring Page
 * Real-time dashboard for monitoring rate limiting metrics
 */

import React from 'react'
import { Metadata } from 'next'
import RateLimitDashboard from '@/components/monitoring/RateLimitDashboard'
import RateLimitAlerts from '@/components/monitoring/RateLimitAlerts'

export default function RateLimitMonitoringPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Rate Limit Monitoring</h1>
        <p className="text-gray-600 mt-2">
          Real-time monitoring of rate limiting, quota usage, and throttling metrics.
        </p>
      </div>

      <RateLimitDashboard />

      <div className="mt-8">
        <RateLimitAlerts />
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'Rate Limit Monitoring | VibeCode',
  description: 'Real-time monitoring dashboard for rate limiting and quota management'
}
