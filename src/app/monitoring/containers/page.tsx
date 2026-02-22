/**
 * Container Monitoring Page
 * Real-time dashboard for monitoring container resource usage
 */

import React from 'react'
import { Metadata } from 'next'
import ContainerMonitoringDashboard from '@/components/monitoring/ContainerMonitoringDashboard'

export default function ContainerMonitoringPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Container Resource Monitoring</h1>
        <p className="text-gray-600 mt-2">
          Real-time monitoring of container CPU, memory, network, and storage usage with alerts.
        </p>
      </div>

      <ContainerMonitoringDashboard />
    </div>
  )
}

export const metadata: Metadata = {
  title: 'Container Monitoring | VibeCode',
  description: 'Real-time monitoring dashboard for container resource usage'
}
