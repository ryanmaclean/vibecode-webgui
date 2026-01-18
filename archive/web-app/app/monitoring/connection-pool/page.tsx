/**
 * Connection Pool Monitoring Page
 * Real-time dashboard for monitoring database connection pools
 */

import React from 'react'
import { Metadata } from 'next'
import ConnectionPoolDashboard from '@/components/monitoring/ConnectionPoolDashboard'
import ConnectionPoolAlerts from './alerts'

export default function ConnectionPoolMonitoringPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Connection Pool Monitoring</h1>
        <p className="text-gray-600 mt-2">
          Real-time monitoring of database connection pools, health status, and capacity planning.
        </p>
      </div>
      
      <ConnectionPoolDashboard />
      
      <div className="mt-8">
        <ConnectionPoolAlerts />
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'Connection Pool Monitoring | VibeCode',
  description: 'Real-time monitoring dashboard for database connection pools'
}