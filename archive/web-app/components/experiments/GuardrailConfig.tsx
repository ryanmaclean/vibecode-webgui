/**
 * Guardrail Configuration Component
 *
 * UI for setting and displaying experiment guardrails.
 * Guardrails are safety thresholds that automatically pause experiments.
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { Guardrail } from '@/lib/experiments/guardrails'
import { GUARDRAIL_TEMPLATES, GUARDRAIL_PRESETS } from '@/lib/experiments/guardrail-templates'

interface GuardrailConfigProps {
  guardrails: Guardrail[]
  onChange: (guardrails: Guardrail[]) => void
  metricOptions: string[]
  readOnly?: boolean
  currentValues?: Record<string, number>
}

export function GuardrailConfig({
  guardrails,
  onChange,
  metricOptions,
  readOnly = false,
  currentValues = {}
}: GuardrailConfigProps) {
  const [editMode, setEditMode] = useState(false)
  const [localGuardrails, setLocalGuardrails] = useState<Guardrail[]>(guardrails)
  const [showTemplates, setShowTemplates] = useState(false)

  const operatorLabels = {
    '>': '>',
    '<': '<',
    '>=': '≥',
    '<=': '≤'
  }

  const operatorNames = {
    '>': 'Greater than',
    '<': 'Less than',
    '>=': 'Greater than or equal',
    '<=': 'Less than or equal'
  }

  const checkGuardrailViolation = (guardrail: Guardrail): boolean => {
    const currentValue = currentValues[guardrail.metricName]
    if (currentValue === undefined) return false

    switch (guardrail.operator) {
      case '>':
        return currentValue <= guardrail.threshold
      case '<':
        return currentValue >= guardrail.threshold
      case '>=':
        return currentValue < guardrail.threshold
      case '<=':
        return currentValue > guardrail.threshold
      default:
        return false
    }
  }

  const addGuardrail = () => {
    setLocalGuardrails([
      ...localGuardrails,
      {
        metricName: metricOptions[0] || '',
        operator: '<',
        threshold: 0,
        severity: 'warning'
      }
    ])
  }

  const addTemplate = (template: Guardrail) => {
    setLocalGuardrails([...localGuardrails, template])
    setShowTemplates(false)
  }

  const loadPreset = (presetName: keyof typeof GUARDRAIL_PRESETS) => {
    const preset = GUARDRAIL_PRESETS[presetName]()
    setLocalGuardrails(preset)
    setShowTemplates(false)
  }

  const removeGuardrail = (index: number) => {
    const updated = localGuardrails.filter((_, i) => i !== index)
    setLocalGuardrails(updated)
  }

  const updateGuardrail = (index: number, field: keyof Guardrail, value: any) => {
    const updated = [...localGuardrails]
    updated[index] = { ...updated[index], [field]: value }
    setLocalGuardrails(updated)
  }

  const saveChanges = () => {
    onChange(localGuardrails)
    setEditMode(false)
  }

  const cancelChanges = () => {
    setLocalGuardrails(guardrails)
    setEditMode(false)
    setShowTemplates(false)
  }

  if (editMode && !readOnly) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Guardrails</CardTitle>
              <CardDescription>
                Set safety thresholds to automatically pause the experiment
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={cancelChanges}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveChanges}>
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showTemplates ? (
            <div className="p-4 border rounded-lg space-y-3 bg-slate-50">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Guardrail Templates</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowTemplates(false)}>✕</Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Load Preset</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(GUARDRAIL_PRESETS).map((presetKey) => (
                    <Button
                      key={presetKey}
                      variant="outline"
                      size="sm"
                      onClick={() => loadPreset(presetKey as keyof typeof GUARDRAIL_PRESETS)}
                      className="justify-start"
                    >
                      {presetKey.replace(/([A-Z])/g, ' $1').trim()}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Add Individual Template</Label>
                <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                  <Button variant="outline" size="sm" onClick={() => addTemplate(GUARDRAIL_TEMPLATES.maxErrorRate())} className="justify-start text-xs">
                    Max Error Rate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addTemplate(GUARDRAIL_TEMPLATES.maxP95Latency())} className="justify-start text-xs">
                    Max P95 Latency
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addTemplate(GUARDRAIL_TEMPLATES.minUserSatisfaction())} className="justify-start text-xs">
                    Min User Satisfaction
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addTemplate(GUARDRAIL_TEMPLATES.maxCostPerRequest())} className="justify-start text-xs">
                    Max Cost Per Request
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {localGuardrails.map((guardrail, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div>
                    <Label className="text-xs">Metric Name</Label>
                    <select
                      value={guardrail.metricName}
                      onChange={(e) => updateGuardrail(index, 'metricName', e.target.value)}
                      className="mt-1 w-full h-10 px-3 border rounded-md text-sm"
                    >
                      <option value="">Select metric...</option>
                      {metricOptions.map((metric) => (
                        <option key={metric} value={metric}>{metric}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-32">
                      <Label className="text-xs">Operator</Label>
                      <select
                        value={guardrail.operator}
                        onChange={(e) => updateGuardrail(index, 'operator', e.target.value as Guardrail['operator'])}
                        className="mt-1 w-full h-10 px-3 border rounded-md text-sm"
                      >
                        {Object.entries(operatorNames).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Threshold</Label>
                      <Input
                        type="number"
                        value={guardrail.threshold}
                        onChange={(e) => updateGuardrail(index, 'threshold', parseFloat(e.target.value))}
                        placeholder="0.05"
                        step="0.01"
                        className="mt-1"
                      />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs">Severity</Label>
                      <select
                        value={guardrail.severity}
                        onChange={(e) => updateGuardrail(index, 'severity', e.target.value as 'warning' | 'critical')}
                        className="mt-1 w-full h-10 px-3 border rounded-md text-sm"
                      >
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGuardrail(index)}
                  className="ml-2"
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addGuardrail} className="flex-1">
              + Add Guardrail
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowTemplates(!showTemplates)} className="flex-1">
              {showTemplates ? 'Hide Templates' : 'Show Templates'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Guardrails</CardTitle>
            <CardDescription>
              Safety thresholds that pause the experiment if violated
            </CardDescription>
          </div>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {localGuardrails.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No guardrails configured</p>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditMode(true)}
                className="mt-3"
              >
                Add Guardrail
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {localGuardrails.map((guardrail, index) => {
              const isViolated = checkGuardrailViolation(guardrail)
              const currentValue = currentValues[guardrail.metricName]
              const severityColor = guardrail.severity === 'critical' ? 'text-red-600' : 'text-orange-600'

              return (
                <div
                  key={index}
                  className={`p-3 border rounded-lg ${
                    isViolated ? 'border-red-300 bg-red-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm">
                          {guardrail.metricName.replace(/_/g, ' ')}
                        </div>
                        <Badge
                          variant={guardrail.severity === 'critical' ? 'destructive' : 'default'}
                          className="text-xs"
                        >
                          {guardrail.severity}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Must be {operatorLabels[guardrail.operator]} {guardrail.threshold}
                        {currentValue !== undefined && (
                          <span className={isViolated ? 'text-red-600 font-medium ml-2' : 'ml-2'}>
                            (Current: {currentValue.toFixed(3)})
                          </span>
                        )}
                      </div>
                      {guardrail.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {guardrail.description}
                        </div>
                      )}
                    </div>
                    {isViolated ? (
                      <Badge variant="destructive" className="ml-2">
                        VIOLATED
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                        OK
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
