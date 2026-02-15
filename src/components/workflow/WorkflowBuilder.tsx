/**
 * WorkflowBuilder
 *
 * Visual workflow builder with canvas for creating and editing multi-agent orchestration workflows.
 * Provides a drag-and-drop interface for building complex workflow graphs with approval gates,
 * conditions, and agent tasks.
 *
 * Features:
 * - Interactive canvas for workflow visualization
 * - Real-time workflow validation
 * - Integration with workflow engine and HITL manager
 * - Support for all workflow node types
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
} from '@/lib/workflow/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader, Save, Play, Settings, Grid } from 'lucide-react'
import { z } from '@/lib/zod-compat'

export interface WorkflowBuilderProps {
  /** Initial workflow definition */
  initialWorkflow?: WorkflowDefinition
  /** Callback when workflow is saved */
  onSave?: (workflow: WorkflowDefinition) => void
  /** Callback when workflow is executed */
  onExecute?: (workflow: WorkflowDefinition) => void
  /** Read-only mode */
  readOnly?: boolean
}

const workflowMetadataSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Workflow name is required')
    .max(64, 'Workflow name must be 64 characters or fewer')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Workflow name can only contain letters, numbers, hyphens, and underscores'),
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (e.g., 1.0.0)'),
  description: z.string().max(500, 'Description must be 500 characters or fewer').optional(),
})

/**
 * WorkflowBuilder Component
 *
 * Creates a visual canvas for building workflows with nodes and edges.
 * This base component provides the foundation for drag-and-drop workflow creation.
 */
export function WorkflowBuilder({
  initialWorkflow,
  onSave,
  onExecute,
  readOnly = false,
}: WorkflowBuilderProps) {
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(
    initialWorkflow || {
      name: 'new-workflow',
      version: '1.0.0',
      description: '',
      nodes: [],
      edges: [],
      tags: [],
    }
  )

  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)

  // Validate workflow metadata
  const validateMetadata = useCallback(() => {
    try {
      workflowMetadataSchema.parse({
        name: workflow.name,
        version: workflow.version,
        description: workflow.description,
      })
      setValidationError(null)
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        setValidationError(error.errors[0]?.message || 'Validation error')
      } else {
        setValidationError('Unknown validation error')
      }
      return false
    }
  }, [workflow.name, workflow.version, workflow.description])

  // Update workflow metadata
  const updateMetadata = useCallback(
    (updates: Partial<Pick<WorkflowDefinition, 'name' | 'version' | 'description'>>) => {
      setWorkflow(prev => ({ ...prev, ...updates }))
      setValidationError(null)
    },
    []
  )

  // Handle save workflow
  const handleSave = useCallback(async () => {
    if (!validateMetadata()) {
      return
    }

    setIsSaving(true)
    try {
      await onSave?.(workflow)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save workflow'
      setValidationError(message)
    } finally {
      setIsSaving(false)
    }
  }, [workflow, onSave, validateMetadata])

  // Handle execute workflow
  const handleExecute = useCallback(async () => {
    if (!validateMetadata()) {
      return
    }

    if (workflow.nodes.length === 0) {
      setValidationError('Cannot execute empty workflow. Add at least one node.')
      return
    }

    setIsExecuting(true)
    try {
      await onExecute?.(workflow)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute workflow'
      setValidationError(message)
    } finally {
      setIsExecuting(false)
    }
  }, [workflow, onExecute, validateMetadata])

  // Calculate workflow statistics
  const workflowStats = useMemo(() => {
    return {
      nodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
      hasAgentTasks: workflow.nodes.some(n => n.type === 'agent-task'),
      hasApprovalGates: false, // Will be updated when approval gates are added
    }
  }, [workflow.nodes, workflow.edges])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <Card className="rounded-none border-x-0 border-t-0">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Grid className="h-5 w-5" />
                Workflow Builder
              </CardTitle>
              <CardDescription>
                Create and orchestrate multi-agent workflows with approval gates
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!readOnly && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleExecute}
                    disabled={isExecuting || workflow.nodes.length === 0}
                  >
                    {isExecuting ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Execute
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Validation Errors */}
      {validationError && (
        <Alert variant="destructive" className="m-4">
          <AlertTitle>Validation Error</AlertTitle>
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {/* Workflow Metadata */}
      <Card className="m-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Workflow Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">Name</Label>
              <Input
                id="workflow-name"
                value={workflow.name}
                onChange={e => updateMetadata({ name: e.target.value })}
                disabled={readOnly}
                placeholder="my-workflow"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-version">Version</Label>
              <Input
                id="workflow-version"
                value={workflow.version}
                onChange={e => updateMetadata({ version: e.target.value })}
                disabled={readOnly}
                placeholder="1.0.0"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workflow-description">Description</Label>
            <Input
              id="workflow-description"
              value={workflow.description || ''}
              onChange={e => updateMetadata({ description: e.target.value })}
              disabled={readOnly}
              placeholder="Describe your workflow..."
            />
          </div>

          {/* Workflow Statistics */}
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {workflowStats.nodeCount} {workflowStats.nodeCount === 1 ? 'node' : 'nodes'}
            </Badge>
            <Badge variant="secondary">
              {workflowStats.edgeCount} {workflowStats.edgeCount === 1 ? 'connection' : 'connections'}
            </Badge>
            {workflowStats.hasAgentTasks && (
              <Badge variant="default">Contains agent tasks</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Canvas */}
      <div className="flex flex-1 overflow-hidden">
        <Card className="m-4 flex-1">
          <CardContent className="flex h-full items-center justify-center p-0">
            <WorkflowCanvas
              workflow={workflow}
              readOnly={readOnly}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * WorkflowCanvas Component
 *
 * Renders the visual canvas for displaying and interacting with workflow nodes and edges.
 * This is the core visualization area where users build their workflows.
 */
function WorkflowCanvas({
  workflow,
  readOnly,
}: {
  workflow: WorkflowDefinition
  readOnly: boolean
}) {
  const isEmpty = workflow.nodes.length === 0

  return (
    <div className="relative h-full w-full bg-slate-50 dark:bg-slate-900">
      {/* Grid Background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(226 232 240 / 0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(226 232 240 / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Canvas Content */}
      <div className="relative h-full w-full overflow-auto">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Grid className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-slate-100">
                Empty Canvas
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {readOnly
                  ? 'No nodes in this workflow'
                  : 'Start building your workflow by adding nodes from the palette'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-8">
            {/* Node rendering will be added in next subtask */}
            <div className="space-y-4">
              {workflow.nodes.map(node => (
                <Card key={node.id} className="w-64">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{node.name}</CardTitle>
                    <CardDescription className="text-xs">{node.type}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
