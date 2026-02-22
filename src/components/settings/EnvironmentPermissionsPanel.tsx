/**
 * EnvironmentPermissionsPanel Component
 *
 * Settings panel for configuring environment-specific agent permissions
 * with environment detection and safety controls.
 *
 * Features:
 * - Environment detection toggle
 * - Per-environment permission configuration (dev/staging/prod)
 * - Permission decision selection (allowed/denied/requires_approval)
 * - Approver management for environments
 * - Visual indicator settings
 * - Fallback environment configuration
 * - Real-time validation
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/settings/EnvironmentPermissionsPanel
 */

'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Save,
  RotateCcw,
  Eye,
  AlertCircle,
  Settings,
  Laptop,
  Server,
  CloudCog
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { EnvironmentSettings } from '@/types/settings'
import type { EnvironmentType } from '@/lib/environment/types'

// ============================================================================
// Type Definitions
// ============================================================================

export interface EnvironmentPermissionsPanelProps {
  /** Initial configuration */
  initialSettings?: Partial<EnvironmentSettings>
  /** Callback when settings change */
  onChange?: (settings: EnvironmentSettings) => void
  /** Callback when settings are saved */
  onSave?: (settings: EnvironmentSettings) => Promise<void>
  /** Whether the panel is in read-only mode */
  readOnly?: boolean
  /** Custom className */
  className?: string
}

type PermissionDecision = 'allowed' | 'denied' | 'requires_approval'

interface EnvironmentPermissionConfig {
  enabled: boolean
  defaultDecision: PermissionDecision
  approvers: string[]
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SETTINGS: EnvironmentSettings = {
  detectionEnabled: true,
  permissions: {
    enabled: true,
    unknownEnvironmentDefault: 'denied',
    logChecks: true,
    development: {
      enabled: true,
      defaultDecision: 'allowed',
      approvers: [],
    },
    staging: {
      enabled: true,
      defaultDecision: 'requires_approval',
      approvers: [],
    },
    production: {
      enabled: true,
      defaultDecision: 'requires_approval',
      approvers: [],
    },
  },
  showEnvironmentBadge: true,
  warnOnConflicts: true,
  fallbackEnvironment: 'development',
}

const ENVIRONMENT_CONFIGS = [
  {
    id: 'development' as const,
    name: 'Development',
    description: 'Local development environment - typically allows all operations',
    icon: Laptop,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  {
    id: 'staging' as const,
    name: 'Staging',
    description: 'Pre-production testing environment - requires approval for risky operations',
    icon: CloudCog,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  {
    id: 'production' as const,
    name: 'Production',
    description: 'Live production environment - requires approval for all operations',
    icon: Server,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
]

const PERMISSION_DECISIONS: Array<{
  value: PermissionDecision
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}> = [
  {
    value: 'allowed',
    label: 'Allowed',
    description: 'Operations proceed without approval',
    icon: CheckCircle,
    color: 'text-green-600',
  },
  {
    value: 'denied',
    label: 'Denied',
    description: 'Operations are blocked',
    icon: XCircle,
    color: 'text-red-600',
  },
  {
    value: 'requires_approval',
    label: 'Requires Approval',
    description: 'Operations require human approval',
    icon: AlertTriangle,
    color: 'text-yellow-600',
  },
]

// ============================================================================
// Component
// ============================================================================

export function EnvironmentPermissionsPanel({
  initialSettings,
  onChange,
  onSave,
  readOnly = false,
  className
}: EnvironmentPermissionsPanelProps) {
  // Check user authorization
  const { user, isLoading } = useAuth()
  const isAdmin = user?.role === 'admin'

  // Prevent non-admins from modifying environment permissions
  const effectiveReadOnly = readOnly || !isAdmin

  const [settings, setSettings] = useState<EnvironmentSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
    permissions: {
      ...DEFAULT_SETTINGS.permissions,
      ...initialSettings?.permissions,
      development: {
        ...DEFAULT_SETTINGS.permissions.development!,
        ...initialSettings?.permissions?.development,
      },
      staging: {
        ...DEFAULT_SETTINGS.permissions.staging!,
        ...initialSettings?.permissions?.staging,
      },
      production: {
        ...DEFAULT_SETTINGS.permissions.production!,
        ...initialSettings?.permissions?.production,
      },
    },
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Show warning if user is not admin
  if (!isLoading && !isAdmin && !readOnly) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Environment Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Admin Access Required</AlertTitle>
            <AlertDescription>
              You need administrator privileges to view or modify environment permissions.
              Contact your system administrator for access.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // Validate settings
  useEffect(() => {
    const errors: string[] = []

    if (!settings.permissions.enabled && settings.detectionEnabled) {
      errors.push('Environment detection is enabled but permissions are disabled')
    }

    if (
      settings.permissions.production?.defaultDecision === 'allowed' &&
      settings.permissions.production.enabled
    ) {
      errors.push('Production environment should not allow all operations by default')
    }

    setValidationErrors(errors)
  }, [settings])

  // Notify parent of changes
  useEffect(() => {
    if (onChange && validationErrors.length === 0) {
      onChange(settings)
    }
  }, [settings, onChange, validationErrors])

  const updateSetting = useCallback(<K extends keyof EnvironmentSettings>(
    key: K,
    value: EnvironmentSettings[K]
  ) => {
    if (effectiveReadOnly) return
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaveStatus('idle')
  }, [effectiveReadOnly])

  const updatePermissionsGlobal = useCallback(<K extends keyof EnvironmentSettings['permissions']>(
    key: K,
    value: EnvironmentSettings['permissions'][K]
  ) => {
    if (effectiveReadOnly) return
    setSettings(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: value }
    }))
    setSaveStatus('idle')
  }, [effectiveReadOnly])

  const updateEnvironmentPermission = useCallback((
    environment: 'development' | 'staging' | 'production',
    field: keyof EnvironmentPermissionConfig,
    value: boolean | PermissionDecision | string[]
  ) => {
    if (effectiveReadOnly) return
    setSettings(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [environment]: {
          ...prev.permissions[environment],
          [field]: value,
        },
      },
    }))
    setSaveStatus('idle')
  }, [effectiveReadOnly])

  const handleSave = useCallback(async () => {
    if (effectiveReadOnly || !onSave || validationErrors.length > 0) return

    setIsSaving(true)
    setSaveStatus('idle')

    try {
      await onSave(settings)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (error) {
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }, [settings, onSave, effectiveReadOnly, validationErrors])

  const handleReset = useCallback(() => {
    if (effectiveReadOnly) return
    setSettings({
      ...DEFAULT_SETTINGS,
      ...initialSettings,
      permissions: {
        ...DEFAULT_SETTINGS.permissions,
        ...initialSettings?.permissions,
        development: {
          ...DEFAULT_SETTINGS.permissions.development!,
          ...initialSettings?.permissions?.development,
        },
        staging: {
          ...DEFAULT_SETTINGS.permissions.staging!,
          ...initialSettings?.permissions?.staging,
        },
        production: {
          ...DEFAULT_SETTINGS.permissions.production!,
          ...initialSettings?.permissions?.production,
        },
      },
    })
    setSaveStatus('idle')
  }, [initialSettings, effectiveReadOnly])

  const getDecisionConfig = (decision: PermissionDecision) => {
    return PERMISSION_DECISIONS.find(d => d.value === decision) || PERMISSION_DECISIONS[0]
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Environment Permissions
            </CardTitle>
            <CardDescription>
              Configure environment detection and safety controls for agent operations
            </CardDescription>
          </div>
          {validationErrors.length > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {validationErrors.length} {validationErrors.length === 1 ? 'Error' : 'Errors'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Global Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Global Settings
          </h3>

          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="detection-enabled">Environment Detection</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically detect current environment (dev/staging/prod)
                </p>
              </div>
              <Switch
                id="detection-enabled"
                checked={settings.detectionEnabled}
                onCheckedChange={(checked) => updateSetting('detectionEnabled', checked)}
                disabled={effectiveReadOnly}
                aria-label="Toggle environment detection"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="permissions-enabled">Permission System</Label>
                <p className="text-sm text-muted-foreground">
                  Enable environment-based permission checks
                </p>
              </div>
              <Switch
                id="permissions-enabled"
                checked={settings.permissions.enabled}
                onCheckedChange={(checked) => updatePermissionsGlobal('enabled', checked)}
                disabled={effectiveReadOnly}
                aria-label="Toggle permission system"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-badge">Environment Badge</Label>
                <p className="text-sm text-muted-foreground">
                  Show environment indicator in UI
                </p>
              </div>
              <Switch
                id="show-badge"
                checked={settings.showEnvironmentBadge}
                onCheckedChange={(checked) => updateSetting('showEnvironmentBadge', checked)}
                disabled={effectiveReadOnly}
                aria-label="Toggle environment badge visibility"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="warn-conflicts">Conflict Warnings</Label>
                <p className="text-sm text-muted-foreground">
                  Warn when environment detection signals conflict
                </p>
              </div>
              <Switch
                id="warn-conflicts"
                checked={settings.warnOnConflicts}
                onCheckedChange={(checked) => updateSetting('warnOnConflicts', checked)}
                disabled={effectiveReadOnly}
                aria-label="Toggle conflict warnings"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fallback-env">Fallback Environment</Label>
              <Select
                value={settings.fallbackEnvironment}
                onValueChange={(value) => {
                  // Type-safe: value is already one of the valid fallback environments
                  updateSetting('fallbackEnvironment', value as Exclude<EnvironmentType, 'unknown'>);
                }}
                disabled={effectiveReadOnly}
              >
                <SelectTrigger id="fallback-env" aria-label="Select fallback environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                  {/* "unknown" is intentionally excluded - not a valid fallback */}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used when environment cannot be detected
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unknown-default">Unknown Environment Default</Label>
              <Select
                value={settings.permissions.unknownEnvironmentDefault}
                onValueChange={(value) => updatePermissionsGlobal('unknownEnvironmentDefault', value as PermissionDecision)}
                disabled={effectiveReadOnly}
              >
                <SelectTrigger id="unknown-default" aria-label="Select default for unknown environments">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERMISSION_DECISIONS.map((decision) => {
                    const Icon = decision.icon
                    return (
                      <SelectItem key={decision.value} value={decision.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={cn('h-4 w-4', decision.color)} />
                          <span>{decision.label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Permission decision for unknown environments
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="log-checks">Log Permission Checks</Label>
                <p className="text-sm text-muted-foreground">
                  Log all permission checks for auditing
                </p>
              </div>
              <Switch
                id="log-checks"
                checked={settings.permissions.logChecks}
                onCheckedChange={(checked) => updatePermissionsGlobal('logChecks', checked)}
                disabled={effectiveReadOnly}
                aria-label="Toggle permission check logging"
              />
            </div>
          </div>
        </div>

        {/* Environment-Specific Permissions */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Environment-Specific Permissions
          </h3>

          <Tabs defaultValue="development" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              {ENVIRONMENT_CONFIGS.map((env) => {
                const Icon = env.icon
                return (
                  <TabsTrigger key={env.id} value={env.id} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {env.name}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {ENVIRONMENT_CONFIGS.map((env) => {
              const envSettings = settings.permissions[env.id]
              const Icon = env.icon
              const decisionConfig = getDecisionConfig(envSettings?.defaultDecision || 'denied')
              const DecisionIcon = decisionConfig.icon

              return (
                <TabsContent key={env.id} value={env.id} className="space-y-4">
                  <div className={cn('rounded-lg border-2 p-4', env.borderColor, env.bgColor)}>
                    <div className="flex items-start gap-3 mb-4">
                      <Icon className={cn('h-6 w-6 mt-0.5', env.color)} />
                      <div className="flex-1">
                        <h4 className="font-medium">{env.name} Environment</h4>
                        <p className="text-sm text-muted-foreground mt-1">{env.description}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor={`${env.id}-enabled`}>Enable Permissions</Label>
                          <p className="text-sm text-muted-foreground">
                            Apply permission checks in this environment
                          </p>
                        </div>
                        <Switch
                          id={`${env.id}-enabled`}
                          checked={envSettings?.enabled ?? true}
                          onCheckedChange={(checked) => updateEnvironmentPermission(env.id, 'enabled', checked)}
                          disabled={effectiveReadOnly}
                          aria-label={`Toggle ${env.name} environment permissions`}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${env.id}-decision`}>Default Permission Decision</Label>
                        <Select
                          value={envSettings?.defaultDecision || 'denied'}
                          onValueChange={(value) => updateEnvironmentPermission(env.id, 'defaultDecision', value as PermissionDecision)}
                          disabled={effectiveReadOnly || !envSettings?.enabled}
                        >
                          <SelectTrigger id={`${env.id}-decision`} aria-label={`Select default decision for ${env.name}`}>
                            <SelectValue>
                              <div className="flex items-center gap-2">
                                <DecisionIcon className={cn('h-4 w-4', decisionConfig.color)} />
                                <span>{decisionConfig.label}</span>
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {PERMISSION_DECISIONS.map((decision) => {
                              const Icon = decision.icon
                              return (
                                <SelectItem key={decision.value} value={decision.value}>
                                  <div className="flex items-center gap-2">
                                    <Icon className={cn('h-4 w-4', decision.color)} />
                                    <div className="flex flex-col">
                                      <span>{decision.label}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {decision.description}
                                      </span>
                                    </div>
                                  </div>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>

                        {/* Show warning for unsafe production settings */}
                        {env.id === 'production' && envSettings?.defaultDecision === 'allowed' && (
                          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                            <div className="text-sm text-red-800">
                              <strong>Warning:</strong> Allowing all operations in production is dangerous
                            </div>
                          </div>
                        )}

                        {/* Show recommendation for development */}
                        {env.id === 'development' && envSettings?.defaultDecision !== 'allowed' && (
                          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <Eye className="h-4 w-4 text-blue-600 mt-0.5" />
                            <div className="text-sm text-blue-800">
                              <strong>Tip:</strong> Development typically allows all operations for faster iteration
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-red-900">
              <AlertCircle className="h-4 w-4" />
              Validation Errors
            </div>
            <ul className="list-inside list-disc space-y-1 text-sm text-red-800">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between border-t bg-muted/50 px-6 py-4">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={effectiveReadOnly || isSaving}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>

        <div className="flex gap-2">
          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Saved successfully
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <XCircle className="h-4 w-4" />
              Save failed
            </div>
          )}

          {onSave && (
            <Button
              onClick={handleSave}
              disabled={effectiveReadOnly || isSaving || validationErrors.length > 0}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
