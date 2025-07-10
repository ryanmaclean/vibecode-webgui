/**
 * Client-side experiment utilities
 * Provides React hooks and utilities for feature flags and A/B testing
 * Inspired by Datadog's Eppo acquisition
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface ExperimentResult {
  flagKey: string
  variant: string
  payload?: Record<string, any>
  isExperiment: boolean
  allocationKey?: string
}

interface ExperimentContext {
  workspaceId?: string
  customAttributes?: Record<string, any>
  defaultValue?: boolean
}

interface UseFeatureFlagOptions {
  defaultValue?: boolean
  context?: ExperimentContext
  onEvaluate?: (result: ExperimentResult) => void
}

/**
 * React hook for feature flag evaluation
 */
export function useFeatureFlag(
  flagKey: string, 
  options: UseFeatureFlagOptions = {}
): {
  isEnabled: boolean
  variant: string
  payload?: Record<string, any>
  isLoading: boolean
  trackMetric: (metricName: string, value: number) => Promise<void>
} {
  const { data: session } = useSession()
  const [result, setResult] = useState<ExperimentResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const evaluateFlag = useCallback(async () => {
    if (!session?.user || !flagKey) return

    try {
      setIsLoading(true)
      
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'evaluate',
          flagKey,
          context: options.context
        })
      })

      if (response.ok) {
        const data = await response.json()
        setResult(data.result)
        options.onEvaluate?.(data.result)
      } else {
        // Fallback to default
        setResult({
          flagKey,
          variant: 'control',
          isExperiment: false
        })
      }
    } catch (error) {
      console.error('Failed to evaluate feature flag:', error)
      setResult({
        flagKey,
        variant: 'control',
        isExperiment: false
      })
    } finally {
      setIsLoading(false)
    }
  }, [flagKey, session?.user, options.context, options.onEvaluate])

  const trackMetric = useCallback(async (metricName: string, value: number) => {
    if (!session?.user || !flagKey) return

    try {
      await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'track',
          flagKey,
          metricName,
          value,
          context: options.context
        })
      })
    } catch (error) {
      console.error('Failed to track metric:', error)
    }
  }, [flagKey, session?.user, options.context])

  useEffect(() => {
    evaluateFlag()
  }, [evaluateFlag])

  return {
    isEnabled: result?.variant !== 'control' && result?.variant !== undefined,
    variant: result?.variant || 'control',
    payload: result?.payload,
    isLoading,
    trackMetric
  }
}

/**
 * React hook for evaluating multiple feature flags
 */
export function useFeatureFlags(
  flags: Array<{ key: string; defaultValue?: boolean }>,
  context?: ExperimentContext
): {
  flags: Record<string, { isEnabled: boolean; variant: string; payload?: Record<string, any> }>
  isLoading: boolean
  trackMetric: (flagKey: string, metricName: string, value: number) => Promise<void>
} {
  const { data: session } = useSession()
  const [results, setResults] = useState<Record<string, ExperimentResult>>({})
  const [isLoading, setIsLoading] = useState(true)

  const evaluateFlags = useCallback(async () => {
    if (!session?.user || flags.length === 0) return

    try {
      setIsLoading(true)
      
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'evaluate_multiple',
          flags,
          context
        })
      })

      if (response.ok) {
        const data = await response.json()
        const flagResults: Record<string, ExperimentResult> = {}
        
        data.results.forEach((result: ExperimentResult) => {
          flagResults[result.flagKey] = result
        })
        
        setResults(flagResults)
      } else {
        // Fallback to defaults
        const fallbackResults: Record<string, ExperimentResult> = {}
        flags.forEach(flag => {
          fallbackResults[flag.key] = {
            flagKey: flag.key,
            variant: 'control',
            isExperiment: false
          }
        })
        setResults(fallbackResults)
      }
    } catch (error) {
      console.error('Failed to evaluate feature flags:', error)
      // Fallback to defaults
      const fallbackResults: Record<string, ExperimentResult> = {}
      flags.forEach(flag => {
        fallbackResults[flag.key] = {
          flagKey: flag.key,
          variant: 'control',
          isExperiment: false
        }
      })
      setResults(fallbackResults)
    } finally {
      setIsLoading(false)
    }
  }, [flags, session?.user, context])

  const trackMetric = useCallback(async (flagKey: string, metricName: string, value: number) => {
    if (!session?.user) return

    try {
      await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'track',
          flagKey,
          metricName,
          value,
          context
        })
      })
    } catch (error) {
      console.error('Failed to track metric:', error)
    }
  }, [session?.user, context])

  useEffect(() => {
    evaluateFlags()
  }, [evaluateFlags])

  const formattedFlags: Record<string, { isEnabled: boolean; variant: string; payload?: Record<string, any> }> = {}
  
  Object.entries(results).forEach(([flagKey, result]) => {
    formattedFlags[flagKey] = {
      isEnabled: result.variant !== 'control',
      variant: result.variant,
      payload: result.payload
    }
  })

  return {
    flags: formattedFlags,
    isLoading,
    trackMetric
  }
}

/**
 * Higher-order component for feature flag gated components
 */
export function withFeatureFlag<T extends object>(
  flagKey: string,
  options: UseFeatureFlagOptions = {}
) {
  return function FeatureFlagWrapper(
    Component: React.ComponentType<T>
  ): React.ComponentType<T & { fallback?: React.ReactNode }> {
    return function WrappedComponent(props: T & { fallback?: React.ReactNode }) {
      const { isEnabled, isLoading, ...flagProps } = useFeatureFlag(flagKey, options)

      if (isLoading) {
        return React.createElement('div', null, 'Loading...')
      }

      if (!isEnabled) {
        return props.fallback || null
      }

      return React.createElement(Component, { ...props, ...flagProps })
    }
  }
}

/**
 * Component for A/B testing different variants
 */
interface ABTestProps {
  flagKey: string
  variants: Record<string, React.ReactNode>
  defaultVariant?: string
  context?: ExperimentContext
  onVariantShown?: (variant: string) => void
}

export function ABTest({
  flagKey,
  variants,
  defaultVariant = 'control',
  context,
  onVariantShown
}: ABTestProps): React.ReactElement {
  const { variant, isLoading, trackMetric } = useFeatureFlag(flagKey, { context })

  useEffect(() => {
    if (!isLoading && variant) {
      onVariantShown?.(variant)
      // Track that this variant was shown
      trackMetric('variant_shown', 1)
    }
  }, [variant, isLoading, onVariantShown, trackMetric])

  if (isLoading) {
    return React.createElement('div', null, 'Loading...')
  }

  const selectedVariant = variant in variants ? variant : defaultVariant
  const result = variants[selectedVariant] || variants[defaultVariant]
  return result ?? React.createElement('div', null, 'Variant not found')
}

/**
 * Utility functions for experiment tracking
 */
export const ExperimentTracker = {
  /**
   * Track a conversion event
   */
  async trackConversion(flagKey: string, context?: ExperimentContext): Promise<void> {
    try {
      await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'track',
          flagKey,
          metricName: 'conversion',
          value: 1,
          context
        })
      })
    } catch (error) {
      console.error('Failed to track conversion:', error)
    }
  },

  /**
   * Track a custom event with value
   */
  async trackEvent(
    flagKey: string, 
    eventName: string, 
    value: number = 1, 
    context?: ExperimentContext
  ): Promise<void> {
    try {
      await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'track',
          flagKey,
          metricName: eventName,
          value,
          context
        })
      })
    } catch (error) {
      console.error('Failed to track event:', error)
    }
  },

  /**
   * Track user engagement (time spent, clicks, etc.)
   */
  async trackEngagement(
    flagKey: string, 
    engagementData: {
      duration?: number
      clicks?: number
      scrollDepth?: number
      interactionCount?: number
    },
    context?: ExperimentContext
  ): Promise<void> {
    const metrics = Object.entries(engagementData).filter(([_, value]) => value !== undefined)
    
    await Promise.all(
      metrics.map(([metricName, value]) =>
        this.trackEvent(flagKey, `engagement_${metricName}`, value as number, context)
      )
    )
  }
}

export default {
  useFeatureFlag,
  useFeatureFlags,
  withFeatureFlag,
  ABTest,
  ExperimentTracker
}