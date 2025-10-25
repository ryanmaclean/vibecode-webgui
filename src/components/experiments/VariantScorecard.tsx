/**
 * Variant Scorecard Component (Eppo-style)
 *
 * Displays variant performance comparison with statistical significance.
 * Follows Eppo's scorecard design pattern.
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface VariantData {
  count: number
  mean: number
  stdDev: number
  conversionRate?: number
}

interface StatisticsData {
  pValue: number
  significant: boolean
  lift: number
  confidenceInterval: [number, number]
}

interface VariantScorecardProps {
  metricName: string
  metricUnit?: string
  control: VariantData
  treatment: VariantData
  statistics: StatisticsData
  treatmentName?: string
  controlName?: string
}

export function VariantScorecard({
  metricName,
  metricUnit = '',
  control,
  treatment,
  statistics,
  treatmentName = 'Treatment',
  controlName = 'Control'
}: VariantScorecardProps) {
  const formatValue = (value: number) => {
    // If it's a conversion rate (0-1), show as percentage
    if (value > 0 && value <= 1 && metricUnit === '%') {
      return `${(value * 100).toFixed(2)}%`
    }
    // If it's already a percentage (0-100)
    if (metricUnit === '%') {
      return `${value.toFixed(2)}%`
    }
    // For other metrics
    return value.toFixed(2) + (metricUnit ? ` ${metricUnit}` : '')
  }

  const formatCI = (ci: [number, number]) => {
    if (metricUnit === '%') {
      return `[${ci[0].toFixed(1)}%, ${ci[1].toFixed(1)}%]`
    }
    return `[${ci[0].toFixed(2)}, ${ci[1].toFixed(2)}]`
  }

  const getLiftColor = (lift: number, significant: boolean) => {
    if (!significant) return 'text-gray-600'
    return lift > 0 ? 'text-green-600' : 'text-red-600'
  }

  const getLiftIcon = (lift: number, significant: boolean) => {
    if (!significant) return '~'
    return lift > 0 ? '▲' : '▼'
  }

  const marginOfError = (stdDev: number, count: number) => {
    // 95% confidence interval (1.96 * SE)
    const se = stdDev / Math.sqrt(count)
    return 1.96 * se
  }

  const controlMOE = marginOfError(control.stdDev, control.count)
  const treatmentMOE = marginOfError(treatment.stdDev, treatment.count)

  // Calculate relative bar widths (for visual comparison)
  const maxMean = Math.max(control.mean, treatment.mean)
  const controlWidth = (control.mean / maxMean) * 100
  const treatmentWidth = (treatment.mean / maxMean) * 100

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            {metricName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </CardTitle>
          {statistics.significant && (
            <Badge variant="default" className="bg-green-600">
              Significant
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Control Variant */}
        <div className="space-y-2 pb-3 border-b">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                {controlName}
              </div>
              <div className="text-2xl font-bold">
                {formatValue(control.mean)}
              </div>
              <div className="text-xs text-muted-foreground">
                ± {formatValue(controlMOE)}
              </div>
              <div className="text-xs text-muted-foreground">
                n = {control.count.toLocaleString()}
              </div>
            </div>
            <div className="w-32">
              <Progress value={controlWidth} className="h-2" />
            </div>
          </div>
        </div>

        {/* Treatment Variant */}
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                {treatmentName}
              </div>
              <div className="text-2xl font-bold">
                {formatValue(treatment.mean)}
              </div>
              <div className="text-xs text-muted-foreground">
                ± {formatValue(treatmentMOE)}
              </div>
              <div className="text-xs text-muted-foreground">
                n = {treatment.count.toLocaleString()}
              </div>
            </div>
            <div className="w-32">
              <Progress value={treatmentWidth} className="h-2" />
            </div>
          </div>

          {/* Statistical Summary */}
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold ${getLiftColor(statistics.lift, statistics.significant)}`}>
                  {getLiftIcon(statistics.lift, statistics.significant)} {Math.abs(statistics.lift).toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {statistics.lift > 0 ? 'increase' : 'decrease'}
                </span>
              </div>
              {statistics.significant && (
                <Badge variant="outline" className="text-xs">
                  ✓
                </Badge>
              )}
            </div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div>
                p-value: {statistics.pValue < 0.001 ? '< 0.001' : statistics.pValue.toFixed(4)}
              </div>
              <div>
                95% CI: {formatCI(statistics.confidenceInterval)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
