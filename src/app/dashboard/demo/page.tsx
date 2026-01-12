/**
 * Dashboard Demo Page
 * Showcases the Enhanced Monitoring Dashboard widgets
 *
 * AGENT 92: Enhanced Monitoring Dashboards Foundation
 */

import { SystemHealthWidget } from '@/components/dashboard/SystemHealthWidget'

export const metadata = {
  title: 'Monitoring Dashboard Demo',
  description: 'Demo page for Enhanced Monitoring Dashboard features'
}

export default function DashboardDemo() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Monitoring Dashboard (Demo)
          </h1>
          <p className="text-gray-600">
            Foundation for enhanced monitoring features - showcasing real-time system health tracking
          </p>
        </div>

        {/* Feature Overview */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-900 mb-3">
            Feature Foundation: Enhanced Monitoring Dashboards
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <h3 className="font-semibold mb-2">Implemented (v1.0):</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Real-time system health monitoring</li>
                <li>Database, cache, and AI service status</li>
                <li>Performance metrics tracking</li>
                <li>System resource monitoring</li>
                <li>Auto-refresh every 30 seconds</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Future Enhancements:</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Advanced performance graphs</li>
                <li>Historical data visualization</li>
                <li>Real-time WebSocket updates</li>
                <li>Customizable widget layout</li>
                <li>Alert notifications</li>
              </ul>
            </div>
          </div>
        </div>

        {/* API Endpoints Info */}
        <div className="bg-white rounded-lg shadow border p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Available API Endpoints
          </h2>
          <div className="space-y-3">
            <div className="flex items-start border-b pb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-3">
                GET
              </span>
              <div className="flex-1">
                <code className="text-sm font-mono text-gray-900">/api/dashboard/overview</code>
                <p className="text-sm text-gray-600 mt-1">
                  Aggregated system health and performance overview
                </p>
              </div>
            </div>
            <div className="flex items-start border-b pb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-3">
                GET
              </span>
              <div className="flex-1">
                <code className="text-sm font-mono text-gray-900">/api/dashboard/performance?range=1h</code>
                <p className="text-sm text-gray-600 mt-1">
                  Performance metrics over time (1h, 6h, 24h, 7d)
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-3">
                GET
              </span>
              <div className="flex-1">
                <code className="text-sm font-mono text-gray-900">/api/dashboard/status</code>
                <p className="text-sm text-gray-600 mt-1">
                  System status, version, and deployment information
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Widget Grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* System Health Widget */}
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                System Health Widget
              </h2>
              <p className="text-sm text-gray-600">
                Real-time monitoring of critical system services
              </p>
            </div>
            <SystemHealthWidget />
          </div>

          {/* Placeholder for future widgets */}
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                Future Widgets
              </h2>
              <p className="text-sm text-gray-600">
                Additional widgets to be implemented
              </p>
            </div>
            <div className="bg-white rounded-lg shadow border p-6">
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-semibold text-gray-900">Performance Graph Widget</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Real-time line charts showing response times and throughput
                  </p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="font-semibold text-gray-900">AI Usage Widget</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Track AI model usage, costs, and response times
                  </p>
                </div>
                <div className="border-l-4 border-yellow-500 pl-4">
                  <h3 className="font-semibold text-gray-900">Error Log Widget</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Recent errors and warnings with filtering
                  </p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="font-semibold text-gray-900">Resource Usage Widget</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Detailed CPU, memory, and disk usage graphs
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Implementation Notes */}
        <div className="bg-gray-100 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Implementation Notes
          </h2>
          <div className="prose prose-sm max-w-none text-gray-700">
            <ul className="space-y-2">
              <li>
                <strong>Real-time Updates:</strong> Widget automatically refreshes every 30 seconds (configurable)
              </li>
              <li>
                <strong>Error Handling:</strong> Graceful degradation with error messages if API fails
              </li>
              <li>
                <strong>Loading States:</strong> Skeleton loaders during initial data fetch
              </li>
              <li>
                <strong>Responsive Design:</strong> Adapts to mobile, tablet, and desktop screens
              </li>
              <li>
                <strong>Testing:</strong> Comprehensive unit tests for API routes and UI components
              </li>
              <li>
                <strong>Performance:</strong> Optimized API calls with parallel execution
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Built with Next.js 14, React 18, and Tailwind CSS</p>
          <p className="mt-1">AGENT 92: Enhanced Monitoring Dashboards Foundation</p>
        </div>
      </div>
    </div>
  )
}
