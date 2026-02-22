/**
 * WebSocket Monitoring Page
 * Real-time dashboard for monitoring WebSocket connections
 */

import React from 'react'
import { Metadata } from 'next'
import WebSocketDashboard from '@/components/monitoring/WebSocketDashboard'
import WebSocketAlerts from './alerts'

export default function WebSocketMonitoringPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">WebSocket Monitoring</h1>
        <p className="text-gray-600 mt-2">
          Real-time monitoring of WebSocket connections, health status, and performance metrics.
        </p>
      </div>

      <WebSocketDashboard />

      <div className="mt-8">
        <WebSocketAlerts />
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'WebSocket Monitoring | VibeCode',
  description: 'Real-time monitoring dashboard for WebSocket connections'
}
