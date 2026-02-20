'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StepIndicator } from './StepIndicator'
import { DockerCheck } from './DockerCheck'
import { KubernetesCheck } from './KubernetesCheck'
import { DatabaseCheck } from './DatabaseCheck'
import { AIKeysCheck } from './AIKeysCheck'
import type {
  SetupStepId,
  DockerCheckResult,
  KubernetesCheckResult,
  DatabaseCheckResult,
  AIKeysCheckResult,
  SetupStatus,
} from '@/types/setup'
import {
  defaultSetupStatus,
  mergeWithDefaultSetupStatus,
  calculateOverallStatus,
} from '@/types/setup'

type SetupStep = 'welcome' | 'docker' | 'kubernetes' | 'database' | 'ai-keys' | 'complete'
type SetupStepWithoutComplete = Exclude<SetupStep, 'complete'>

const steps: SetupStep[] = [
  'welcome',
  'docker',
  'kubernetes',
  'database',
  'ai-keys',
  'complete',
]

const indicatorSteps: readonly SetupStepWithoutComplete[] = [
  'welcome',
  'docker',
  'kubernetes',
  'database',
  'ai-keys',
] as const

const stepLabels: Record<SetupStepWithoutComplete, string> = {
  welcome: 'Welcome',
  docker: 'Docker',
  kubernetes: 'Kubernetes',
  database: 'Database',
  'ai-keys': 'AI Keys',
}

export function SetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState<SetupStep>('welcome')
  const [setupStatus, setSetupStatus] = useState<SetupStatus>(defaultSetupStatus)
  const [error, setError] = useState<string | null>(null)

  const updateStatus = (updates: Partial<SetupStatus>) => {
    setError(null)
    setSetupStatus((prev) =>
      mergeWithDefaultSetupStatus({
        ...prev,
        ...updates,
      }),
    )
  }

  const handleDockerCheckComplete = (result: DockerCheckResult) => {
    updateStatus({
      docker: result,
    })

    // Add to completed steps if successful
    if (result.status === 'completed' || result.status === 'warning') {
      updateStatus({
        completedSteps: [...new Set([...setupStatus.completedSteps, 'docker' as SetupStepId])],
      })
    }
  }

  const handleKubernetesCheckComplete = (result: KubernetesCheckResult) => {
    updateStatus({
      kubernetes: result,
    })

    // Add to completed steps if successful
    if (result.status === 'completed' || result.status === 'warning') {
      updateStatus({
        completedSteps: [...new Set([...setupStatus.completedSteps, 'kubernetes' as SetupStepId])],
      })
    }
  }

  const handleDatabaseCheckComplete = (result: DatabaseCheckResult) => {
    updateStatus({
      database: result,
    })

    // Add to completed steps if successful
    if (result.status === 'completed' || result.status === 'warning') {
      updateStatus({
        completedSteps: [...new Set([...setupStatus.completedSteps, 'database' as SetupStepId])],
      })
    }
  }

  const handleAIKeysCheckComplete = (result: AIKeysCheckResult) => {
    updateStatus({
      aiKeys: result,
    })

    // Add to completed steps if successful
    if (result.status === 'completed' || result.status === 'warning') {
      updateStatus({
        completedSteps: [...new Set([...setupStatus.completedSteps, 'ai-keys' as SetupStepId])],
      })
    }
  }

  const nextStep = () => {
    const currentIndex = steps.indexOf(step)
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1])
    }
  }

  const prevStep = () => {
    const currentIndex = steps.indexOf(step)
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1])
    }
  }

  const completeSetup = () => {
    router.push('/dashboard')
  }

  const canProceed = () => {
    switch (step) {
      case 'welcome':
        return true
      case 'docker':
        return setupStatus.docker.status === 'completed' || setupStatus.docker.status === 'warning'
      case 'kubernetes':
        return setupStatus.kubernetes.status === 'completed' || setupStatus.kubernetes.status === 'warning'
      case 'database':
        return setupStatus.database.status === 'completed' || setupStatus.database.status === 'warning'
      case 'ai-keys':
        return setupStatus.aiKeys.status === 'completed' || setupStatus.aiKeys.status === 'warning'
      case 'complete':
        return true
      default:
        return false
    }
  }

  const renderStepContent = () => {
    switch (step) {
      case 'welcome':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Welcome to Harness Setup</CardTitle>
              <CardDescription>
                Let&apos;s get your development environment configured and ready to go
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-foreground">
                  This wizard will guide you through setting up the following components:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>
                    <strong className="text-foreground">Docker</strong> - Container runtime for development environments
                  </li>
                  <li>
                    <strong className="text-foreground">Kubernetes</strong> - Cluster orchestration for development
                  </li>
                  <li>
                    <strong className="text-foreground">Database</strong> - PostgreSQL initialization and migrations
                  </li>
                  <li>
                    <strong className="text-foreground">AI Keys</strong> - API keys for AI-powered features
                  </li>
                </ul>
                <p className="text-sm text-muted-foreground">
                  Each step will verify your configuration and provide guidance if anything needs attention.
                </p>
              </div>
            </CardContent>
          </Card>
        )

      case 'docker':
        return <DockerCheck onCheckComplete={handleDockerCheckComplete} autoCheck />

      case 'kubernetes':
        return <KubernetesCheck onCheckComplete={handleKubernetesCheckComplete} autoCheck />

      case 'database':
        return <DatabaseCheck onCheckComplete={handleDatabaseCheckComplete} autoCheck />

      case 'ai-keys':
        return <AIKeysCheck onCheckComplete={handleAIKeysCheckComplete} autoCheck />

      case 'complete':
        const overallStatus = calculateOverallStatus(setupStatus)
        const allChecksCompleted = setupStatus.completedSteps.length === 4
        const hasErrors = overallStatus === 'error'
        const hasWarnings = overallStatus === 'warning'

        return (
          <Card>
            <CardHeader>
              <CardTitle>
                {allChecksCompleted ? '✓ Setup Complete!' : 'Setup Status'}
              </CardTitle>
              <CardDescription>
                {allChecksCompleted
                  ? 'Your development environment is ready to use'
                  : 'Review the status of your setup'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted">
                    <span className="text-sm font-medium">Docker</span>
                    <span className="text-xs text-muted-foreground">
                      {setupStatus.docker.status === 'completed' ? '✓ Ready' :
                       setupStatus.docker.status === 'warning' ? '⚠ Warning' :
                       setupStatus.docker.status === 'error' ? '✗ Error' : 'Not checked'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted">
                    <span className="text-sm font-medium">Kubernetes</span>
                    <span className="text-xs text-muted-foreground">
                      {setupStatus.kubernetes.status === 'completed' ? '✓ Ready' :
                       setupStatus.kubernetes.status === 'warning' ? '⚠ Warning' :
                       setupStatus.kubernetes.status === 'error' ? '✗ Error' : 'Not checked'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted">
                    <span className="text-sm font-medium">Database</span>
                    <span className="text-xs text-muted-foreground">
                      {setupStatus.database.status === 'completed' ? '✓ Ready' :
                       setupStatus.database.status === 'warning' ? '⚠ Warning' :
                       setupStatus.database.status === 'error' ? '✗ Error' : 'Not checked'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted">
                    <span className="text-sm font-medium">AI Keys</span>
                    <span className="text-xs text-muted-foreground">
                      {setupStatus.aiKeys.status === 'completed' ? '✓ Ready' :
                       setupStatus.aiKeys.status === 'warning' ? '⚠ Warning' :
                       setupStatus.aiKeys.status === 'error' ? '✗ Error' : 'Not checked'}
                    </span>
                  </div>
                </div>

                {hasErrors && (
                  <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Some checks failed. Please review and fix the errors before proceeding.
                    </p>
                  </div>
                )}

                {hasWarnings && !hasErrors && (
                  <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-3">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Some checks have warnings. You can proceed, but consider addressing them for optimal performance.
                    </p>
                  </div>
                )}

                {allChecksCompleted && !hasErrors && (
                  <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-3">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      All checks passed! Your development environment is ready.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  const currentIndex = steps.indexOf(step)
  const isFirstStep = currentIndex === 0
  const isLastStep = currentIndex === steps.length - 1

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Environment Setup</h1>
          <p className="text-muted-foreground">
            Configure your development environment in just a few steps
          </p>
        </div>

        {step !== 'complete' && (
          <StepIndicator
            steps={indicatorSteps}
            currentStep={step as SetupStepWithoutComplete}
            stepLabels={stepLabels}
            className="mb-8"
          />
        )}

        <div className="mb-6">{renderStepContent()}</div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 p-4 mb-6">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={isFirstStep}
          >
            ← Back
          </Button>

          {isLastStep ? (
            <Button
              onClick={completeSetup}
              disabled={!canProceed()}
            >
              Go to Dashboard →
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
            >
              {step === 'welcome' ? 'Start Setup' : 'Continue'} →
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
