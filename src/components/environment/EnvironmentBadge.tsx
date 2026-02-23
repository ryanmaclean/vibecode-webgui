/**
 * Environment Badge Component
 * Displays current environment with color-coded visual indicator
 *
 * Environment Isolation & Safety feature
 */

'use client'

import { useEffect, useState, useCallback, memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Shield, AlertTriangle, Info } from 'lucide-react'
import { getEnvironmentContext } from '@/lib/environment/detector'
import type {
  EnvironmentType,
  EnvironmentContext,
  DetectionConfidence
} from '@/lib/environment/types'
import { getEnvironmentColor, getEnvironmentLabel } from '@/lib/environment/types'

export interface EnvironmentBadgeProps {
  /** Whether to show detailed information (confidence, signals) */
  detailed?: boolean
  /** Refresh interval in milliseconds (0 = no auto-refresh) */
  refreshInterval?: number
  /** Custom className for styling */
  className?: string
  /** Show icon in badge */
  showIcon?: boolean
  /** Compact mode (smaller badge) */
  compact?: boolean
}

// Environment badge variant mapping
const getEnvironmentVariant = (env: EnvironmentType): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (env) {
    case 'development':
    case 'test':
      return 'secondary' // Green
    case 'staging':
      return 'default' // Yellow/neutral
    case 'production':
      return 'destructive' // Red
    default:
      return 'outline' // Gray
  }
}

// Get appropriate icon for environment
const getEnvironmentIcon = (env: EnvironmentType) => {
  switch (env) {
    case 'production':
      return AlertTriangle
    case 'staging':
      return AlertCircle
    case 'development':
    case 'test':
      return Shield
    default:
      return Info
  }
}

// Get CSS color for environment (for custom styling)
const getEnvironmentCSSColor = (env: EnvironmentType): string => {
  switch (env) {
    case 'development':
    case 'test':
      return 'text-green-600'
    case 'staging':
      return 'text-yellow-600'
    case 'production':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}

// Get confidence indicator color
const getConfidenceColor = (confidence: DetectionConfidence): string => {
  switch (confidence) {
    case 'high':
      return 'text-green-600'
    case 'medium':
      return 'text-yellow-600'
    case 'low':
      return 'text-orange-600'
    default:
      return 'text-gray-600'
  }
}

function EnvironmentBadgeInner({
  detailed = false,
  refreshInterval = 0,
  className = '',
  showIcon = true,
  compact = false,
}: EnvironmentBadgeProps) {
  const [context, setContext] = useState<EnvironmentContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEnvironment = useCallback(() => {
    try {
      // Get environment context synchronously
      const envContext = getEnvironmentContext()
      setContext(envContext)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect environment')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEnvironment()

    // Set up refresh interval if specified
    if (refreshInterval > 0) {
      const interval = setInterval(fetchEnvironment, refreshInterval)
      return () => clearInterval(interval)
    }

    return undefined
  }, [fetchEnvironment, refreshInterval])

  if (loading) {
    return (
      <Badge variant="outline" className={className}>
        <div className="flex items-center gap-1">
          {showIcon && <Info className="h-3 w-3" />}
          <span className={compact ? 'text-xs' : ''}>Loading...</span>
        </div>
      </Badge>
    )
  }

  if (error) {
    return (
      <Badge variant="destructive" className={className}>
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          <span className={compact ? 'text-xs' : ''}>Error</span>
        </div>
      </Badge>
    )
  }

  if (!context) {
    return null
  }

  const { current } = context
  const IconComponent = getEnvironmentIcon(current.environment)
  const variant = getEnvironmentVariant(current.environment)
  const label = getEnvironmentLabel(current.environment)

  // Simple badge mode
  if (!detailed) {
    return (
      <Badge variant={variant} className={className}>
        <div className="flex items-center gap-1.5">
          {showIcon && <IconComponent className={compact ? 'h-3 w-3' : 'h-4 w-4'} />}
          <span className={compact ? 'text-xs' : ''}>{label}</span>
        </div>
      </Badge>
    )
  }

  // Detailed mode with confidence and warnings
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Badge variant={variant}>
        <div className="flex items-center gap-1.5">
          {showIcon && <IconComponent className="h-4 w-4" />}
          <span>{label}</span>
        </div>
      </Badge>

      {/* Confidence indicator */}
      <div className="flex items-center gap-1 text-xs">
        <span className="text-gray-500">Confidence:</span>
        <span className={getConfidenceColor(current.confidence)}>
          {current.confidence}
        </span>
      </div>

      {/* Primary signal */}
      {current.primarySignal && (
        <div className="text-xs text-gray-500">
          Source: {current.primarySignal.source}
        </div>
      )}

      {/* Warnings */}
      {current.warnings && current.warnings.length > 0 && (
        <div className="flex items-start gap-1 text-xs text-orange-600">
          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>{current.warnings[0]}</span>
        </div>
      )}

      {/* Multiple signals indicator */}
      {current.signals.length > 1 && (
        <div className="text-xs text-gray-500">
          {current.signals.length} signals detected
        </div>
      )}
    </div>
  )
}

export const EnvironmentBadge = memo(EnvironmentBadgeInner)
EnvironmentBadge.displayName = 'EnvironmentBadge'
