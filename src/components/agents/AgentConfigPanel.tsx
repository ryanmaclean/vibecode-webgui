/**
 * AgentConfigPanel Component
 *
 * Configuration panel for OpenAI Agents with model selection,
 * tool configuration, and advanced settings.
 *
 * Features:
 * - Model selection with capability indicators
 * - Tool configuration (code interpreter, file search, functions)
 * - Temperature and response length controls
 * - Instruction and system prompt editing
 * - Real-time validation
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/agents/AgentConfigPanel
 */

'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  Settings,
  Cpu,
  FileSearch,
  Code2,
  Zap,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// ============================================================================
// Type Definitions
// ============================================================================

interface AgentModel {
  id: string
  name: string
  description: string
  contextWindow: number
  supportsVision: boolean
  supportsFunctionCalling: boolean
  maxOutputTokens: number
}

interface ToolConfig {
  codeInterpreter: boolean
  fileSearch: boolean
  functions: boolean
}

interface AgentConfig {
  name: string
  model: string
  instructions: string
  tools: ToolConfig
  temperature: number
  maxTokens: number
  topP: number
}

interface AgentConfigPanelProps {
  /** Initial configuration */
  initialConfig?: Partial<AgentConfig>
  /** Callback when configuration changes */
  onChange?: (config: AgentConfig) => void
  /** Callback when configuration is saved */
  onSave?: (config: AgentConfig) => Promise<void>
  /** Whether the panel is in read-only mode */
  readOnly?: boolean
  /** Custom className */
  className?: string
}

// ============================================================================
// Constants
// ============================================================================

const AVAILABLE_MODELS: AgentModel[] = [
  {
    id: 'gpt-4-turbo-preview',
    name: 'GPT-4 Turbo',
    description: 'Most capable model, best for complex tasks',
    contextWindow: 128000,
    supportsVision: true,
    supportsFunctionCalling: true,
    maxOutputTokens: 4096
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    description: 'High intelligence, slower and more expensive',
    contextWindow: 8192,
    supportsVision: false,
    supportsFunctionCalling: true,
    maxOutputTokens: 4096
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast and efficient for simpler tasks',
    contextWindow: 16384,
    supportsVision: false,
    supportsFunctionCalling: true,
    maxOutputTokens: 4096
  }
]

const DEFAULT_CONFIG: AgentConfig = {
  name: 'New Agent',
  model: 'gpt-4-turbo-preview',
  instructions: 'You are a helpful AI assistant.',
  tools: {
    codeInterpreter: false,
    fileSearch: false,
    functions: true
  },
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0
}

// ============================================================================
// Component
// ============================================================================

export function AgentConfigPanel({
  initialConfig,
  onChange,
  onSave,
  readOnly = false,
  className
}: AgentConfigPanelProps) {
  const [config, setConfig] = useState<AgentConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const selectedModel = AVAILABLE_MODELS.find(m => m.id === config.model)

  // Validate configuration
  useEffect(() => {
    const errors: string[] = []

    if (config.name.trim().length < 3) {
      errors.push('Agent name must be at least 3 characters')
    }

    if (config.instructions.trim().length < 10) {
      errors.push('Instructions must be at least 10 characters')
    }

    if (config.maxTokens > (selectedModel?.maxOutputTokens || 4096)) {
      errors.push(`Max tokens cannot exceed ${selectedModel?.maxOutputTokens}`)
    }

    if (config.temperature < 0 || config.temperature > 2) {
      errors.push('Temperature must be between 0 and 2')
    }

    setValidationErrors(errors)
  }, [config, selectedModel])

  // Notify parent of changes
  useEffect(() => {
    if (onChange && validationErrors.length === 0) {
      onChange(config)
    }
  }, [config, onChange, validationErrors])

  const updateConfig = useCallback(<K extends keyof AgentConfig>(
    key: K,
    value: AgentConfig[K]
  ) => {
    if (readOnly) return
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaveStatus('idle')
  }, [readOnly])

  const updateToolConfig = useCallback((tool: keyof ToolConfig, enabled: boolean) => {
    if (readOnly) return
    setConfig(prev => ({
      ...prev,
      tools: { ...prev.tools, [tool]: enabled }
    }))
    setSaveStatus('idle')
  }, [readOnly])

  const handleSave = useCallback(async () => {
    if (validationErrors.length > 0 || !onSave) return

    setIsSaving(true)
    setSaveStatus('idle')

    try {
      await onSave(config)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (error) {
      logger.error('Failed to save configuration:', error)
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }, [config, onSave, validationErrors])

  const handleReset = useCallback(() => {
    if (readOnly) return
    setConfig({ ...DEFAULT_CONFIG, ...initialConfig })
    setSaveStatus('idle')
    setValidationErrors([])
  }, [initialConfig, readOnly])

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" aria-hidden="true" />
              Agent Configuration
            </CardTitle>
            <CardDescription>
              Configure your AI agent&apos;s behavior and capabilities
import { logger } from '@/lib/logger';
            </CardDescription>
          </div>
          {saveStatus !== 'idle' && (
            <Badge
              variant={saveStatus === 'success' ? 'default' : 'destructive'}
              className="flex items-center gap-1"
            >
              {saveStatus === 'success' ? (
                <>
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Saved
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  Error
                </>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent Name</Label>
              <input
                id="agent-name"
                type="text"
                value={config.name}
                onChange={(e) => updateConfig('name', e.target.value)}
                disabled={readOnly}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter agent name"
                aria-describedby={validationErrors.some(e => e.includes('name')) ? 'name-error' : undefined}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model-select">Model</Label>
              <Select
                value={config.model}
                onValueChange={(value) => updateConfig('model', value)}
                disabled={readOnly}
              >
                <SelectTrigger id="model-select" aria-label="Select AI model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedModel && (
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {(selectedModel.contextWindow / 1000).toFixed(0)}K context
                  </Badge>
                  {selectedModel.supportsVision && (
                    <Badge variant="outline" className="text-xs">Vision</Badge>
                  )}
                  {selectedModel.supportsFunctionCalling && (
                    <Badge variant="outline" className="text-xs">Functions</Badge>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <textarea
                id="instructions"
                value={config.instructions}
                onChange={(e) => updateConfig('instructions', e.target.value)}
                disabled={readOnly}
                rows={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                placeholder="Enter system instructions for the agent..."
                aria-describedby={validationErrors.some(e => e.includes('Instructions')) ? 'instructions-error' : undefined}
              />
              <p className="text-xs text-muted-foreground">
                {config.instructions.length} characters
              </p>
            </div>
          </TabsContent>

          {/* Tools Settings */}
          <TabsContent value="tools" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <Code2 className="h-5 w-5 mt-0.5 text-muted-foreground" aria-hidden="true" />
                  <div className="space-y-1">
                    <Label htmlFor="code-interpreter" className="text-base">
                      Code Interpreter
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Execute Python code and work with files
                    </p>
                  </div>
                </div>
                <Switch
                  id="code-interpreter"
                  checked={config.tools.codeInterpreter}
                  onCheckedChange={(checked) => updateToolConfig('codeInterpreter', checked)}
                  disabled={readOnly}
                  aria-label="Enable code interpreter"
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <FileSearch className="h-5 w-5 mt-0.5 text-muted-foreground" aria-hidden="true" />
                  <div className="space-y-1">
                    <Label htmlFor="file-search" className="text-base">
                      File Search
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Search and retrieve information from files
                    </p>
                  </div>
                </div>
                <Switch
                  id="file-search"
                  checked={config.tools.fileSearch}
                  onCheckedChange={(checked) => updateToolConfig('fileSearch', checked)}
                  disabled={readOnly}
                  aria-label="Enable file search"
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 mt-0.5 text-muted-foreground" aria-hidden="true" />
                  <div className="space-y-1">
                    <Label htmlFor="functions" className="text-base">
                      Function Calling
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Call custom functions and external APIs
                    </p>
                  </div>
                </div>
                <Switch
                  id="functions"
                  checked={config.tools.functions}
                  onCheckedChange={(checked) => updateToolConfig('functions', checked)}
                  disabled={readOnly}
                  aria-label="Enable function calling"
                />
              </div>
            </div>
          </TabsContent>

          {/* Advanced Settings */}
          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature">Temperature</Label>
                <span className="text-sm text-muted-foreground">{config.temperature}</span>
              </div>
              <input
                id="temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                disabled={readOnly}
                className="w-full"
                aria-label="Temperature slider"
              />
              <p className="text-xs text-muted-foreground">
                Controls randomness: 0 is focused, 2 is creative
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="max-tokens">Max Output Tokens</Label>
                <span className="text-sm text-muted-foreground">{config.maxTokens}</span>
              </div>
              <input
                id="max-tokens"
                type="range"
                min="256"
                max={selectedModel?.maxOutputTokens || 4096}
                step="256"
                value={config.maxTokens}
                onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
                disabled={readOnly}
                className="w-full"
                aria-label="Max tokens slider"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="top-p">Top P (Nucleus Sampling)</Label>
                <span className="text-sm text-muted-foreground">{config.topP}</span>
              </div>
              <input
                id="top-p"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.topP}
                onChange={(e) => updateConfig('topP', parseFloat(e.target.value))}
                disabled={readOnly}
                className="w-full"
                aria-label="Top P slider"
              />
              <p className="text-xs text-muted-foreground">
                Controls diversity: lower values make responses more focused
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Configuration Issues</p>
                <ul className="mt-2 text-sm text-destructive space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {!readOnly && (
        <CardFooter className="flex justify-between border-t pt-6">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
            aria-label="Reset to defaults"
          >
            <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || validationErrors.length > 0}
            aria-label="Save configuration"
          >
            <Save className="h-4 w-4 mr-2" aria-hidden="true" />
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
