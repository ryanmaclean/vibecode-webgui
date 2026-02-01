/**
 * Experiment Detail Page
 *
 * Comprehensive view of a single experiment with multiple tabs:
 * - Overview: Basic info, controls, SRM warnings
 * - Results: Variant scorecards, statistical analysis
 * - Metrics: Time series charts, breakdowns
 * - Configuration: Variant/metric definitions, guardrails, targeting
 */

'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { VariantScorecard } from '@/components/experiments/VariantScorecard'
import { MetricsChart, FunnelChart } from '@/components/experiments/MetricsChart'
import { GuardrailConfig } from '@/components/experiments/GuardrailConfig'
import { getExperimentByKey, generateTimeSeriesData } from '@/lib/experiments/mock-data'

export default function ExperimentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const experimentKey = params?.key as string
  const experiment = getExperimentByKey(experimentKey)

  if (!experiment) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <h2 className="text-xl font-semibold mb-2">Experiment Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The experiment you're looking for doesn't exist.
              </p>
              <Button onClick={() => router.push('/experiments')}>
                Back to Experiments
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date)
  }

  const statusColors = {
    draft: 'bg-gray-500',
    running: 'bg-green-500',
    completed: 'bg-blue-500',
    paused: 'bg-yellow-500',
    archived: 'bg-gray-400'
  }

  const getDaysSinceStart = () => {
    if (!experiment.started_at) return 0
    const start = new Date(experiment.started_at)
    const now = new Date()
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/experiments')}
              className="mb-3"
            >
              ← Back to Experiments
            </Button>
            <div className="flex items-center gap-3">
              <span className={`${statusColors[experiment.status]} w-3 h-3 rounded-full`} />
              <h1 className="text-3xl font-bold text-gray-900">{experiment.name}</h1>
            </div>
            <p className="text-gray-600 mt-2">{experiment.hypothesis}</p>
            <div className="flex items-center gap-3 mt-3">
              <Badge variant={experiment.status === 'running' ? 'default' : 'secondary'}>
                {experiment.status.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Key: {experiment.key}
              </span>
              {experiment.started_at && (
                <>
                  <span className="text-sm text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">
                    Running for {getDaysSinceStart()} days
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {experiment.status === 'running' && (
              <Button variant="outline">Pause Experiment</Button>
            )}
            {experiment.status === 'paused' && (
              <Button>Resume Experiment</Button>
            )}
            {experiment.status === 'draft' && (
              <Button>Start Experiment</Button>
            )}
            {experiment.status === 'running' && (
              <Button variant="destructive">Stop Experiment</Button>
            )}
          </div>
        </div>

        {/* SRM Warning */}
        {experiment.results?.srmCheck?.hasMismatch && (
          <Alert variant="destructive">
            <AlertTitle>Sample Ratio Mismatch Detected</AlertTitle>
            <AlertDescription>
              The observed variant distribution differs significantly from expected ratios (p ={' '}
              {experiment.results.srmCheck.pValue.toFixed(4)}). This may indicate a randomization
              issue. Severity: <strong>{experiment.results.srmCheck.severity.toUpperCase()}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Experiment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Created
                    </div>
                    <div className="text-sm">{formatDate(experiment.created_at)}</div>
                  </div>
                  {experiment.started_at && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        Started
                      </div>
                      <div className="text-sm">{formatDate(experiment.started_at)}</div>
                    </div>
                  )}
                  {experiment.ended_at && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        Ended
                      </div>
                      <div className="text-sm">{formatDate(experiment.ended_at)}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Hypothesis
                    </div>
                    <div className="text-sm">{experiment.hypothesis}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Traffic Allocation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {experiment.config.variants.map(variant => (
                    <div key={variant.key}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{variant.name}</span>
                        <span className="text-sm text-muted-foreground">{variant.weight}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${variant.weight}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {experiment.results && (
                    <div className="pt-3 border-t mt-4">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        Actual Distribution
                      </div>
                      {Object.entries(experiment.results.variantDistribution).map(
                        ([variantKey, count]) => {
                          const percentage = (count / experiment.results!.totalUsers) * 100
                          return (
                            <div key={variantKey} className="text-sm mb-1">
                              {variantKey}: {count.toLocaleString()} ({percentage.toFixed(1)}%)
                            </div>
                          )
                        }
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {experiment.config.targeting && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Targeting</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {experiment.config.targeting.segments && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        Segments
                      </div>
                      <div className="flex gap-2">
                        {experiment.config.targeting.segments.map(segment => (
                          <Badge key={segment} variant="outline">
                            {segment}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {experiment.config.targeting.trafficPercentage !== undefined && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        Traffic Percentage
                      </div>
                      <div className="text-sm">
                        {experiment.config.targeting.trafficPercentage}% of eligible users
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-6">
            {!experiment.results ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="text-4xl mb-4">📊</div>
                  <h3 className="text-lg font-semibold mb-2">No Results Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Results will appear once the experiment starts collecting data
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(experiment.results.metrics).map(([metricName, data]) => {
                    const variant = experiment.config.variants.find(v => v.key === 'treatment')
                    return (
                      <VariantScorecard
                        key={metricName}
                        metricName={metricName}
                        metricUnit={metricName.includes('rate') || metricName.includes('accuracy') ? '%' : ''}
                        control={data.control}
                        treatment={data.treatment}
                        statistics={data.statistics}
                        controlName={experiment.config.variants[0].name}
                        treatmentName={variant?.name || 'Treatment'}
                      />
                    )
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-6">
            {!experiment.results ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="text-4xl mb-4">📈</div>
                  <h3 className="text-lg font-semibold mb-2">No Metrics Data Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Time series data will appear once the experiment is running
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {experiment.config.metrics.primary.map(metricName => {
                  const timeSeriesData = generateTimeSeriesData(experimentKey, metricName)
                  return (
                    <MetricsChart
                      key={metricName}
                      title={metricName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      description="Daily performance over time"
                      data={timeSeriesData}
                      type="line"
                      xKey="date"
                      yKeys={[
                        { key: 'control', label: experiment.config.variants[0].name, color: '#3b82f6' },
                        { key: 'treatment', label: experiment.config.variants[1].name, color: '#10b981' }
                      ]}
                    />
                  )
                })}
              </>
            )}
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="configuration" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Variants</CardTitle>
                <CardDescription>
                  Experiment variants and their allocation weights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {experiment.config.variants.map(variant => (
                    <div key={variant.key} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{variant.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Key: {variant.key}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{variant.weight}%</div>
                          <div className="text-xs text-muted-foreground">weight</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metrics</CardTitle>
                <CardDescription>
                  Metrics being tracked for this experiment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Primary Metrics</div>
                  <div className="flex flex-wrap gap-2">
                    {experiment.config.metrics.primary.map(metric => (
                      <Badge key={metric} variant="default">
                        {metric.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
                {experiment.config.metrics.secondary.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Secondary Metrics</div>
                    <div className="flex flex-wrap gap-2">
                      {experiment.config.metrics.secondary.map(metric => (
                        <Badge key={metric} variant="outline">
                          {metric.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <GuardrailConfig
              guardrails={experiment.config.metrics.guardrails.map(g => ({
                metricName: g.metricName,
                operator: g.operator === 'gt' ? '>' : g.operator === 'lt' ? '<' : g.operator === 'gte' ? '>=' : '<=' as const,
                threshold: g.threshold,
                severity: 'warning' as const
              }))}
              onChange={() => {}}
              metricOptions={[...experiment.config.metrics.primary, ...experiment.config.metrics.secondary]}
              readOnly={experiment.status !== 'draft'}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
