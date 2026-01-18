/**
 * Create Experiment Wizard
 *
 * Step-by-step wizard for creating new experiments:
 * 1. Basic Info (name, hypothesis, key)
 * 2. Variants (name, weight, allocation %)
 * 3. Metrics (primary, secondary, guardrails)
 * 4. Targeting (user segments, traffic percentage)
 * 5. Review & Launch
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

type WizardStep = 'basic' | 'variants' | 'metrics' | 'targeting' | 'review'

interface Variant {
  key: string
  name: string
  weight: number
}

interface Guardrail {
  metricName: string
  operator: 'gt' | 'lt' | 'gte' | 'lte'
  threshold: number
}

export default function CreateExperimentPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic')

  // Basic Info
  const [name, setName] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [key, setKey] = useState('')

  // Variants
  const [variants, setVariants] = useState<Variant[]>([
    { key: 'control', name: 'Control', weight: 50 },
    { key: 'treatment', name: 'Treatment', weight: 50 }
  ])

  // Metrics
  const [primaryMetrics, setPrimaryMetrics] = useState<string[]>([])
  const [secondaryMetrics, setSecondaryMetrics] = useState<string[]>([])
  const [guardrails, setGuardrails] = useState<Guardrail[]>([])
  const [newPrimaryMetric, setNewPrimaryMetric] = useState('')
  const [newSecondaryMetric, setNewSecondaryMetric] = useState('')

  // Targeting
  const [segments, setSegments] = useState<string[]>([])
  const [trafficPercentage, setTrafficPercentage] = useState(100)
  const [newSegment, setNewSegment] = useState('')

  const steps: { id: WizardStep; label: string; description: string }[] = [
    { id: 'basic', label: 'Basic Info', description: 'Name and hypothesis' },
    { id: 'variants', label: 'Variants', description: 'Define test variants' },
    { id: 'metrics', label: 'Metrics', description: 'Choose what to measure' },
    { id: 'targeting', label: 'Targeting', description: 'Define audience' },
    { id: 'review', label: 'Review', description: 'Review and launch' }
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)

  const canProceed = () => {
    switch (currentStep) {
      case 'basic':
        return name.trim() !== '' && hypothesis.trim() !== '' && key.trim() !== ''
      case 'variants':
        const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0)
        return variants.length >= 2 && totalWeight === 100
      case 'metrics':
        return primaryMetrics.length > 0
      case 'targeting':
        return trafficPercentage > 0 && trafficPercentage <= 100
      case 'review':
        return true
      default:
        return false
    }
  }

  const addVariant = () => {
    setVariants([
      ...variants,
      { key: `variant_${variants.length}`, name: `Variant ${variants.length}`, weight: 0 }
    ])
  }

  const removeVariant = (index: number) => {
    if (variants.length <= 2) return
    setVariants(variants.filter((_, i) => i !== index))
  }

  const updateVariantWeight = (index: number, weight: number) => {
    const updated = [...variants]
    updated[index].weight = Math.max(0, Math.min(100, weight))
    setVariants(updated)
  }

  const balanceWeights = () => {
    const weight = Math.floor(100 / variants.length)
    const remainder = 100 - (weight * variants.length)
    setVariants(variants.map((v, i) => ({
      ...v,
      weight: i === 0 ? weight + remainder : weight
    })))
  }

  const addPrimaryMetric = () => {
    if (newPrimaryMetric.trim()) {
      setPrimaryMetrics([...primaryMetrics, newPrimaryMetric.trim()])
      setNewPrimaryMetric('')
    }
  }

  const addSecondaryMetric = () => {
    if (newSecondaryMetric.trim()) {
      setSecondaryMetrics([...secondaryMetrics, newSecondaryMetric.trim()])
      setNewSecondaryMetric('')
    }
  }

  const addSegment = () => {
    if (newSegment.trim()) {
      setSegments([...segments, newSegment.trim()])
      setNewSegment('')
    }
  }

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id)
    }
  }

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id)
    }
  }

  const handleCreate = () => {
    // In a real implementation, this would call an API
    console.log('Creating experiment:', {
      name,
      hypothesis,
      key,
      variants,
      metrics: { primary: primaryMetrics, secondary: secondaryMetrics, guardrails },
      targeting: { segments, trafficPercentage }
    })
    router.push('/experiments')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/experiments')}
            className="mb-3"
          >
            ← Back to Experiments
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Create New Experiment</h1>
          <p className="text-sm text-gray-600 mt-1">
            Follow the steps to configure your experiment
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex-1 flex items-center">
              <div className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStepIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>
                <div className="ml-2">
                  <div className="text-xs font-medium">{step.label}</div>
                  <div className="text-xs text-muted-foreground hidden md:block">
                    {step.description}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    index < currentStepIndex ? 'bg-primary' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStepIndex].label}</CardTitle>
            <CardDescription>{steps[currentStepIndex].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info Step */}
            {currentStep === 'basic' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Experiment Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., New Checkout Flow A/B Test"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="key">Experiment Key *</Label>
                  <Input
                    id="key"
                    value={key}
                    onChange={(e) => setKey(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    placeholder="e.g., checkout-flow-test"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Unique identifier used in code (lowercase, hyphens only)
                  </p>
                </div>
                <div>
                  <Label htmlFor="hypothesis">Hypothesis *</Label>
                  <textarea
                    id="hypothesis"
                    value={hypothesis}
                    onChange={(e) => setHypothesis(e.target.value)}
                    placeholder="e.g., Simplifying the checkout to 2 steps will increase conversion rate by 15%"
                    className="w-full min-h-24 px-3 py-2 border rounded-md text-sm mt-1"
                  />
                </div>
              </div>
            )}

            {/* Variants Step */}
            {currentStep === 'variants' && (
              <div className="space-y-4">
                {variants.map((variant, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Variant Name</Label>
                          <Input
                            value={variant.name}
                            onChange={(e) => {
                              const updated = [...variants]
                              updated[index].name = e.target.value
                              setVariants(updated)
                            }}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Variant Key</Label>
                          <Input
                            value={variant.key}
                            onChange={(e) => {
                              const updated = [...variants]
                              updated[index].key = e.target.value.toLowerCase().replace(/\s+/g, '_')
                              setVariants(updated)
                            }}
                            className="mt-1"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Weight (%)</Label>
                          <Input
                            type="number"
                            value={variant.weight}
                            onChange={(e) => updateVariantWeight(index, parseInt(e.target.value) || 0)}
                            min="0"
                            max="100"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      {variants.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariant(index)}
                          className="ml-2"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addVariant} className="flex-1">
                    + Add Variant
                  </Button>
                  <Button variant="outline" size="sm" onClick={balanceWeights} className="flex-1">
                    Balance Weights
                  </Button>
                </div>
                <Alert>
                  <AlertDescription>
                    Total weight: {variants.reduce((sum, v) => sum + v.weight, 0)}% (must equal
                    100%)
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Metrics Step */}
            {currentStep === 'metrics' && (
              <div className="space-y-6">
                <div>
                  <Label>Primary Metrics *</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Key metrics you're trying to improve
                  </p>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newPrimaryMetric}
                      onChange={(e) => setNewPrimaryMetric(e.target.value)}
                      placeholder="e.g., conversion_rate"
                      onKeyPress={(e) => e.key === 'Enter' && addPrimaryMetric()}
                    />
                    <Button onClick={addPrimaryMetric} size="sm">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {primaryMetrics.map((metric, index) => (
                      <Badge
                        key={index}
                        variant="default"
                        className="cursor-pointer"
                        onClick={() => setPrimaryMetrics(primaryMetrics.filter((_, i) => i !== index))}
                      >
                        {metric} ✕
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Secondary Metrics</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Additional metrics to monitor
                  </p>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newSecondaryMetric}
                      onChange={(e) => setNewSecondaryMetric(e.target.value)}
                      placeholder="e.g., time_on_page"
                      onKeyPress={(e) => e.key === 'Enter' && addSecondaryMetric()}
                    />
                    <Button onClick={addSecondaryMetric} size="sm">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {secondaryMetrics.map((metric, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => setSecondaryMetrics(secondaryMetrics.filter((_, i) => i !== index))}
                      >
                        {metric} ✕
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Targeting Step */}
            {currentStep === 'targeting' && (
              <div className="space-y-6">
                <div>
                  <Label>User Segments</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Target specific user groups (optional)
                  </p>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newSegment}
                      onChange={(e) => setNewSegment(e.target.value)}
                      placeholder="e.g., premium_users"
                      onKeyPress={(e) => e.key === 'Enter' && addSegment()}
                    />
                    <Button onClick={addSegment} size="sm">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {segments.map((segment, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => setSegments(segments.filter((_, i) => i !== index))}
                      >
                        {segment} ✕
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="traffic">Traffic Percentage *</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Percentage of eligible users to include
                  </p>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      id="traffic"
                      value={trafficPercentage}
                      onChange={(e) => setTrafficPercentage(parseInt(e.target.value))}
                      min="1"
                      max="100"
                      className="flex-1"
                    />
                    <div className="w-16 text-right font-medium">{trafficPercentage}%</div>
                  </div>
                </div>
              </div>
            )}

            {/* Review Step */}
            {currentStep === 'review' && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Basic Info</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p><strong>Name:</strong> {name}</p>
                    <p><strong>Key:</strong> {key}</p>
                    <p><strong>Hypothesis:</strong> {hypothesis}</p>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Variants</h3>
                  <div className="space-y-2">
                    {variants.map(variant => (
                      <div key={variant.key} className="flex items-center justify-between text-sm">
                        <span>{variant.name} ({variant.key})</span>
                        <span className="font-medium">{variant.weight}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Metrics</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Primary:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {primaryMetrics.map(m => (
                          <Badge key={m} variant="default" className="text-xs">{m}</Badge>
                        ))}
                      </div>
                    </div>
                    {secondaryMetrics.length > 0 && (
                      <div>
                        <strong>Secondary:</strong>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {secondaryMetrics.map(m => (
                            <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Targeting</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p><strong>Traffic:</strong> {trafficPercentage}%</p>
                    {segments.length > 0 && (
                      <p>
                        <strong>Segments:</strong> {segments.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStepIndex === 0}
          >
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push('/experiments')}>
              Cancel
            </Button>
            {currentStep === 'review' ? (
              <Button onClick={handleCreate} disabled={!canProceed()}>
                Create Experiment
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
