/**
 * React hook for cloud deployment functionality
 */

import { useState, useCallback } from 'react'
import {
  cloudDeploymentOrchestrator,
  CloudProvider,
  DeploymentConfig,
  DeploymentResult
} from '@/lib/deployment/cloud-automation'
import type { GeneratedProject } from '@/lib/templates/generator'

interface UseCloudDeploymentOptions {
  onDeploymentComplete?: (result: DeploymentResult) => void
  onError?: (error: string) => void
}

export function useCloudDeployment(options: UseCloudDeploymentOptions = {}) {
  const [deployments, setDeployments] = useState<Map<string, DeploymentResult>>(new Map())
  const [isDeploying, setIsDeploying] = useState(false)
  const [currentDeployment, setCurrentDeployment] = useState<DeploymentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { onDeploymentComplete, onError } = options

  const deployProject = useCallback(async (
    project: GeneratedProject,
    config: DeploymentConfig
  ): Promise<DeploymentResult | null> => {
    setIsDeploying(true)
    setError(null)
    setCurrentDeployment(null)

    try {
      const result = await cloudDeploymentOrchestrator.deployProject(project, config)
      
      setCurrentDeployment(result)
      setDeployments(prev => new Map(prev.set(result.deploymentId, result)))

      if (result.success) {
        onDeploymentComplete?.(result)
      } else {
        const errorMessage = result.error || 'Deployment failed'
        setError(errorMessage)
        onError?.(errorMessage)
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deployment failed'
      setError(errorMessage)
      onError?.(errorMessage)
      return null
    } finally {
      setIsDeploying(false)
    }
  }, [onDeploymentComplete, onError])

  const getDeploymentStatus = useCallback(async (
    provider: CloudProvider,
    deploymentId: string
  ) => {
    try {
      const status = await cloudDeploymentOrchestrator.getDeploymentStatus(provider, deploymentId)
      
      // Update local deployment record
      const deployment = deployments.get(deploymentId)
      if (deployment) {
        const updatedDeployment = {
          ...deployment,
          url: status.url || deployment.url
        }
        setDeployments(prev => new Map(prev.set(deploymentId, updatedDeployment)))
      }

      return status
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get deployment status'
      setError(errorMessage)
      return null
    }
  }, [deployments])

  const getProviderRecommendations = useCallback((project: GeneratedProject) => {
    try {
      return cloudDeploymentOrchestrator.recommendProvider(project)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get recommendations'
      setError(errorMessage)
      return []
    }
  }, [])

  const getDeploymentHistory = useCallback(() => {
    return Array.from(deployments.values()).sort((a, b) => 
      new Date(b.deploymentTime).getTime() - new Date(a.deploymentTime).getTime()
    )
  }, [deployments])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const clearCurrentDeployment = useCallback(() => {
    setCurrentDeployment(null)
  }, [])

  return {
    // State
    deployments: Array.from(deployments.values()),
    isDeploying,
    currentDeployment,
    error,

    // Actions
    deployProject,
    getDeploymentStatus,
    getProviderRecommendations,
    getDeploymentHistory,
    clearError,
    clearCurrentDeployment
  }
}

// Hook for deployment monitoring
export function useDeploymentMonitoring(deploymentId: string, provider: CloudProvider) {
  const [status, setStatus] = useState<{
    status: string
    url?: string
    error?: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const checkStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await cloudDeploymentOrchestrator.getDeploymentStatus(provider, deploymentId)
      setStatus(result)
    } catch (error) {
      setStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to check status'
      })
    } finally {
      setIsLoading(false)
    }
  }, [deploymentId, provider])

  return {
    status,
    isLoading,
    checkStatus
  }
}

// Hook for provider comparison
export function useProviderComparison() {
  const [comparisons, setComparisons] = useState<Array<{
    provider: CloudProvider
    pros: string[]
    cons: string[]
    bestFor: string[]
    pricing: string
  }> | null>(null)

  const getProviderComparison = useCallback(() => {
    const data = [
      {
        provider: CloudProvider.VERCEL,
        pros: [
          'Excellent Next.js support',
          'Global edge network',
          'Automatic HTTPS',
          'Preview deployments'
        ],
        cons: [
          'Limited backend capabilities',
          'Expensive for high traffic',
          'Vendor lock-in'
        ],
        bestFor: [
          'Next.js applications',
          'React SPAs',
          'Static sites',
          'JAMstack projects'
        ],
        pricing: 'Free tier available, $20/month pro'
      },
      {
        provider: CloudProvider.NETLIFY,
        pros: [
          'Great for static sites',
          'Built-in forms handling',
          'Split testing',
          'Identity management'
        ],
        cons: [
          'Limited serverless functions',
          'Build time limits',
          'Expensive at scale'
        ],
        bestFor: [
          'Static websites',
          'JAMstack applications',
          'Marketing sites',
          'Blogs'
        ],
        pricing: 'Free tier available, $19/month pro'
      },
      {
        provider: CloudProvider.AWS,
        pros: [
          'Comprehensive services',
          'Global infrastructure',
          'Fine-grained control',
          'Enterprise features'
        ],
        cons: [
          'Complex setup',
          'Steep learning curve',
          'Can be expensive'
        ],
        bestFor: [
          'Enterprise applications',
          'Complex architectures',
          'High-scale applications',
          'Custom requirements'
        ],
        pricing: 'Pay-as-you-go, varies widely'
      },
      {
        provider: CloudProvider.RAILWAY,
        pros: [
          'Simple deployment',
          'Database included',
          'Great developer experience',
          'Reasonable pricing'
        ],
        cons: [
          'Limited customization',
          'Fewer regions',
          'Newer platform'
        ],
        bestFor: [
          'Full-stack applications',
          'Rapid prototyping',
          'Small to medium projects',
          'Database-backed apps'
        ],
        pricing: '$5/month hobby, usage-based pro'
      }
    ]

    setComparisons(data)
    return data
  }, [])

  return {
    comparisons,
    getProviderComparison
  }
}