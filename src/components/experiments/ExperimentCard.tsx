/**
 * Experiment Card Component
 *
 * Displays a summary of an experiment with key metrics and status.
 * Used in the experiments list page.
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { MockExperiment } from '@/lib/experiments/mock-data'

interface ExperimentCardProps {
  experiment: MockExperiment
}

export function ExperimentCard({ experiment }: ExperimentCardProps) {
  const statusColors = {
    draft: 'bg-gray-500',
    running: 'bg-green-500',
    completed: 'bg-blue-500',
    paused: 'bg-yellow-500',
    archived: 'bg-gray-400'
  }

  const statusIcons = {
    draft: '○',
    running: '●',
    completed: '✓',
    paused: '‖',
    archived: '□'
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date)
  }

  const getPrimaryMetricSummary = () => {
    if (!experiment.results) return null

    const primaryMetricKey = experiment.config.metrics.primary[0]
    const metricData = experiment.results.metrics[primaryMetricKey]

    if (!metricData) return null

    const { statistics } = metricData
    const isPositive = statistics.lift > 0
    const liftColor = isPositive ? 'text-green-600' : 'text-red-600'

    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {primaryMetricKey.replace(/_/g, ' ')}:
        </span>
        <span className={`font-semibold ${liftColor}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(statistics.lift).toFixed(1)}%
        </span>
        {statistics.significant && (
          <Badge variant="outline" className="text-xs">
            p &lt; {statistics.pValue < 0.001 ? '0.001' : statistics.pValue.toFixed(3)}
          </Badge>
        )}
      </div>
    )
  }

  const getSRMWarning = () => {
    if (!experiment.results?.srmCheck?.hasMismatch) return null

    const severityColors = {
      none: 'border-green-200 bg-green-50 text-green-800',
      low: 'border-yellow-200 bg-yellow-50 text-yellow-800',
      medium: 'border-orange-200 bg-orange-50 text-orange-800',
      high: 'border-red-200 bg-red-50 text-red-800',
      critical: 'border-red-300 bg-red-100 text-red-900'
    }

    const severity = experiment.results.srmCheck.severity
    const colorClass = severityColors[severity]

    return (
      <div className={`mt-2 text-xs px-2 py-1 rounded border ${colorClass}`}>
        ⚠ Sample Ratio Mismatch ({severity.toUpperCase()})
      </div>
    )
  }

  return (
    <Link href={`/experiments/${experiment.key}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`${statusColors[experiment.status]} w-2 h-2 rounded-full`} />
                <CardTitle className="text-lg">{experiment.name}</CardTitle>
              </div>
              <CardDescription className="line-clamp-2">
                {experiment.hypothesis}
              </CardDescription>
            </div>
            <Badge variant={experiment.status === 'running' ? 'default' : 'secondary'}>
              {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                {experiment.status === 'draft' ? 'Created' : 'Started'}{' '}
                {formatDate(experiment.started_at || experiment.created_at)}
              </span>
              {experiment.results && (
                <>
                  <span>•</span>
                  <span>{experiment.results.totalUsers.toLocaleString()} users</span>
                </>
              )}
            </div>

            {/* Primary Metric Summary */}
            {getPrimaryMetricSummary()}

            {/* SRM Warning */}
            {getSRMWarning()}

            {/* Variants */}
            <div className="flex gap-2 text-xs">
              {experiment.config.variants.map(variant => (
                <Badge key={variant.key} variant="outline" className="font-normal">
                  {variant.name} ({variant.weight}%)
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
