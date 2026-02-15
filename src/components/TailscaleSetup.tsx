/**
 * TailscaleSetup Component
 *
 * Step-by-step wizard for setting up Tailscale zero-trust networking
 * with validation, verification, and configuration guidance.
 *
 * Features:
 * - Multi-step wizard flow
 * - Installation check
 * - Connection verification
 * - Zero-trust configuration
 * - Progress tracking
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/TailscaleSetup
 */

'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  Shield,
  ArrowRight,
  ArrowLeft,
  Check,
  Download,
  Network,
  Lock,
  Loader,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useTailscale, useZeroTrustVerification } from '@/hooks/useTailscale'

// ============================================================================
// Type Definitions
// ============================================================================

export interface TailscaleSetupProps {
  /** Callback when setup is completed */
  onComplete?: () => void
  /** Callback when setup is cancelled */
  onCancel?: () => void
  /** Custom className */
  className?: string
}

interface SetupState {
  installationChecked: boolean
  connectionVerified: boolean
  zeroTrustVerified: boolean
  configuredPort?: number
}

// ============================================================================
// Constants
// ============================================================================

const STEPS = [
  { id: 'installation', title: 'Installation', icon: Download },
  { id: 'connection', title: 'Connection', icon: Network },
  { id: 'verification', title: 'Verification', icon: Lock }
]

// ============================================================================
// Step Components
// ============================================================================

interface InstallationStepProps {
  installed: boolean
  isChecking: boolean
  onCheck: () => void
}

function InstallationStep({ installed, isChecking, onCheck }: InstallationStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Tailscale Installation</h3>
        <p className="text-sm text-muted-foreground">
          Verify that Tailscale is installed on your system
        </p>
      </div>

      <div className="space-y-4">
        {/* Status Card */}
        <div className={cn(
          "p-4 border-2 rounded-lg",
          installed ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-muted"
        )}>
          <div className="flex items-start gap-3">
            {isChecking ? (
              <Loader className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : installed ? (
              <CheckCircle className="h-6 w-6 text-green-500" aria-hidden="true" />
            ) : (
              <XCircle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="flex-1">
              <div className="font-medium mb-1">
                {isChecking ? 'Checking installation...' : installed ? 'Tailscale is installed' : 'Tailscale not detected'}
              </div>
              <div className="text-sm text-muted-foreground">
                {installed
                  ? 'Your system has Tailscale installed and ready to use.'
                  : 'Please install Tailscale before continuing.'
                }
              </div>
            </div>
          </div>
        </div>

        {/* Installation Instructions */}
        {!installed && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="text-sm font-medium">Installation Instructions</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>macOS:</strong></p>
              <code className="block bg-background p-2 rounded border">
                brew install tailscale
              </code>
              <p className="mt-3"><strong>Linux (Debian/Ubuntu):</strong></p>
              <code className="block bg-background p-2 rounded border">
                curl -fsSL https://tailscale.com/install.sh | sh
              </code>
              <p className="mt-3"><strong>Windows:</strong></p>
              <p>Download from <a href="https://tailscale.com/download" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">tailscale.com/download</a></p>
            </div>
          </div>
        )}

        {/* Check Button */}
        <div className="pt-2">
          <Button
            onClick={onCheck}
            disabled={isChecking}
            variant="outline"
            className="w-full"
          >
            {isChecking ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Checking...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                Check Installation
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface ConnectionStepProps {
  status: any
  ip: string | null
  isLoading: boolean
  connected: boolean
  onRefresh: () => void
}

function ConnectionStep({ status, ip, isLoading, connected, onRefresh }: ConnectionStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Connection Status</h3>
        <p className="text-sm text-muted-foreground">
          Verify your Tailscale connection is active
        </p>
      </div>

      <div className="space-y-4">
        {/* Connection Status Card */}
        <div className={cn(
          "p-4 border-2 rounded-lg",
          connected ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-muted"
        )}>
          <div className="flex items-start gap-3">
            {isLoading ? (
              <Loader className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : connected ? (
              <CheckCircle className="h-6 w-6 text-green-500" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-6 w-6 text-yellow-500" aria-hidden="true" />
            )}
            <div className="flex-1">
              <div className="font-medium mb-1">
                {connected ? 'Connected to Tailscale' : 'Not connected'}
              </div>
              <div className="text-sm text-muted-foreground">
                {connected
                  ? 'Your device is connected to your Tailscale network.'
                  : 'Please start Tailscale and connect to your network.'
                }
              </div>
            </div>
          </div>
        </div>

        {/* Connection Details */}
        {connected && status && (
          <div className="p-4 border rounded-lg space-y-2">
            <h4 className="text-sm font-medium">Connection Details</h4>
            <div className="space-y-1 text-sm">
              {ip && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IP Address:</span>
                  <span className="font-mono">{ip}</span>
                </div>
              )}
              {status.hostname && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hostname:</span>
                  <span className="font-mono">{status.hostname}</span>
                </div>
              )}
              {status.user && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User:</span>
                  <span>{status.user}</span>
                </div>
              )}
              {status.version && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="text-xs">{status.version}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connection Instructions */}
        {!connected && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="text-sm font-medium">Connection Instructions</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1. Start the Tailscale service on your system</p>
              <p>2. Log in with your Tailscale account</p>
              <p>3. Connect to your network</p>
              <p className="mt-3">Run this command to check status:</p>
              <code className="block bg-background p-2 rounded border">
                tailscale status
              </code>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <div className="pt-2">
          <Button
            onClick={onRefresh}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Checking...
              </>
            ) : (
              <>
                <Network className="h-4 w-4 mr-2" aria-hidden="true" />
                Refresh Status
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface VerificationStepProps {
  onVerify: () => void
  isVerifying: boolean
  verificationResults: string[] | null
  verificationError: string | null
}

function VerificationStep({
  onVerify,
  isVerifying,
  verificationResults,
  verificationError
}: VerificationStepProps) {
  const hasResults = verificationResults && verificationResults.length > 0
  const allPassed = hasResults && verificationResults.every(r => !r.toLowerCase().includes('fail') && !r.toLowerCase().includes('error'))

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Zero-Trust Verification</h3>
        <p className="text-sm text-muted-foreground">
          Verify your zero-trust security configuration
        </p>
      </div>

      <div className="space-y-4">
        {/* Verification Status */}
        {hasResults && (
          <div className={cn(
            "p-4 border-2 rounded-lg",
            allPassed ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
          )}>
            <div className="flex items-start gap-3">
              {allPassed ? (
                <CheckCircle className="h-6 w-6 text-green-500" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-6 w-6 text-yellow-500" aria-hidden="true" />
              )}
              <div className="flex-1">
                <div className="font-medium mb-1">
                  {allPassed ? 'All checks passed' : 'Review verification results'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {allPassed
                    ? 'Your zero-trust configuration is secure.'
                    : 'Some checks need attention.'
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {verificationError && (
          <div className="p-3 bg-destructive/10 rounded text-sm text-destructive">
            {verificationError}
          </div>
        )}

        {/* Verification Results */}
        {hasResults && (
          <div className="p-4 border rounded-lg space-y-2">
            <h4 className="text-sm font-medium">Verification Results</h4>
            <div className="space-y-1">
              {verificationResults.map((result, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">{result}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verification Info */}
        {!hasResults && !verificationError && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="text-sm font-medium">What We Check</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Services are bound to Tailscale IP only</p>
              <p>• No public exposure on 0.0.0.0 or public IPs</p>
              <p>• Tailscale authentication is active</p>
              <p>• Network configuration follows zero-trust principles</p>
            </div>
          </div>
        )}

        {/* Verify Button */}
        <div className="pt-2">
          <Button
            onClick={onVerify}
            disabled={isVerifying}
            variant="outline"
            className="w-full"
          >
            {isVerifying ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Verifying...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" aria-hidden="true" />
                Run Verification
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function TailscaleSetup({
  onComplete,
  onCancel,
  className
}: TailscaleSetupProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [setupState, setSetupState] = useState<SetupState>({
    installationChecked: false,
    connectionVerified: false,
    zeroTrustVerified: false
  })

  const {
    status,
    installed,
    ip,
    isLoading,
    connected,
    checkInstallation,
    refreshStatus,
    refreshIp
  } = useTailscale({ autoRefresh: false })

  const {
    verificationResults,
    isVerifying,
    error: verificationError,
    verify
  } = useZeroTrustVerification()

  // Handle installation check
  const handleInstallationCheck = useCallback(async () => {
    await checkInstallation()
    setSetupState(prev => ({ ...prev, installationChecked: true }))
  }, [checkInstallation])

  // Handle connection refresh
  const handleConnectionRefresh = useCallback(async () => {
    await refreshStatus()
    await refreshIp()
    if (connected) {
      setSetupState(prev => ({ ...prev, connectionVerified: true }))
    }
  }, [refreshStatus, refreshIp, connected])

  // Handle verification
  const handleVerification = useCallback(async () => {
    await verify()
    if (verificationResults && verificationResults.length > 0) {
      setSetupState(prev => ({ ...prev, zeroTrustVerified: true }))
    }
  }, [verify, verificationResults])

  // Navigation handlers
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

  const handleComplete = useCallback(() => {
    onComplete?.()
  }, [onComplete])

  // Check if user can proceed to next step
  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return installed && setupState.installationChecked
      case 1:
        return connected && setupState.connectionVerified
      case 2:
        return setupState.zeroTrustVerified
      default:
        return false
    }
  }

  // Initial check on mount
  useEffect(() => {
    handleInstallationCheck()
  }, [])

  const progress = ((currentStep + 1) / STEPS.length) * 100

  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" aria-hidden="true" />
            Tailscale Setup
          </CardTitle>
          <Badge variant="outline">
            Step {currentStep + 1} of {STEPS.length}
          </Badge>
        </div>
        <CardDescription>
          Configure zero-trust networking for secure remote access
        </CardDescription>
        <Progress value={progress} className="h-2 mt-4" aria-label={`Progress: ${progress}%`} />
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
            <InstallationStep
              installed={installed}
              isChecking={isLoading}
              onCheck={handleInstallationCheck}
            />
          )}
          {currentStep === 1 && (
            <ConnectionStep
              status={status}
              ip={ip}
              isLoading={isLoading}
              connected={connected}
              onRefresh={handleConnectionRefresh}
            />
          )}
          {currentStep === 2 && (
            <VerificationStep
              onVerify={handleVerification}
              isVerifying={isVerifying}
              verificationResults={verificationResults}
              verificationError={verificationError}
            />
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-6">
        <div>
          {currentStep > 0 && (
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={!canProceed()}>
              <Check className="h-4 w-4 mr-2" aria-hidden="true" />
              Complete Setup
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
