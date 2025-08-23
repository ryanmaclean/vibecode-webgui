/**
 * React hook for easy Datadog RUM integration
 * Provides convenient methods for tracking user interactions and performance
 */

import React, { useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import RUMMonitoring from '@/lib/monitoring/rum-client'

interface UseRUMReturn {
  // User tracking
  trackAuth: (event: 'login' | 'logout' | 'signup' | 'password_reset', context?: Record<string, any>) => void
  setUser: (user: { id?: string; name?: string; email?: string; [key: string]: any }) => void
  
  // Workspace tracking
  trackWorkspace: (action: string, workspaceId: string, metadata?: Record<string, any>) => void
  
  // Code editor tracking
  trackCodeEditor: (action: string, context: {
    language?: string;
    fileType?: string;
    linesOfCode?: number;
    charactersTyped?: number;
    timeSpent?: number;
  }) => void
  
  // Terminal tracking
  trackTerminal: (action: string, context: {
    command?: string;
    exitCode?: number;
    duration?: number;
    workspaceId?: string;
  }) => void
  
  // AI interaction tracking
  trackAI: (action: string, context: {
    model?: string;
    provider?: string;
    promptLength?: number;
    responseLength?: number;
    latency?: number;
    cost?: number;
  }) => void
  
  // Business metrics
  trackBusinessMetric: (metric: string, value: number, attributes?: Record<string, any>) => void
  
  // User journey tracking
  trackJourney: (step: string, flow: string, metadata?: Record<string, any>) => void
  
  // Error tracking
  trackError: (error: Error | string, context?: {
    component?: string;
    action?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, any>;
  }) => void
  
  // Performance tracking
  trackPerformance: (timing: {
    pageLoad?: number;
    domContentLoaded?: number;
    firstContentfulPaint?: number;
    largestContentfulPaint?: number;
    cumulativeLayoutShift?: number;
  }) => void
  
  // API usage tracking
  trackAPI: (endpoint: string, method: string, context: {
    responseTime?: number;
    statusCode?: number;
    payloadSize?: number;
    rateLimitRemaining?: number;
  }) => void
  
  // Generic action tracking
  trackAction: (name: string, context?: Record<string, any>) => void
  
  // Session info
  getSessionInfo: () => {
    sessionId?: string;
    viewId?: string;
    initialized: boolean;
  } | null
}

export function useRUM(): UseRUMReturn {
  const { data: session } = useSession()
  const router = useRouter()

  // Set user context when session changes
  useEffect(() => {
    if (session?.user) {
      RUMMonitoring.setUser({
        id: session.user.id || session.user.email || 'unknown',
        name: session.user.name || 'Unknown User',
        email: session.user.email || '',
        image: session.user.image || undefined
      })
    }
  }, [session])

  // Track route changes
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      RUMMonitoring.addAction('navigation.route_change', {
        url,
        timestamp: Date.now(),
        category: 'navigation'
      })
    }

    // Note: Next.js 13+ App Router doesn't have router events
    // This is a simplified approach for tracking navigation
    if (typeof window !== 'undefined') {
      const originalPushState = window.history.pushState
      const originalReplaceState = window.history.replaceState

      window.history.pushState = function(...args) {
        originalPushState.apply(this, args)
        handleRouteChange(window.location.pathname + window.location.search)
      }

      window.history.replaceState = function(...args) {
        originalReplaceState.apply(this, args)
        handleRouteChange(window.location.pathname + window.location.search)
      }

      window.addEventListener('popstate', () => {
        handleRouteChange(window.location.pathname + window.location.search)
      })

      return () => {
        window.history.pushState = originalPushState
        window.history.replaceState = originalReplaceState
      }
    }
  }, [])

  const trackAuth = useCallback((event: 'login' | 'logout' | 'signup' | 'password_reset', context?: Record<string, any>) => {
    RUMMonitoring.trackAuth(event, {
      ...context,
      userId: session?.user?.id || session?.user?.email
    })
  }, [session])

  const setUser = useCallback((user: { id?: string; name?: string; email?: string; [key: string]: any }) => {
    RUMMonitoring.setUser(user)
  }, [])

  const trackWorkspace = useCallback((action: string, workspaceId: string, metadata?: Record<string, any>) => {
    RUMMonitoring.trackWorkspaceAction(action, workspaceId, {
      ...metadata,
      userId: session?.user?.id || session?.user?.email
    })
  }, [session])

  const trackCodeEditor = useCallback((action: string, context: {
    language?: string;
    fileType?: string;
    linesOfCode?: number;
    charactersTyped?: number;
    timeSpent?: number;
  }) => {
    RUMMonitoring.trackCodeEditor(action, {
      ...context,
      userId: session?.user?.id || session?.user?.email
    })
  }, [session])

  const trackTerminal = useCallback((action: string, context: {
    command?: string;
    exitCode?: number;
    duration?: number;
    workspaceId?: string;
  }) => {
    RUMMonitoring.trackTerminal(action, {
      ...context,
      userId: session?.user?.id || session?.user?.email
    })
  }, [session])

  const trackAI = useCallback((action: string, context: {
    model?: string;
    provider?: string;
    promptLength?: number;
    responseLength?: number;
    latency?: number;
    cost?: number;
  }) => {
    RUMMonitoring.trackAIInteraction(action, {
      ...context,
      userId: session?.user?.id || session?.user?.email,
      sessionId: RUMMonitoring.getSessionInfo()?.sessionId
    })
  }, [session])

  const trackBusinessMetric = useCallback((metric: string, value: number, attributes?: Record<string, any>) => {
    RUMMonitoring.trackBusinessMetric(metric, value, {
      ...attributes,
      userId: session?.user?.id || session?.user?.email
    })
  }, [session])

  const trackJourney = useCallback((step: string, flow: string, metadata?: Record<string, any>) => {
    RUMMonitoring.trackUserJourney(step, flow, {
      ...metadata,
      userId: session?.user?.id || session?.user?.email
    })
  }, [session])

  const trackError = useCallback((error: Error | string, context?: {
    component?: string;
    action?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, any>;
  }) => {
    RUMMonitoring.trackError(error, {
      ...context,
      userId: session?.user?.id || session?.user?.email
    })
  }, [session])

  const trackPerformance = useCallback((timing: {
    pageLoad?: number;
    domContentLoaded?: number;
    firstContentfulPaint?: number;
    largestContentfulPaint?: number;
    cumulativeLayoutShift?: number;
  }) => {
    RUMMonitoring.trackPerformance(timing)
  }, [])

  const trackAPI = useCallback((endpoint: string, method: string, context: {
    responseTime?: number;
    statusCode?: number;
    payloadSize?: number;
    rateLimitRemaining?: number;
  }) => {
    RUMMonitoring.trackAPIUsage(endpoint, method, {
      ...context,
      userId: session?.user?.id || session?.user?.email
    })
  }, [session])

  const trackAction = useCallback((name: string, context?: Record<string, any>) => {
    RUMMonitoring.addAction(name, {
      ...context,
      userId: session?.user?.id || session?.user?.email,
      timestamp: Date.now()
    })
  }, [session])

  const getSessionInfo = useCallback(() => {
    return RUMMonitoring.getSessionInfo()
  }, [])

  return {
    trackAuth,
    setUser,
    trackWorkspace,
    trackCodeEditor,
    trackTerminal,
    trackAI,
    trackBusinessMetric,
    trackJourney,
    trackError,
    trackPerformance,
    trackAPI,
    trackAction,
    getSessionInfo
  }
}

// Higher-order component for automatic RUM tracking
export function withRUM<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  return function WrappedComponent(props: P) {
    const { trackError, trackAction } = useRUM()

    useEffect(() => {
      trackAction(`component.${componentName}.mounted`, {
        component: componentName,
        category: 'component-lifecycle'
      })

      return () => {
        trackAction(`component.${componentName}.unmounted`, {
          component: componentName,
          category: 'component-lifecycle'
        })
      }
    }, [trackAction])

    // Error boundary-like behavior for RUM tracking
    useEffect(() => {
      const handleError = (event: ErrorEvent) => {
        trackError(event.error || event.message, {
          component: componentName,
          severity: 'medium',
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        })
      }

      window.addEventListener('error', handleError)
      return () => window.removeEventListener('error', handleError)
    }, [trackError])

    return React.createElement(Component, props)
  }
}

export default useRUM