/**
 * GitHub deployment workflow component with cloud integration
 */

'use client'

import React, { useState, useEffect } from 'react'
import { GitHubIntegration, generateGitHubActionsWorkflow } from '@/lib/github/integration'
import { 
  CloudDeploymentOrchestrator, 
  CloudProvider, 
  DEPLOYMENT_PRESETS,
  type DeploymentConfig,
  type DeploymentResult
} from '@/lib/deployment/cloud-automation'
import type { GeneratedProject } from '@/lib/templates/generator'
import {
  CodeBracketIcon,
  CloudIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CogIcon,
  EyeIcon,
  ArrowTopRightOnSquareIcon,
  DocumentDuplicateIcon,
  PlayIcon
} from '@heroicons/react/24/outline'

interface GitHubDeploymentWorkflowProps {
  project: GeneratedProject
  onDeploymentComplete?: (result: DeploymentResult & { repositoryUrl: string }) => void
  onClose?: () => void
}

interface GitHubCredentials {
  accessToken: string
  username: string
}

interface RepositoryInfo {
  name: string
  description: string
  private: boolean
  license: string
}

interface DeploymentStep {
  id: string
  name: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  message?: string
  url?: string
  duration?: number
}

export function GitHubDeploymentWorkflow({ 
  project, 
  onDeploymentComplete, 
  onClose 
}: GitHubDeploymentWorkflowProps) {
  const [step, setStep] = useState<'credentials' | 'repository' | 'deployment' | 'workflow' | 'complete'>('credentials')
  const [credentials, setCredentials] = useState<GitHubCredentials>({ accessToken: '', username: '' })
  const [repositoryInfo, setRepositoryInfo] = useState<RepositoryInfo>({
    name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    description: project.description,
    private: false,
    license: 'MIT'
  })
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider>(CloudProvider.VERCEL)
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig>({
    provider: CloudProvider.VERCEL,
    projectName: repositoryInfo.name,
    environment: 'production'
  })
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [githubIntegration, setGithubIntegration] = useState<GitHubIntegration | null>(null)
  const [repositoryUrl, setRepositoryUrl] = useState<string>('')
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null)
  const [recommendations, setRecommendations] = useState<Array<{
    provider: CloudProvider
    reasoning: string
    estimatedCost: number
  }>>([])

  // Initialize deployment recommendations
  useEffect(() => {
    const orchestrator = new CloudDeploymentOrchestrator()
    const recs = orchestrator.recommendProvider(project)
    setRecommendations(recs)
    
    if (recs.length > 0) {
      setSelectedProvider(recs[0].provider)
      setDeploymentConfig(prev => ({ ...prev, provider: recs[0].provider }))
    }
  }, [project])

  // Update deployment config when repository name changes
  useEffect(() => {
    setDeploymentConfig(prev => ({ ...prev, projectName: repositoryInfo.name }))
  }, [repositoryInfo.name])

  const handleCredentialsSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const github = new GitHubIntegration(credentials.accessToken)
      const userInfo = await github.initialize()
      
      setGithubIntegration(github)
      setCredentials(prev => ({ ...prev, username: userInfo.login }))
      setStep('repository')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authenticate with GitHub')
    } finally {
      setLoading(false)
    }
  }

  const handleRepositorySetup = async () => {
    if (!githubIntegration) return

    setLoading(true)
    setError(null)

    try {
      // Check if repository name is available
      const isAvailable = await githubIntegration.isRepositoryNameAvailable(repositoryInfo.name)
      if (!isAvailable) {
        setError(`Repository name "${repositoryInfo.name}" is already taken. Please choose a different name.`)
        setLoading(false)
        return
      }

      setStep('deployment')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check repository availability')
    } finally {
      setLoading(false)
    }
  }

  const handleDeployment = async () => {
    if (!githubIntegration) return

    setLoading(true)
    setError(null)

    const steps: DeploymentStep[] = [
      { id: 'repo', name: 'Creating GitHub Repository', status: 'pending' },
      { id: 'files', name: 'Uploading Project Files', status: 'pending' },
      { id: 'workflow', name: 'Setting up CI/CD Workflow', status: 'pending' },
      { id: 'deploy', name: 'Deploying to Cloud Provider', status: 'pending' }
    ]

    setDeploymentSteps(steps)
    setStep('workflow')

    try {
      // Step 1: Create repository
      updateStepStatus('repo', 'in-progress', 'Creating repository...')
      const startTime = Date.now()
      
      const repoResult = await githubIntegration.createRepositoryFromProject(project, {
        private: repositoryInfo.private,
        description: repositoryInfo.description,
        licenseTemplate: repositoryInfo.license
      })

      setRepositoryUrl(repoResult.repository.htmlUrl)
      updateStepStatus('repo', 'completed', 'Repository created', repoResult.repository.htmlUrl, Date.now() - startTime)

      // Step 2: Upload files (already done in createRepositoryFromProject)
      updateStepStatus('files', 'completed', 'Files uploaded successfully')

      // Step 3: Add GitHub Actions workflow
      updateStepStatus('workflow', 'in-progress', 'Setting up CI/CD...')
      const workflowContent = generateGitHubActionsWorkflow(
        project.category,
        detectProjectLanguage(project),
        detectFramework(project)
      )

      // Add cloud provider-specific deployment steps to workflow
      const enhancedWorkflow = enhanceWorkflowWithDeployment(workflowContent, selectedProvider, deploymentConfig)
      
      await githubIntegration.addGitHubActionsWorkflow(
        repositoryInfo.name,
        'deploy',
        enhancedWorkflow
      )

      updateStepStatus('workflow', 'completed', 'CI/CD workflow configured')

      // Step 4: Simulate cloud deployment
      updateStepStatus('deploy', 'in-progress', 'Deploying to cloud...')
      
      // Mock deployment result
      const deployResult: DeploymentResult = {
        success: true,
        deploymentId: `deploy_${Date.now()}`,
        url: `https://${repositoryInfo.name}.${getProviderDomain(selectedProvider)}`,
        deploymentTime: 45000,
        estimatedCost: recommendations.find(r => r.provider === selectedProvider)?.estimatedCost || 0,
        buildLogs: [
          'Installing dependencies...',
          'Running build command...',
          'Optimizing assets...',
          'Deploying to CDN...',
          'Deployment successful!'
        ]
      }

      setDeploymentResult(deployResult)
      updateStepStatus('deploy', 'completed', 'Deployment successful!', deployResult.url)

      // Complete the workflow
      setTimeout(() => {
        setStep('complete')
        onDeploymentComplete?.({
          ...deployResult,
          repositoryUrl: repoResult.repository.htmlUrl
        })
      }, 1000)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Deployment failed'
      setError(errorMessage)
      
      // Mark current step as failed
      const currentStep = deploymentSteps.find(s => s.status === 'in-progress')
      if (currentStep) {
        updateStepStatus(currentStep.id, 'failed', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const updateStepStatus = (
    id: string, 
    status: DeploymentStep['status'], 
    message?: string, 
    url?: string, 
    duration?: number
  ) => {
    setDeploymentSteps(prev => prev.map(step => 
      step.id === id 
        ? { ...step, status, message, url, duration }
        : step
    ))
  }

  const detectProjectLanguage = (project: GeneratedProject): string => {
    if (project.files.some(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx'))) return 'typescript'
    if (project.files.some(f => f.path.endsWith('.js') || f.path.endsWith('.jsx'))) return 'javascript'
    if (project.files.some(f => f.path.endsWith('.py'))) return 'python'
    if (project.files.some(f => f.path.endsWith('.java'))) return 'java'
    return 'javascript'
  }

  const detectFramework = (project: GeneratedProject): string => {
    if (project.files.some(f => f.content?.includes('next'))) return 'nextjs'
    if (project.files.some(f => f.content?.includes('react'))) return 'react'
    if (project.files.some(f => f.content?.includes('vue'))) return 'vue'
    if (project.files.some(f => f.content?.includes('angular'))) return 'angular'
    return 'static'
  }

  const enhanceWorkflowWithDeployment = (
    workflow: string, 
    provider: CloudProvider, 
    config: DeploymentConfig
  ): string => {
    const deploymentSteps = getProviderDeploymentSteps(provider, config)
    
    return workflow.replace(
      'run: echo "Add your deployment steps here"',
      deploymentSteps
    )
  }

  const getProviderDeploymentSteps = (provider: CloudProvider, config: DeploymentConfig): string => {
    switch (provider) {
      case CloudProvider.VERCEL:
        return `# Deploy to Vercel
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: \${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: \${{ secrets.ORG_ID }}
        vercel-project-id: \${{ secrets.PROJECT_ID }}
        vercel-args: '--prod'`

      case CloudProvider.NETLIFY:
        return `# Deploy to Netlify
    - name: Deploy to Netlify
      uses: nwtgck/actions-netlify@v3.0
      with:
        publish-dir: './dist'
        production-branch: main
        github-token: \${{ secrets.GITHUB_TOKEN }}
        deploy-message: "Deploy from GitHub Actions"
      env:
        NETLIFY_AUTH_TOKEN: \${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: \${{ secrets.NETLIFY_SITE_ID }}`

      case CloudProvider.AWS:
        return `# Deploy to AWS
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Deploy to S3
      run: aws s3 sync ./dist s3://\${{ secrets.S3_BUCKET }} --delete`

      default:
        return 'run: echo "Deployment configuration needed"'
    }
  }

  const getProviderDomain = (provider: CloudProvider): string => {
    switch (provider) {
      case CloudProvider.VERCEL: return 'vercel.app'
      case CloudProvider.NETLIFY: return 'netlify.app'
      case CloudProvider.AWS: return 'amazonaws.com'
      case CloudProvider.RAILWAY: return 'railway.app'
      default: return 'example.com'
    }
  }

  const getProviderColor = (provider: CloudProvider): string => {
    switch (provider) {
      case CloudProvider.VERCEL: return 'from-black to-gray-800'
      case CloudProvider.NETLIFY: return 'from-teal-500 to-cyan-600'
      case CloudProvider.AWS: return 'from-orange-500 to-yellow-600'
      case CloudProvider.RAILWAY: return 'from-purple-500 to-purple-700'
      default: return 'from-blue-500 to-blue-700'
    }
  }

  const renderCredentialsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CodeBracketIcon className="h-16 w-16 mx-auto mb-4 text-gray-900" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect to GitHub</h2>
        <p className="text-gray-600">
          Enter your GitHub personal access token to create and manage repositories
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <EyeIcon className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">How to get a GitHub token:</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to GitHub Settings → Developer settings → Personal access tokens</li>
                <li>Click &quot;Generate new token (classic)&quot;</li>
                <li>Select scopes: repo, workflow, write:packages</li>
                <li>Copy the token and paste it below</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            GitHub Personal Access Token
          </label>
          <input
            type="password"
            value={credentials.accessToken}
            onChange={(e) => setCredentials(prev => ({ ...prev, accessToken: e.target.value }))}
            placeholder="ghp_..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleCredentialsSubmit}
          disabled={!credentials.accessToken || loading}
          className="w-full bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Connecting...' : 'Connect to GitHub'}
        </button>
      </div>
    </div>
  )

  const renderRepositoryStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CodeBracketIcon className="h-16 w-16 mx-auto mb-4 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Repository Settings</h2>
        <p className="text-gray-600">
          Configure your GitHub repository for <strong>{project.name}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Repository Name
          </label>
          <input
            type="text"
            value={repositoryInfo.name}
            onChange={(e) => setRepositoryInfo(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            License
          </label>
          <select
            value={repositoryInfo.license}
            onChange={(e) => setRepositoryInfo(prev => ({ ...prev, license: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="MIT">MIT</option>
            <option value="Apache-2.0">Apache 2.0</option>
            <option value="GPL-3.0">GPL 3.0</option>
            <option value="BSD-3-Clause">BSD 3-Clause</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={repositoryInfo.description}
          onChange={(e) => setRepositoryInfo(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="private"
          checked={repositoryInfo.private}
          onChange={(e) => setRepositoryInfo(prev => ({ ...prev, private: e.target.checked }))}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="private" className="ml-2 text-sm text-gray-700">
          Make repository private
        </label>
      </div>

      <button
        onClick={handleRepositorySetup}
        disabled={!repositoryInfo.name || loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Checking availability...' : 'Continue'}
      </button>
    </div>
  )

  const renderDeploymentStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CloudIcon className="h-16 w-16 mx-auto mb-4 text-green-600" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Cloud Provider</h2>
        <p className="text-gray-600">
          Select where you want to deploy your application
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendations.map((rec) => (
          <div
            key={rec.provider}
            onClick={() => {
              setSelectedProvider(rec.provider)
              setDeploymentConfig(prev => ({ ...prev, provider: rec.provider }))
            }}
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedProvider === rec.provider
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold capitalize">{rec.provider}</h3>
              <span className="text-sm text-gray-600">
                ${rec.estimatedCost}/month
              </span>
            </div>
            <p className="text-sm text-gray-600">{rec.reasoning}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2">Deployment Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Environment
            </label>
            <select
              value={deploymentConfig.environment}
              onChange={(e) => setDeploymentConfig(prev => ({ 
                ...prev, 
                environment: e.target.value as 'development' | 'staging' | 'production'
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Auto Scale
            </label>
            <select
              value={deploymentConfig.autoScale ? 'true' : 'false'}
              onChange={(e) => setDeploymentConfig(prev => ({ 
                ...prev, 
                autoScale: e.target.value === 'true'
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={handleDeployment}
        className="w-full bg-green-700 text-white py-2 px-4 rounded-md hover:bg-green-800 transition-colors"
      >
        Start Deployment
      </button>
    </div>
  )

  const renderWorkflowStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <RocketLaunchIcon className="h-16 w-16 mx-auto mb-4 text-purple-600" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Deployment In Progress</h2>
        <p className="text-gray-600">
          Setting up your repository and deploying to {selectedProvider}
        </p>
      </div>

      <div className="space-y-4">
        {deploymentSteps.map((step, index) => (
          <div key={step.id} className="flex items-center space-x-4 p-4 border rounded-lg">
            <div className="flex-shrink-0">
              {step.status === 'completed' && (
                <CheckCircleIcon className="h-6 w-6 text-green-500" />
              )}
              {step.status === 'in-progress' && (
                <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
              {step.status === 'failed' && (
                <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
              )}
              {step.status === 'pending' && (
                <ClockIcon className="h-6 w-6 text-gray-400" />
              )}
            </div>
            
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{step.name}</h3>
              {step.message && (
                <p className="text-sm text-gray-600">{step.message}</p>
              )}
              {step.duration && (
                <p className="text-xs text-gray-500">
                  Completed in {(step.duration / 1000).toFixed(1)}s
                </p>
              )}
            </div>

            {step.url && (
              <button
                onClick={() => window.open(step.url, '_blank')}
                className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ArrowTopRightOnSquareIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  const renderCompleteStep = () => (
    <div className="space-y-6 text-center">
      <div>
        <CheckCircleIcon className="h-24 w-24 mx-auto mb-4 text-green-500" />
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Deployment Successful!</h2>
        <p className="text-gray-600">
          Your project has been deployed and is ready to use
        </p>
      </div>

      {deploymentResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Deployment Details</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <span className="text-gray-600">Provider:</span>{' '}
                  <span className="font-medium capitalize">{selectedProvider}</span>
                </li>
                <li>
                  <span className="text-gray-600">Environment:</span>{' '}
                  <span className="font-medium">{deploymentConfig.environment}</span>
                </li>
                <li>
                  <span className="text-gray-600">Deploy Time:</span>{' '}
                  <span className="font-medium">{(deploymentResult.deploymentTime / 1000).toFixed(1)}s</span>
                </li>
                <li>
                  <span className="text-gray-600">Estimated Cost:</span>{' '}
                  <span className="font-medium">${deploymentResult.estimatedCost}/month</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => window.open(deploymentResult.url, '_blank')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <PlayIcon className="h-4 w-4" />
                  View Live Site
                </button>
                <button
                  onClick={() => window.open(repositoryUrl, '_blank')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <CodeBracketIcon className="h-4 w-4" />
                  View Repository
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(deploymentResult.url)
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <DocumentDuplicateIcon className="h-4 w-4" />
                  Copy URL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
      >
        Close
      </button>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Progress Indicator */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            {['credentials', 'repository', 'deployment', 'workflow', 'complete'].map((stepName, index) => (
              <React.Fragment key={stepName}>
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === stepName
                      ? 'bg-blue-600 text-white'
                      : ['credentials', 'repository', 'deployment', 'workflow', 'complete'].indexOf(step) > index
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {['credentials', 'repository', 'deployment', 'workflow', 'complete'].indexOf(step) > index ? (
                      <CheckCircleIcon className="w-5 h-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className="ml-2 text-sm font-medium text-gray-900 capitalize">
                    {stepName === 'workflow' ? 'Deploy' : stepName}
                  </span>
                </div>
                {index < 4 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    ['credentials', 'repository', 'deployment', 'workflow', 'complete'].indexOf(step) > index
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {step === 'credentials' && renderCredentialsStep()}
          {step === 'repository' && renderRepositoryStep()}
          {step === 'deployment' && renderDeploymentStep()}
          {step === 'workflow' && renderWorkflowStep()}
          {step === 'complete' && renderCompleteStep()}
        </div>
      </div>
    </div>
  )
}