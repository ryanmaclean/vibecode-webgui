/**
 * CreateAgentWizard Component
 *
 * Step-by-step wizard for creating new AI agents with
 * validation, preview, and template selection.
 *
 * Features:
 * - Multi-step wizard flow
 * - Template selection
 * - Configuration validation
 * - Preview before creation
 * - Progress tracking
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/agents/CreateAgentWizard
 */

'use client'

import React, { useState, useCallback } from 'react'
import {
Wand2,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Settings,
  Eye,
  Loader
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
// import { logger } from '@/lib/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export interface AgentTemplate {
  id: string
  name: string
  description: string
  icon: string
  presetConfig: Partial<WizardData>
}

export interface WizardData {
  template?: string
  name: string
  description: string
  model: string
  instructions: string
  tools: {
    codeInterpreter: boolean
    fileSearch: boolean
    functions: boolean
  }
  temperature: number
  maxTokens: number
}

export interface CreateAgentWizardProps {
  /** Callback when agent is created */
  onCreate?: (data: WizardData) => Promise<void>
  /** Callback when wizard is cancelled */
  onCancel?: () => void
  /** Available templates */
  templates?: AgentTemplate[]
  /** Custom className */
  className?: string
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'general',
    name: 'General Assistant',
    description: 'Versatile AI assistant for general tasks',
    icon: '🤖',
    presetConfig: {
      model: 'gpt-4-turbo-preview',
      instructions: 'You are a helpful AI assistant.',
      tools: { codeInterpreter: false, fileSearch: false, functions: true },
      temperature: 0.7,
      maxTokens: 2048
    }
  },
  {
    id: 'code',
    name: 'Code Assistant',
    description: 'Specialized in coding and debugging',
    icon: '💻',
    presetConfig: {
      model: 'gpt-4-turbo-preview',
      instructions: 'You are an expert programming assistant.',
      tools: { codeInterpreter: true, fileSearch: true, functions: true },
      temperature: 0.5,
      maxTokens: 4096
    }
  },
  {
    id: 'research',
    name: 'Research Assistant',
    description: 'Specialized in research and analysis',
    icon: '🔬',
    presetConfig: {
      model: 'gpt-4-turbo-preview',
      instructions: 'You are a research assistant focused on thorough analysis.',
      tools: { codeInterpreter: false, fileSearch: true, functions: true },
      temperature: 0.3,
      maxTokens: 4096
    }
  },
  {
    id: 'creative',
    name: 'Creative Assistant',
    description: 'Specialized in creative writing and ideation',
    icon: '✨',
    presetConfig: {
      model: 'gpt-4-turbo-preview',
      instructions: 'You are a creative assistant focused on innovation.',
      tools: { codeInterpreter: false, fileSearch: false, functions: true },
      temperature: 1.0,
      maxTokens: 2048
    }
  }
]

const STEPS = [
  { id: 'template', title: 'Choose Template', icon: Sparkles },
  { id: 'details', title: 'Agent Details', icon: Settings },
  { id: 'review', title: 'Review & Create', icon: Eye }
]

// ============================================================================
// Step Components
// ============================================================================

interface TemplateStepProps {
  templates: AgentTemplate[]
  selected?: string
  onSelect: (templateId: string) => void
}

function TemplateStep({ templates, selected, onSelect }: TemplateStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Choose a Template</h3>
        <p className="text-sm text-muted-foreground">
          Start with a preset configuration or create from scratch
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            className={cn(
              "p-4 border-2 rounded-lg text-left transition-all hover:border-primary",
              selected === template.id && "border-primary bg-primary/5"
            )}
            aria-pressed={selected === template.id}
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl" role="img" aria-label={template.name}>
                {template.icon}
              </span>
              <div className="flex-1">
                <div className="font-medium mb-1">{template.name}</div>
                <div className="text-sm text-muted-foreground">
                  {template.description}
                </div>
              </div>
              {selected === template.id && (
                <Check className="h-5 w-5 text-primary" aria-hidden="true" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

interface DetailsStepProps {
  data: WizardData
  onChange: (updates: Partial<WizardData>) => void
}

function DetailsStep({ data, onChange }: DetailsStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Configure Your Agent</h3>
        <p className="text-sm text-muted-foreground">
          Customize the agent&apos;s behavior and capabilities
</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="agent-name">Agent Name</Label>
          <input
            id="agent-name"
            type="text"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="My Assistant"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="agent-description">Description</Label>
          <textarea
            id="agent-description"
            value={data.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
            placeholder="Describe what this agent will do..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructions">System Instructions</Label>
          <textarea
            id="instructions"
            value={data.instructions}
            onChange={(e) => onChange({ instructions: e.target.value })}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
            placeholder="Enter system instructions..."
          />
        </div>
      </div>
    </div>
  )
}

interface ReviewStepProps {
  data: WizardData
  template?: AgentTemplate
}

function ReviewStep({ data, template }: ReviewStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Review Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Verify all settings before creating your agent
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 border rounded-lg space-y-3">
          <div>
            <div className="text-sm font-medium mb-1">Template</div>
            <div className="flex items-center gap-2">
              {template && (
                <>
                  <span role="img" aria-label={template.name}>{template.icon}</span>
                  <span className="text-sm">{template.name}</span>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Name</div>
            <div className="text-sm text-muted-foreground">{data.name || 'Unnamed Agent'}</div>
          </div>

          {data.description && (
            <div>
              <div className="text-sm font-medium mb-1">Description</div>
              <div className="text-sm text-muted-foreground">{data.description}</div>
            </div>
          )}

          <div>
            <div className="text-sm font-medium mb-1">Model</div>
            <Badge variant="outline">{data.model}</Badge>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Enabled Tools</div>
            <div className="flex flex-wrap gap-2">
              {data.tools.codeInterpreter && (
                <Badge variant="secondary">Code Interpreter</Badge>
              )}
              {data.tools.fileSearch && (
                <Badge variant="secondary">File Search</Badge>
              )}
              {data.tools.functions && (
                <Badge variant="secondary">Functions</Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <div className="text-sm font-medium mb-1">Temperature</div>
              <div className="text-sm text-muted-foreground">{data.temperature}</div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Max Tokens</div>
              <div className="text-sm text-muted-foreground">{data.maxTokens}</div>
            </div>
          </div>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Instructions Preview</h4>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {data.instructions || 'No instructions provided'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function CreateAgentWizard({
  onCreate,
  onCancel,
  templates = DEFAULT_TEMPLATES,
  className
}: CreateAgentWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [wizardData, setWizardData] = useState<WizardData>({
    name: '',
    description: '',
    model: 'gpt-4-turbo-preview',
    instructions: '',
    tools: { codeInterpreter: false, fileSearch: false, functions: true },
    temperature: 0.7,
    maxTokens: 2048
  })

  const currentTemplate = wizardData.template
    ? templates.find(t => t.id === wizardData.template)
    : undefined

  const updateWizardData = useCallback((updates: Partial<WizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }))
  }, [])

  const handleTemplateSelect = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setWizardData(prev => ({
        ...prev,
        template: templateId,
        ...template.presetConfig
      }))
    }
  }, [templates])

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }, [currentStep])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const handleCreate = useCallback(async () => {
    if (!onCreate) return

    setIsCreating(true)
    try {
      await onCreate(wizardData)
    } catch (error) {
      console.error('Failed to create agent:', error)
    } finally {
      setIsCreating(false)
    }
  }, [onCreate, wizardData])

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return wizardData.template !== undefined
      case 1:
        return wizardData.name.trim().length >= 3 && wizardData.instructions.trim().length >= 10
      case 2:
        return true
      default:
        return false
    }
  }

  const progress = ((currentStep + 1) / STEPS.length) * 100

  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wand2 className="h-5 w-5" aria-hidden="true" />
            Create New Agent
          </CardTitle>
          <Badge variant="outline">
            Step {currentStep + 1} of {STEPS.length}
          </Badge>
        </div>
        <Progress value={progress} className="h-2" aria-label={`Progress: ${progress}%`} />
      </CardHeader>

      <CardContent className="pt-6">
        {/* Step Indicators */}
        <div className="flex justify-between mb-8">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isCompleted = index < currentStep

            return (
              <div
                key={step.id}
                className={cn(
                  "flex flex-col items-center gap-2 flex-1",
                  index < STEPS.length - 1 && "relative"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isActive && "border-primary",
                    !isActive && !isCompleted && "border-muted-foreground/30"
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs text-center",
                    isActive && "font-medium",
                    !isActive && "text-muted-foreground"
                  )}
                >
                  {step.title}
                </span>
              </div>
            )
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === 0 && (
            <TemplateStep
              templates={templates}
              selected={wizardData.template}
              onSelect={handleTemplateSelect}
            />
          )}
          {currentStep === 1 && (
            <DetailsStep data={wizardData} onChange={updateWizardData} />
          )}
          {currentStep === 2 && (
            <ReviewStep data={wizardData} template={currentTemplate} />
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-6">
        <div>
          {currentStep > 0 && (
            <Button variant="outline" onClick={handleBack} disabled={isCreating}>
              <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={isCreating}>
              Cancel
            </Button>
          )}
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={isCreating || !canProceed()}>
              {isCreating ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  Creating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" aria-hidden="true" />
                  Create Agent
                </>
              )}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
