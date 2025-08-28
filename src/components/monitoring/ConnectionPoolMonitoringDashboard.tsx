/**
 * Connection Pool Monitoring Dashboard
 * Provides real-time monitoring of database connection pools
 * with detailed metrics, alerts, and visualization
 */

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'

interface ConnectionPoolStatus {
  size: number
  inUse: number
  maxSize: number
  minSize: number
  available: number
  utilization: number
  configuration: {
    idleTimeout: number
    connectionTimeout: number
    acquireTimeout: number
    enableDynamicSizing: boolean
    enableConnectionValidation: boolean
  }
  metrics: {
    totalConnections: number
    peakConnections: number
    totalAcquires: number
    acquireSuccesses: number
    acquireFailures: number
    acquireTimeAvg: number
    connectionValidations: number
    connectionValidationFailures: number
    dynamicPoolAdjustments: number
  }
}

interface ConnectionDetail {
  key: string
  ageMs: number
  idleTimeMs: number
  timeSinceValidationMs: number
  inUse: boolean
}

interface DetailedConnectionPoolInfo {
  status: ConnectionPoolStatus
  connections: ConnectionDetail[]
}

interface AgeDistribution {
  [key: string]: number
}

interface IdleTimeDistribution {
  [key: string]: number
}

interface TimeSeriesData {
  timestamps: string[]
  connections: number[]
  active: number[]
  responseTime: number[]
  errors: number[]
}

interface Utilization {
  current: number
  capacity: number
  acquisitionSuccess: number
  connectionValidation: {
    success: number
    failure: number
  }
}

interface PoolMetricsResponse {
  poolStatus: ConnectionPoolStatus
  detailedPoolInfo: DetailedConnectionPoolInfo
  utilization: Utilization
  timeSeriesData: TimeSeriesData
  ageDistribution: AgeDistribution
  idleTimeDistribution: IdleTimeDistribution
  timestamp: string
}

interface ConnectionPoolMonitoringDashboardProps {
  refreshInterval?: number
  showThresholdAlerts?: boolean
  alertThresholds?: {
    utilization: number
    acquireFailureRate: number
    validationFailureRate: number
  }
}

interface HistoricalDataPoint {
  time: string
  connections: number
  active: number
  utilization: number
}

interface Alert {
  type: 'warning' | 'critical'
  message: string
}

const defaultAlertThresholds = {
  utilization: 80, // 80% utilization
  acquireFailureRate: 5, // 5% failure rate
  validationFailureRate: 5 // 5% failure rate
}

export const ConnectionPoolMonitoringDashboard: React.FC<ConnectionPoolMonitoringDashboardProps> = ({
  refreshInterval = 10000,
  showThresholdAlerts = true,
  alertThresholds = defaultAlertThresholds
}) => {
  const [metrics, setMetrics] = useState<PoolMetricsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [showPoolDetails, setShowPoolDetails] = useState<boolean>(false)
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Function to fetch metrics
    const fetchMetrics = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/health/database/metrics')
        
        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`)
        }
        
        const data: PoolMetricsResponse = await response.json()
        setMetrics(data)
        
        // Update historical data
        setHistoricalData(prev => {
          const newEntry = {
            time: new Date().toLocaleTimeString(),
            connections: data.poolStatus.size,
            active: data.poolStatus.inUse,
            utilization: data.utilization.current
          }
          
          // Keep only the last 20 data points
          const updatedData = [...prev, newEntry]
          if (updatedData.length > 20) {
            return updatedData.slice(updatedData.length - 20)
          }
          return updatedData
        })
        
        // Check for alert conditions
        if (showThresholdAlerts) {
          const newAlerts: Alert[] = []
          
          // Check pool utilization
          if (data.utilization.current > alertThresholds.utilization) {
            newAlerts.push({
              type: data.utilization.current > 95 ? 'critical' : 'warning',
              message: `Connection pool utilization at ${data.utilization.current.toFixed(1)}%`
            })
          }
          
          // Check acquire failure rate
          const acquireFailureRate = (data.poolStatus.metrics.acquireFailures / 
            Math.max(data.poolStatus.metrics.totalAcquires, 1)) * 100
          
          if (acquireFailureRate > alertThresholds.acquireFailureRate) {
            newAlerts.push({
              type: acquireFailureRate > 20 ? 'critical' : 'warning',
              message: `Connection acquire failure rate at ${acquireFailureRate.toFixed(1)}%`
            })
          }
          
          // Check validation failure rate
          const validationFailureRate = data.poolStatus.metrics.connectionValidationFailures / 
            Math.max(data.poolStatus.metrics.connectionValidations, 1) * 100
          
          if (validationFailureRate > alertThresholds.validationFailureRate) {
            newAlerts.push({
              type: validationFailureRate > 20 ? 'critical' : 'warning',
              message: `Connection validation failure rate at ${validationFailureRate.toFixed(1)}%`
            })
          }
          
          setAlerts(newAlerts)
        }
        
        setError(null)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
        setLoading(false)
      }
    }
    
    // Fetch metrics immediately
    fetchMetrics()
    
    // Set up interval for refreshing
    refreshTimerRef.current = setInterval(fetchMetrics, refreshInterval)
    
    // Clean up on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [refreshInterval, showThresholdAlerts, alertThresholds])
  
  if (loading && !metrics) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="p-4 border-l-4 border-red-500 bg-red-50 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error fetching connection pool metrics</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (!metrics) {
    return null
  }
  
  // Create age distribution data for chart
  const ageDistributionData = Object.entries(metrics.ageDistribution).map(([range, count]) => ({
    name: range,
    value: count
  }))
  
  // Create idle time distribution data for chart
  const idleTimeDistributionData = Object.entries(metrics.idleTimeDistribution).map(([range, count]) => ({
    name: range,
    value: count
  }))
  
  // Format duration in milliseconds to human-readable format
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
    return `${(ms / 3600000).toFixed(1)}h`
  }
  
  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-semibold text-gray-800">Database Connection Pool Monitoring</h2>
        <div className="flex justify-between items-center mt-2">
          <div className="text-sm text-gray-500">
            Last updated: {new Date(metrics.timestamp).toLocaleString()}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowPoolDetails(!showPoolDetails)}
              className="px-3 py-1 text-sm rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
            >
              {showPoolDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div 
              key={index}
              className={`p-3 rounded-md ${
                alert.type === 'critical' ? 'bg-red-50 border-l-4 border-red-500' : 'bg-yellow-50 border-l-4 border-yellow-500'
              }`}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className={`h-5 w-5 ${alert.type === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${
                    alert.type === 'critical' ? 'text-red-800' : 'text-yellow-800'
                  }`}>
                    {alert.type === 'critical' ? 'Critical' : 'Warning'}
                  </h3>
                  <div className={`mt-1 text-sm ${
                    alert.type === 'critical' ? 'text-red-700' : 'text-yellow-700'
                  }`}>
                    {alert.message}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Connection Pool Size</h3>
          <div className="flex justify-between">
            <div>
              <div className="text-2xl font-semibold text-blue-600">
                {metrics.poolStatus.size}
              </div>
              <div className="text-xs text-blue-500">Current Pool Size</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-blue-600">
                {metrics.poolStatus.maxSize}
              </div>
              <div className="text-xs text-blue-500">Max Size</div>
            </div>
          </div>
          <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                metrics.utilization.capacity > 80 ? 'bg-yellow-500' : 'bg-blue-600'
              }`}
              style={{ width: `${metrics.utilization.capacity}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-blue-600 text-right">
            {metrics.utilization.capacity.toFixed(1)}% of max capacity
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-800 mb-2">Connections In Use</h3>
          <div className="flex justify-between">
            <div>
              <div className="text-2xl font-semibold text-green-600">
                {metrics.poolStatus.inUse}
              </div>
              <div className="text-xs text-green-500">In Use</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-green-600">
                {metrics.poolStatus.size - metrics.poolStatus.inUse}
              </div>
              <div className="text-xs text-green-500">Idle</div>
            </div>
          </div>
          <div className="mt-2 h-2 bg-green-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                metrics.utilization.current > 80 ? 'bg-yellow-500' : 
                metrics.utilization.current > 95 ? 'bg-red-500' : 'bg-green-600'
              }`}
              style={{ width: `${metrics.utilization.current}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-green-600 text-right">
            {metrics.utilization.current.toFixed(1)}% utilization
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-purple-800 mb-2">Connection Performance</h3>
          <div className="text-2xl font-semibold text-purple-600">
            {metrics.poolStatus.metrics.acquireTimeAvg.toFixed(2)}ms
          </div>
          <div className="text-xs text-purple-500">Avg Acquisition Time</div>
          <div className="mt-2 text-sm">
            <div className="flex justify-between text-xs">
              <span className="text-purple-600">Successful:</span>
              <span className="font-medium">{metrics.poolStatus.metrics.acquireSuccesses}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-purple-600">Failed:</span>
              <span className="font-medium">{metrics.poolStatus.metrics.acquireFailures}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-purple-600">Success Rate:</span>
              <span className="font-medium">
                {(metrics.utilization.acquisitionSuccess).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-orange-800 mb-2">Connection Health</h3>
          <div className="text-2xl font-semibold text-orange-600">
            {metrics.poolStatus.metrics.connectionValidations}
          </div>
          <div className="text-xs text-orange-500">Validations Performed</div>
          <div className="mt-2 text-sm">
            <div className="flex justify-between text-xs">
              <span className="text-orange-600">Failed Validations:</span>
              <span className="font-medium">{metrics.poolStatus.metrics.connectionValidationFailures}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-orange-600">Dynamic Adjustments:</span>
              <span className="font-medium">{metrics.poolStatus.metrics.dynamicPoolAdjustments}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-orange-600">Peak Connections:</span>
              <span className="font-medium">{metrics.poolStatus.metrics.peakConnections}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Historical Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Connection Pool Usage Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={historicalData}
                margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="connections" 
                  stroke="#3B82F6" 
                  name="Pool Size" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="active" 
                  stroke="#10B981" 
                  name="In Use" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="utilization" 
                  stroke="#F59E0B" 
                  name="Utilization %" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Connection Age Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ageDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {ageDistributionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} connections`, `Age: ${name}`]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Pool Details - Show when expanded */}
      {showPoolDetails && (
        <>
          <div className="border-t border-gray-200 mt-6 pt-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Connection Pool Details</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                <h4 className="text-md font-medium text-gray-700 mb-3">Pool Configuration</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Min Size:</span>
                    <span className="font-medium">{metrics.poolStatus.minSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max Size:</span>
                    <span className="font-medium">{metrics.poolStatus.maxSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Idle Timeout:</span>
                    <span className="font-medium">{formatDuration(metrics.poolStatus.configuration.idleTimeout)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Connection Timeout:</span>
                    <span className="font-medium">{formatDuration(metrics.poolStatus.configuration.connectionTimeout)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Acquire Timeout:</span>
                    <span className="font-medium">{formatDuration(metrics.poolStatus.configuration.acquireTimeout)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dynamic Sizing:</span>
                    <span className={`font-medium ${metrics.poolStatus.configuration.enableDynamicSizing ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.poolStatus.configuration.enableDynamicSizing ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Connection Validation:</span>
                    <span className={`font-medium ${metrics.poolStatus.configuration.enableConnectionValidation ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.poolStatus.configuration.enableConnectionValidation ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                <h4 className="text-md font-medium text-gray-700 mb-3">Connection Idle Time Distribution</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={idleTimeDistributionData}
                      margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" name="Connections" fill="#8884d8">
                        {idleTimeDistributionData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            {/* Individual Connection Details */}
            <div className="mt-6">
              <h4 className="text-md font-medium text-gray-700 mb-3">Individual Connections</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Idle Time</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Validation</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {metrics.detailedPoolInfo.connections.map((conn, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{conn.key}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDuration(conn.ageMs)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDuration(conn.idleTimeMs)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDuration(conn.timeSinceValidationMs)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            conn.inUse 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {conn.inUse ? 'In Use' : 'Idle'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* Performance Recommendations */}
          <div className="border-t border-gray-200 mt-6 pt-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Performance Recommendations</h3>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-blue-800 mb-2">Recommendations</h4>
              <ul className="list-disc pl-5 space-y-2 text-sm text-blue-700">
                {metrics.utilization.current > 80 && (
                  <li>
                    <strong>High utilization detected ({metrics.utilization.current.toFixed(1)}%).</strong> Consider increasing the maximum pool size from {metrics.poolStatus.maxSize} to {Math.ceil(metrics.poolStatus.maxSize * 1.5)}.
                  </li>
                )}
                {metrics.poolStatus.size < metrics.poolStatus.minSize && (
                  <li>
                    <strong>Pool size below minimum.</strong> Current size ({metrics.poolStatus.size}) is below configured minimum ({metrics.poolStatus.minSize}). Check for connection leaks.
                  </li>
                )}
                {metrics.poolStatus.metrics.acquireFailures > 0 && (
                  <li>
                    <strong>Connection acquisition failures detected.</strong> {metrics.poolStatus.metrics.acquireFailures} failures out of {metrics.poolStatus.metrics.totalAcquires} attempts. Check for network issues or database overload.
                  </li>
                )}
                {metrics.poolStatus.metrics.connectionValidationFailures > 0 && (
                  <li>
                    <strong>Connection validation failures detected.</strong> {metrics.poolStatus.metrics.connectionValidationFailures} validation failures. Check for intermittent database connectivity issues.
                  </li>
                )}
                {metrics.utilization.current < 20 && metrics.poolStatus.size > metrics.poolStatus.minSize * 2 && (
                  <li>
                    <strong>Pool potentially oversized.</strong> Low utilization ({metrics.utilization.current.toFixed(1)}%) with large pool. Consider reducing maximum pool size or enabling dynamic sizing.
                  </li>
                )}
                {metrics.poolStatus.configuration.idleTimeout > 300000 && (
                  <li>
                    <strong>Long idle timeout.</strong> Current setting ({formatDuration(metrics.poolStatus.configuration.idleTimeout)}) may lead to resource waste. Consider reducing to 5 minutes for more efficient resource usage.
                  </li>
                )}
                {!metrics.poolStatus.configuration.enableDynamicSizing && (
                  <li>
                    <strong>Dynamic sizing disabled.</strong> Enable dynamic sizing for better resource utilization in variable load environments.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ConnectionPoolMonitoringDashboard