'use client';

/**
 * Performance Monitoring Client Component
 * 
 * Initializes Real User Monitoring (RUM) on the client side
 */

import { useEffect } from 'react';
import { initRUM, reportWebVitals } from '@/lib/monitoring/rum-client';

export function PerformanceMonitor() {
  useEffect(() => {
    // Initialize RUM monitoring
    initRUM();
  }, []);

  return null; // This component doesn't render anything
}

// Export for use in _app.tsx or layout.tsx
export { reportWebVitals };
