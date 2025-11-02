'use client'

import { useEffect } from 'react'
import RUMMonitoring from '@/lib/monitoring/rum-client'

/**
 * RUM Initializer Component
 * Initializes Datadog RUM with Core Web Vitals tracking
 * This component should be placed in the root layout to ensure
 * RUM is initialized as early as possible in the application lifecycle
 */
export default function RUMInitializer() {
  useEffect(() => {
    // Initialize RUM with automatic tracking
    // This will:
    // 1. Initialize Datadog RUM SDK
    // 2. Set up Core Web Vitals tracking (LCP, FID, CLS)
    // 3. Set up automatic event tracking
    // 4. Start session replay recording (if configured)
    RUMMonitoring.initializeWithTracking()
  }, [])

  // This component doesn't render anything
  return null
}
