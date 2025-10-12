/**
 * Template-based project generator component
 * Combines template selection and configuration for scaffolding projects
 */

'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectTemplate } from '@/lib/templates'
import { GenerateFromTemplateOptions, generateFromTemplate } from '@/lib/templates/generator'
import { TemplateSelector } from './TemplateSelector'
import { TemplateConfigurator } from './TemplateConfigurator'
import { 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  RocketLaunchIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

interface TemplateBasedProjectGeneratorProps {
  onComplete?: (data: { workspaceId: string; projectName: string }) => void
import { logger } from '@/lib/logger';
  className?: string
}

type Step = 'select' | 'configure' | 'generating' | 'complete' | 'error'

interface GenerationResult {
  workspaceId: string
  projectName: string
  error?: string
}

export function TemplateBasedProjectGenerator({ 
  onComplete,
  className 
}: TemplateBasedProjectGeneratorProps) {
  const [currentStep, setCurrentStep] = useState<Step>('select')
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | undefined>()
  const [configuration, setConfiguration] = useState<GenerateFromTemplateOptions | undefined>()
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStatus, setGenerationStatus] = useState('')
  const [generationResult, setGenerationResult] = useState<GenerationResult | undefined>()
  const router = useRouter()

  const handleTemplateSelect = useCallback((template: ProjectTemplate) => {
    setSelectedTemplate(template)
  }, [])

  const handleConfigurationChange = useCallback((options: GenerateFromTemplateOptions) => {
    setConfiguration(options)
  }, [])

  const handleNext = useCallback(() => {
    if (currentStep === 'select' && selectedTemplate) {
      setCurrentStep('configure')
    } else if (currentStep === 'configure' && configuration) {
      startGeneration()
    }
  }, [currentStep, selectedTemplate, configuration])

  const handleBack = useCallback(() => {
    if (currentStep === 'configure') {
      setCurrentStep('select')
    } else if (currentStep === 'error') {
      setCurrentStep('configure')
    }
  }, [currentStep])

  const startGeneration = useCallback(async () => {
    if (!configuration || !selectedTemplate) return

    setCurrentStep('generating')
    setGenerationProgress(0)
    setGenerationStatus('Initializing project generation...')

    try {
      // Simulate progress updates
      const progressSteps = [
        { progress: 20, status: 'Generating project structure...' },
        { progress: 40, status: 'Creating files and directories...' },
        { progress: 60, status: 'Setting up dependencies...' },
        { progress: 80, status: 'Configuring environment...' },
        { progress: 100, status: 'Finalizing project setup...' }
      ]

      for (const step of progressSteps) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        setGenerationProgress(step.progress)
        setGenerationStatus(step.status)
      }

      // Generate the actual project
      const generatedProject = await generateFromTemplate(configuration)
      
      // Create workspace (mock implementation)
      const workspaceId = `template-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      
      // In a real implementation, this would:
      // 1. Create a new workspace
      // 2. Seed files from the generated project
      // 3. Initialize development environment
      // 4. Set up dependencies
      
      const result: GenerationResult = {
        workspaceId,
        projectName: generatedProject.name
      }

      setGenerationResult(result)
      setCurrentStep('complete')
      
      // Notify parent component
      onComplete?.(result)

    } catch (error) {
      logger.error('Template generation error:', error)
      setGenerationResult({
        workspaceId: '',
        projectName: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
      setCurrentStep('error')
    }
  }, [configuration, selectedTemplate, onComplete])

  const handleOpenWorkspace = useCallback(() => {
    if (generationResult?.workspaceId) {
      router.push(`/workspace/${generationResult.workspaceId}`)
    }
  }, [generationResult, router])

  const handleStartOver = useCallback(() => {
    setCurrentStep('select')
    setSelectedTemplate(undefined)
    setConfiguration(undefined)
    setGenerationProgress(0)
    setGenerationStatus('')
    setGenerationResult(undefined)
  }, [])

  const canProceed = () => {
    switch (currentStep) {
      case 'select':
        return !!selectedTemplate
      case 'configure':
        return !!configuration && !!configuration.projectName.trim()
      default:
        return false
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 'select':
        return 'Choose Template'
      case 'configure':
        return 'Configure Project'
      case 'generating':
        return 'Generating Project'
      case 'complete':
        return 'Project Ready'
      case 'error':
        return 'Generation Failed'
      default:
        return ''
    }
  }

  return (
    <div className={className}>
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Step 1: Select */}
            <div className={`flex items-center ${
              ['select'].includes(currentStep) ? 'text-blue-600' : 
              ['configure', 'generating', 'complete'].includes(currentStep) ? 'text-green-600' : 
              'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                ['select'].includes(currentStep) ? 'border-blue-600 bg-blue-50' : 
                ['configure', 'generating', 'complete'].includes(currentStep) ? 'border-green-600 bg-green-50' : 
                'border-gray-300 bg-gray-50'
              }`}>
                {['configure', 'generating', 'complete'].includes(currentStep) ? (
                  <CheckCircleIcon className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">1</span>
                )}
              </div>
              <span className="ml-2 text-sm font-medium">Select Template</span>
            </div>

            <div className="h-px w-12 bg-gray-300" />

            {/* Step 2: Configure */}
            <div className={`flex items-center ${
              ['configure'].includes(currentStep) ? 'text-blue-600' : 
              ['generating', 'complete'].includes(currentStep) ? 'text-green-600' : 
              'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                ['configure'].includes(currentStep) ? 'border-blue-600 bg-blue-50' : 
                ['generating', 'complete'].includes(currentStep) ? 'border-green-600 bg-green-50' : 
                'border-gray-300 bg-gray-50'
              }`}>
                {['generating', 'complete'].includes(currentStep) ? (
                  <CheckCircleIcon className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">2</span>
                )}
              </div>
              <span className="ml-2 text-sm font-medium">Configure</span>
            </div>

            <div className="h-px w-12 bg-gray-300" />

            {/* Step 3: Generate */}
            <div className={`flex items-center ${
              ['generating'].includes(currentStep) ? 'text-blue-600' : 
              ['complete'].includes(currentStep) ? 'text-green-600' : 
              'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                ['generating'].includes(currentStep) ? 'border-blue-600 bg-blue-50' : 
                ['complete'].includes(currentStep) ? 'border-green-600 bg-green-50' : 
                'border-gray-300 bg-gray-50'
              }`}>
                {['complete'].includes(currentStep) ? (
                  <CheckCircleIcon className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">3</span>
                )}
              </div>
              <span className="ml-2 text-sm font-medium">Generate</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{getStepTitle()}</h1>
      </div>

      {/* Step Content */}
      <div className="min-h-[500px]">
        {currentStep === 'select' && (
          <TemplateSelector
            onSelectTemplate={handleTemplateSelect}
            selectedTemplate={selectedTemplate}
          />
        )}

        {currentStep === 'configure' && selectedTemplate && (
          <TemplateConfigurator
            template={selectedTemplate}
            onConfigurationChange={handleConfigurationChange}
          />
        )}

        {currentStep === 'generating' && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                <div 
                  className="absolute inset-0 border-4 border-blue-600 rounded-full transition-all duration-300"
                  style={{
                    clipPath: `polygon(0 0, ${generationProgress}% 0, ${generationProgress}% 100%, 0% 100%)`,
                  }}
                ></div>
                <RocketLaunchIcon className="absolute inset-2 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generating Your Project
              </h3>
              <p className="text-gray-600 mb-4">{generationStatus}</p>
              <div className="w-64 mx-auto">
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>{generationProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${generationProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'complete' && generationResult && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircleIcon className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Project Generated Successfully!
            </h3>
            <p className="text-gray-600 mb-6">
              Your project &quot;{generationResult.projectName}&quot; is ready to use
            </p>
            <div className="space-y-3">
              <button
                onClick={handleOpenWorkspace}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto"
                data-testid="open-workspace-button"
              >
                <RocketLaunchIcon className="h-5 w-5" />
                Open Workspace
              </button>
              <button
                onClick={handleStartOver}
                className="text-gray-600 hover:text-gray-800 px-6 py-3 rounded-lg font-medium"
                data-testid="create-another-button"
              >
                Create Another Project
              </button>
            </div>
          </div>
        )}

        {currentStep === 'error' && generationResult?.error && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <ExclamationTriangleIcon className="h-10 w-10 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Generation Failed
            </h3>
            <p className="text-gray-600 mb-4">
              {generationResult.error}
            </p>
            <div className="space-x-3">
              <button
                onClick={handleBack}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                data-testid="try-again-button"
              >
                Try Again
              </button>
              <button
                onClick={handleStartOver}
                className="text-gray-600 hover:text-gray-800 px-6 py-3 rounded-lg font-medium"
                data-testid="start-over-button"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      {!['generating', 'complete', 'error'].includes(currentStep) && (
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            onClick={handleBack}
            disabled={currentStep === 'select'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              currentStep === 'select'
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
            data-testid="back-button"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium ${
              canProceed()
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            data-testid="next-button"
          >
            {currentStep === 'configure' ? (
              <>
                <RocketLaunchIcon className="h-4 w-4" />
                Generate Project
              </>
            ) : (
              <>
                Next
                <ArrowRightIcon className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}