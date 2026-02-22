'use client'

import { useEffect } from 'react'
import { initializeBrowserTelemetry } from '@/lib/monitoring/browser-telemetry'

/**
 * Client component that initializes OpenTelemetry browser instrumentation
 * on mount. This component should be included in the app layout.
 */
export default function BrowserTelemetryInit() {
  useEffect(() => {
    // Initialize browser telemetry on client-side mount
    try {
      const provider = initializeBrowserTelemetry()

      if (provider) {
        // Add performance marks for initial page load
        if (typeof window !== 'undefined' && window.performance) {
          window.performance.mark('otel-browser-initialized')
        }
      }
    } catch (error) {
      // Silent fail - telemetry is optional
      console.warn('⚠️ Failed to initialize browser telemetry:', error)
    }
  }, [])

  // This component doesn't render anything
  return null
}
