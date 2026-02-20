'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type SetupStep = 'welcome' | 'docker' | 'api-keys' | 'kubernetes' | 'database' | 'complete'

type SetupData = {
  dockerInstalled: boolean
  nodeInstalled: boolean
  kubectlInstalled: boolean
  apiKeys: {
    openai: string
    anthropic: string
  }
  kubernetesConnected: boolean
  databaseInitialized: boolean
}

const steps: SetupStep[] = ['welcome', 'docker', 'api-keys', 'kubernetes', 'database', 'complete']

const stepLabels: Record<Exclude<SetupStep, 'complete'>, string> = {
  welcome: 'Welcome',
  docker: 'Docker',
  'api-keys': 'API Keys',
  kubernetes: 'Kubernetes',
  database: 'Database',
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<SetupStep>('welcome')
  const [data, setData] = useState<SetupData>({
    dockerInstalled: false,
    nodeInstalled: false,
    kubectlInstalled: false,
    apiKeys: {
      openai: '',
      anthropic: '',
    },
    kubernetesConnected: false,
    databaseInitialized: false,
  })
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateData = (updates: Partial<SetupData>) => {
    setError(null)
    setData((prev) => ({
      ...prev,
      ...updates,
    }))
  }

  const updateApiKey = (provider: 'openai' | 'anthropic', value: string) => {
    setError(null)
    setData((prev) => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [provider]: value,
      },
    }))
  }

  const checkDockerStatus = async () => {
    setIsChecking(true)
    setError(null)
    try {
      const response = await fetch('/api/setup/check-docker')
      const result = await response.json()
      updateData({
        dockerInstalled: result.dockerInstalled,
        nodeInstalled: result.nodeInstalled,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check Docker status'
      setError(message)
    } finally {
      setIsChecking(false)
    }
  }

  const checkKubernetesStatus = async () => {
    setIsChecking(true)
    setError(null)
    try {
      const response = await fetch('/api/setup/check-kubernetes')
      const result = await response.json()
      updateData({
        kubectlInstalled: result.kubectlInstalled,
        kubernetesConnected: result.connected,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check Kubernetes status'
      setError(message)
    } finally {
      setIsChecking(false)
    }
  }

  const initializeDatabase = async () => {
    setIsChecking(true)
    setError(null)
    try {
      const response = await fetch('/api/setup/init-database', {
        method: 'POST',
      })
      const result = await response.json()
      updateData({
        databaseInitialized: result.success,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize database'
      setError(message)
    } finally {
      setIsChecking(false)
    }
  }

  const saveApiKeys = async () => {
    setIsChecking(true)
    setError(null)
    try {
      const response = await fetch('/api/setup/save-api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openai: data.apiKeys.openai,
          anthropic: data.apiKeys.anthropic,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to save API keys')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save API keys'
      setError(message)
    } finally {
      setIsChecking(false)
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

  const completeSetup = async () => {
    router.push('/dashboard')
  }

  const progressPercent = (steps.indexOf(step) / (steps.length - 1)) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full p-8 space-y-8">
        <div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 mb-3 text-center">
            {(steps.filter((s) => s !== 'complete') as Exclude<SetupStep, 'complete'>[]).map((s) => (
              <span
                key={s}
                className={`text-xs ${
                  steps.indexOf(s) <= steps.indexOf(step)
                    ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'text-gray-400'
                }`}
              >
                {stepLabels[s]}
              </span>
            ))}
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Welcome to VibeCode Setup 🚀</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Let&apos;s configure your development environment in under 5 minutes.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              We&apos;ll verify Docker, set up AI API keys, connect Kubernetes, and initialize the database.
            </p>
            <button
              onClick={nextStep}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              Get Started
            </button>
          </div>
        )}

        {step === 'docker' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Docker & Node.js</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Verify that Docker 20.10+ and Node.js 18+ are installed on your system.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Docker</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Required: Docker 20.10+</div>
                </div>
                <div className="flex items-center gap-2">
                  {data.dockerInstalled ? (
                    <span className="text-green-600 dark:text-green-400">✓ Installed</span>
                  ) : (
                    <span className="text-gray-400">Not checked</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Node.js</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Required: Node.js 18+</div>
                </div>
                <div className="flex items-center gap-2">
                  {data.nodeInstalled ? (
                    <span className="text-green-600 dark:text-green-400">✓ Installed</span>
                  ) : (
                    <span className="text-gray-400">Not checked</span>
                  )}
                </div>
              </div>
              <button
                onClick={checkDockerStatus}
                disabled={isChecking}
                className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {isChecking ? 'Checking...' : 'Check Status'}
              </button>
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className="px-6 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900">
                Back
              </button>
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'api-keys' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI API Keys</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Configure API keys for AI providers. You can skip this and add them later.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  OpenAI API Key (Optional)
                </label>
                <input
                  type="password"
                  value={data.apiKeys.openai}
                  onChange={(e) => updateApiKey('openai', e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-indigo-600 focus:outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Get your API key from platform.openai.com
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Anthropic API Key (Optional)
                </label>
                <input
                  type="password"
                  value={data.apiKeys.anthropic}
                  onChange={(e) => updateApiKey('anthropic', e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-indigo-600 focus:outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Get your API key from console.anthropic.com
                </p>
              </div>
              {(data.apiKeys.openai || data.apiKeys.anthropic) && (
                <button
                  onClick={saveApiKeys}
                  disabled={isChecking}
                  className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {isChecking ? 'Saving...' : 'Save API Keys'}
                </button>
              )}
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className="px-6 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900">
                Back
              </button>
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'kubernetes' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Kubernetes Connection</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Verify kubectl installation and connect to your Kubernetes cluster (KIND).
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">kubectl CLI</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Required for cluster management</div>
                </div>
                <div className="flex items-center gap-2">
                  {data.kubectlInstalled ? (
                    <span className="text-green-600 dark:text-green-400">✓ Installed</span>
                  ) : (
                    <span className="text-gray-400">Not checked</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Cluster Connection</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">KIND cluster connectivity</div>
                </div>
                <div className="flex items-center gap-2">
                  {data.kubernetesConnected ? (
                    <span className="text-green-600 dark:text-green-400">✓ Connected</span>
                  ) : (
                    <span className="text-gray-400">Not checked</span>
                  )}
                </div>
              </div>
              <button
                onClick={checkKubernetesStatus}
                disabled={isChecking}
                className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {isChecking ? 'Checking...' : 'Check Status'}
              </button>
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className="px-6 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900">
                Back
              </button>
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'database' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Database Initialization</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Initialize the database schema and seed initial data.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Database Status</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Schema and initial data</div>
                </div>
                <div className="flex items-center gap-2">
                  {data.databaseInitialized ? (
                    <span className="text-green-600 dark:text-green-400">✓ Initialized</span>
                  ) : (
                    <span className="text-gray-400">Not initialized</span>
                  )}
                </div>
              </div>
              <button
                onClick={initializeDatabase}
                disabled={isChecking || data.databaseInitialized}
                className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {isChecking ? 'Initializing...' : data.databaseInitialized ? 'Already Initialized' : 'Initialize Database'}
              </button>
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className="px-6 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900">
                Back
              </button>
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Setup Complete 🎉</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Your development environment is ready. You can now start building!
              </p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-6 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Docker:</span>
                <span className={data.dockerInstalled ? 'text-green-600' : 'text-gray-500'}>
                  {data.dockerInstalled ? '✓ Ready' : 'Not verified'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Node.js:</span>
                <span className={data.nodeInstalled ? 'text-green-600' : 'text-gray-500'}>
                  {data.nodeInstalled ? '✓ Ready' : 'Not verified'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">API Keys:</span>
                <span className={data.apiKeys.openai || data.apiKeys.anthropic ? 'text-green-600' : 'text-gray-500'}>
                  {data.apiKeys.openai || data.apiKeys.anthropic ? '✓ Configured' : 'Skip for now'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Kubernetes:</span>
                <span className={data.kubernetesConnected ? 'text-green-600' : 'text-gray-500'}>
                  {data.kubernetesConnected ? '✓ Connected' : 'Not verified'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Database:</span>
                <span className={data.databaseInitialized ? 'text-green-600' : 'text-gray-500'}>
                  {data.databaseInitialized ? '✓ Initialized' : 'Not initialized'}
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className="px-6 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900">
                Back
              </button>
              <button
                onClick={completeSetup}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
