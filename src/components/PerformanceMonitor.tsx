'use client';

/**
 * Performance Monitoring Client Component
 * 
 * Initializes Real User Monitoring (RUM) on the client side
 */

import { useEffect } from 'react';
import RUMMonitoring from '@/lib/monitoring/rum-client';

export function PerformanceMonitor() {
  useEffect(() => {
    // Initialize RUM monitoring
    RUMMonitoring.initializeWithTracking();
  }, []);

  return null; // This component doesn't render anything
}

// Export reportWebVitals wrapper for use in _app.tsx or layout.tsx
export function reportWebVitals(metric: { name: string; value: number }) {
  RUMMonitoring.trackPerformance({
    [metric.name.toLowerCase()]: metric.value
  });
}
