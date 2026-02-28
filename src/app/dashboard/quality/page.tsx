/**
 * AI Quality Metrics Dashboard Page
 * Real-time dashboard for monitoring AI suggestion quality and performance
 */

import React from 'react'
import { Metadata } from 'next'
import QualityDashboard from '@/components/ai/QualityDashboard'

export default function QualityDashboardPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AI Quality Metrics</h1>
        <p className="text-gray-600 mt-2">
          Monitor AI suggestion quality, acceptance rates, and model performance with real-time degradation alerts.
        </p>
      </div>

      <QualityDashboard />
    </div>
  )
}

export const metadata: Metadata = {
  title: 'AI Quality Metrics | VibeCode',
  description: 'Real-time dashboard for AI quality tracking and performance monitoring'
}
