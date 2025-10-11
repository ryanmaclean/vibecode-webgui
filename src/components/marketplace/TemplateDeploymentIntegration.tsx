/**
 * Template deployment integration component
 * Connects marketplace templates with GitHub and cloud deployment
 */

'use client'

import React, { useState } from 'react'
import { GitHubDeploymentWorkflow } from '@/components/deployment/GitHubDeploymentWorkflow'
import { type MarketplaceTemplate } from '@/lib/marketplace/template-marketplace'
import { type GeneratedProject } from '@/lib/templates/generator'
import { type DeploymentResult } from '@/lib/deployment/cloud-automation'
import {
  RocketLaunchIcon,
  CodeBracketIcon,
  CloudIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowRightIcon,
  StarIcon,
  ArrowDownTrayIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'

interface TemplateDeploymentIntegrationProps {
  template: MarketplaceTemplate
  onClose: () => void
  onDeploymentComplete?: (result: DeploymentResult & { repositoryUrl: string }) => void
}

export function TemplateDeploymentIntegration({ 
  template, 
  onClose, 
  onDeploymentComplete 
}: TemplateDeploymentIntegrationProps) {
  const [currentStep, setCurrentStep] = useState<'overview' | 'deploy' | 'completed'>('overview')
  const [deploymentResult, setDeploymentResult] = useState<(DeploymentResult & { repositoryUrl: string }) | null>(null)

  // Convert marketplace template to generated project format
  const convertToGeneratedProject = (template: MarketplaceTemplate): GeneratedProject => {
    return {
      id: template.marketplaceId,
      name: template.name,
      description: template.description,
      category: template.category,
      complexity: template.complexity,
      tags: template.tags,
      language: template.language || [],
      frameworks: template.frameworks || [],
      files: template.files || [],
      dependencies: template.dependencies || {},
      devDependencies: {},
      scripts: template.scripts || {},
      envVars: (template.envVars || []).map(env => ({
        name: env.name,
        value: env.defaultValue || '',
        description: env.description
      })),
      setupInstructions: [
        'npm install',
        'npm run dev'
      ],
      documentation: {
        readme: `# ${template.name}

${template.description}`,
        setup: Array.isArray(template.documentation?.setup) ? template.documentation.setup.join('\n') : 'Setup instructions',
        deployment: Array.isArray(template.documentation?.deployment) ? template.documentation.deployment.join('\n') : 'Deployment guide'
      },
      createdAt: new Date(),
      estimatedTime: 15,
      features: [
        'Production-ready configuration',
        'Modern development setup',
        'Best practices included'
      ]
    }
  }

  const generatedProject = convertToGeneratedProject(template)

  const handleStartDeployment = () => {
    setCurrentStep('deploy')
  }

  const handleDeploymentComplete = (result: DeploymentResult & { repositoryUrl: string }) => {
    setDeploymentResult(result)
    setCurrentStep('completed')
    onDeploymentComplete?.(result)
  }

  const renderStars = (rating: number, size = 4) => {
    const stars: React.ReactNode[] = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <StarIconSolid key={i} className={`h-${size} w-${size} text-yellow-400`} />
        )
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative">
            <StarIcon className={`h-${size} w-${size} text-gray-300`} />
            <StarIconSolid className={`h-${size} w-${size} text-yellow-400 absolute top-0 left-0`} style={{ clipPath: 'inset(0 50% 0 0)' }} />
          </div>
        )
      } else {
        stars.push(
          <StarIcon key={i} className={`h-${size} w-${size} text-gray-300`} />
        )
      }
    }

    return stars
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <RocketLaunchIcon className="h-16 w-16 mx-auto mb-4 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Deploy Template</h1>
        <p className="text-gray-600">
          Deploy <strong>{template.name}</strong> directly to FolderHub and your favorite cloud provider
        </p>
      </div>

      {/* Template Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xl font-semibold text-gray-900">{template.name}</h2>
              {template.marketplace.featured && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                  Featured
                </span>
              )}
              {template.author.verified && (
                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <p className="text-gray-600 mb-4">{template.description}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mb-4 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            {renderStars(template.stats.rating)}
            <span className="ml-1 font-medium">{template.stats.rating.toFixed(1)}</span>
            <span>({template.stats.reviewCount})</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>{formatNumber(template.stats.downloads)} downloads</span>
          </div>
          <div className="flex items-center gap-1">
            <UserIcon className="h-4 w-4" />
            <span>{template.author.name}</span>
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-4">
          {template.marketplace.category.map((category) => (
            <span
              key={category}
              className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
            >
              {category}
            </span>
          ))}
        </div>

        {/* Complexity & Pricing */}
        <div className="flex items-center justify-between text-sm">
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full capitalize">
            {template.complexity} level
          </span>
          <span className="font-medium text-green-600">
            {template.marketplace.pricing === 'free' ? 'Free' : `$${template.marketplace.price}`}
          </span>
        </div>
      </div>

      {/* Deployment Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center p-6 border border-gray-200 rounded-lg">
          <CodeBracketIcon className="h-12 w-12 mx-auto mb-4 text-blue-600" />
          <h3 className="font-semibold text-gray-900 mb-2">FolderHub Repository</h3>
          <p className="text-sm text-gray-600">
            Automatically create a new FolderHub repository with all template files and CI/CD workflows
          </p>
        </div>

        <div className="text-center p-6 border border-gray-200 rounded-lg">
          <CloudIcon className="h-12 w-12 mx-auto mb-4 text-green-600" />
          <h3 className="font-semibold text-gray-900 mb-2">Cloud Deployment</h3>
          <p className="text-sm text-gray-600">
            Deploy to Vercel, Netlify, AWS, or Railway with optimized configurations for your template
          </p>
        </div>

        <div className="text-center p-6 border border-gray-200 rounded-lg">
          <RocketLaunchIcon className="h-12 w-12 mx-auto mb-4 text-purple-600" />
          <h3 className="font-semibold text-gray-900 mb-2">Ready to Use</h3>
          <p className="text-sm text-gray-600">
            Get a production-ready application with proper CI/CD, monitoring, and best practices
          </p>
        </div>
      </div>

      {/* Template Features */}
      {template.tags && template.tags.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">What&apos;s Included</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {template.tags.map((tag, index) => (
              <div key={index} className="flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-700">{tag}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template Compatibility */}
      {template.compatibility && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Compatibility</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Next.js:</span>
              <div className="mt-1">
                {template.compatibility.nextjsVersion.map((version, index) => (
                  <span key={index} className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs mr-1 mb-1">
                    {version}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Node.js:</span>
              <div className="mt-1">
                {template.compatibility.nodeVersion.map((version, index) => (
                  <span key={index} className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs mr-1 mb-1">
                    {version}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Platforms:</span>
              <div className="mt-1">
                {template.compatibility.platforms.map((platform, index) => (
                  <span key={index} className="inline-block px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs mr-1 mb-1 capitalize">
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleStartDeployment}
          className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <RocketLaunchIcon className="h-5 w-5" />
          Deploy to FolderHub & Cloud
          <ArrowRightIcon className="h-4 w-4" />
        </button>
        <button
          onClick={onClose}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )

  const renderCompleted = () => (
    <div className="space-y-8 text-center">
      <div>
        <CheckCircleIcon className="h-24 w-24 mx-auto mb-6 text-green-500" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Template Deployed Successfully!</h1>
        <p className="text-gray-600">
          <strong>{template.name}</strong> has been deployed and is ready to use
        </p>
      </div>

      {deploymentResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-left">
          <h3 className="font-semibold text-gray-900 mb-4">Deployment Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Repository</h4>
              <a
                href={deploymentResult.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
              >
                View on FolderHub
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Live Site</h4>
              <a
                href={deploymentResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
              >
                Visit Application
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 justify-center">
        {deploymentResult && (
          <>
            <button
              onClick={() => window.open(deploymentResult.url, '_blank')}
              className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <RocketLaunchIcon className="h-4 w-4" />
              View Live Site
            </button>
            <button
              onClick={() => window.open(deploymentResult.repositoryUrl, '_blank')}
              className="border border-gray-300 text-gray-700 py-2 px-6 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <CodeBracketIcon className="h-4 w-4" />
              View Repository
            </button>
          </>
        )}
        <button
          onClick={onClose}
          className="border border-gray-300 text-gray-700 py-2 px-6 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {currentStep === 'overview' && 'Deploy Template'}
            {currentStep === 'deploy' && 'Setting Up Deployment'}
            {currentStep === 'completed' && 'Deployment Complete'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {currentStep === 'overview' && renderOverview()}
          {currentStep === 'deploy' && (
            <GitHubDeploymentWorkflow
              project={generatedProject}
              onDeploymentComplete={handleDeploymentComplete}
              onClose={() => setCurrentStep('overview')}
            />
          )}
          {currentStep === 'completed' && renderCompleted()}
        </div>
      </div>
    </div>
  )
}
