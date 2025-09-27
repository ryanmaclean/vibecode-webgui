/**
 * Monitoring Dashboard Settings Component
 * Shows user permissions and allows configuration based on role
 */

'use client'

import React, { useState } from 'react'
import { useMonitoringPermissions } from '@/lib/monitoring/rbac'

interface MonitoringSettingsProps {
  onSettingsChange?: (settings: Record<string, unknown>) => void
}

export const MonitoringSettings: React.FC<MonitoringSettingsProps> = ({
  onSettingsChange
}) => {
  const { permissions, role, hasPermission, dashboardConfig } = useMonitoringPermissions()
  const [testStatus, setTestStatus] = useState<string | null>(null)

  const handleTestNotifications = async () => {
    if (!hasPermission('manageNotifications')) {
      setTestStatus('❌ Insufficient permissions to test notifications')
      return
    }

    try {
      setTestStatus('🔄 Testing notifications...')
      
      const response = await fetch('/api/monitoring/notifications?action=test')
      const result = await response.json()
      
      if (result.success) {
        const testResults = Object.entries(result.testResults)
          .map(([channel, success]) => `${channel}: ${success ? '✅' : '❌'}`)
          .join(', ')
        setTestStatus(`✅ Test completed: ${testResults}`)
      } else {
        setTestStatus(`❌ Test failed: ${result.error}`)
      }
    } catch (error) {
      setTestStatus(`❌ Error: ${(error as Error).message}`)
    }

    // Clear status after 5 seconds
    setTimeout(() => setTestStatus(null), 5000)
  }

  const handleSendTestAlert = async () => {
    if (!hasPermission('manageNotifications')) {
      setTestStatus('❌ Insufficient permissions to send test alerts')
      return
    }

    try {
      setTestStatus('🔄 Sending test alert...')
      
      const response = await fetch('/api/monitoring/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-alert' })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setTestStatus('✅ Test alert sent successfully')
      } else {
        setTestStatus(`❌ Failed to send test alert: ${result.error}`)
      }
    } catch (error) {
      setTestStatus(`❌ Error: ${(error as Error).message}`)
    }

    // Clear status after 5 seconds
    setTimeout(() => setTestStatus(null), 5000)
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-800">Monitoring Dashboard Settings</h3>
        <p className="text-sm text-gray-600 mt-1">
          Configure monitoring features based on your permissions
        </p>
      </div>

      {/* User Role and Permissions */}
      <div className="space-y-4">
        <div>
          <h4 className="text-md font-medium text-gray-700">Your Access Level</h4>
          <div className="mt-2 flex items-center space-x-2">
            <span className={`px-3 py-1 text-sm rounded-full ${
              role === 'admin' ? 'bg-red-100 text-red-800' :
              role === 'operator' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {role.toUpperCase()}
            </span>
          </div>
        </div>

        <div>
          <h4 className="text-md font-medium text-gray-700">Available Features</h4>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {Object.entries(permissions).map(([permission, allowed]) => (
              <div key={permission} className="flex items-center space-x-2">
                <span className={`text-sm ${allowed ? 'text-green-600' : 'text-gray-400'}`}>
                  {allowed ? '✅' : '❌'}
                </span>
                <span className={`text-sm ${allowed ? 'text-gray-800' : 'text-gray-500'}`}>
                  {permission.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dashboard Configuration */}
      {dashboardConfig.canModifySettings && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-700">Dashboard Configuration</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Real-time Updates */}
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  className="mr-2"
                  disabled={!permissions.viewMetrics}
                />
                <span className="text-sm">Enable Real-time Updates</span>
              </label>
            </div>

            {/* Alert Thresholds */}
            {permissions.configureAlerts && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Pool Utilization Alert (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  defaultValue="80"
                  className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notification Management */}
      {permissions.manageNotifications && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-700">Notification Management</h4>
          
          <div className="flex space-x-4">
            <button
              onClick={handleTestNotifications}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={testStatus?.includes('🔄')}
            >
              Test All Channels
            </button>
            
            <button
              onClick={handleSendTestAlert}
              className="px-4 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 disabled:opacity-50"
              disabled={testStatus?.includes('🔄')}
            >
              Send Test Alert
            </button>
          </div>

          {testStatus && (
            <div className={`p-3 rounded-md text-sm ${
              testStatus.includes('❌') ? 'bg-red-50 text-red-800 border border-red-200' :
              testStatus.includes('🔄') ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
              'bg-green-50 text-green-800 border border-green-200'
            }`}>
              {testStatus}
            </div>
          )}
        </div>
      )}

      {/* Export Options */}
      {permissions.exportData && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-700">Data Export</h4>
          <div className="flex space-x-4">
            <button className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700">
              Export Metrics (CSV)
            </button>
            <button className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700">
              Export Alert History
            </button>
          </div>
        </div>
      )}

      {/* Access Limitations */}
      {role === 'viewer' && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h5 className="text-sm font-medium text-blue-800">Limited Access Notice</h5>
          <p className="text-sm text-blue-700 mt-1">
            You have read-only access to the monitoring dashboard. Contact your administrator to request additional permissions.
          </p>
        </div>
      )}
    </div>
  )
}