/**
 * Template submission form for marketplace
 */

'use client'

import React, { useState } from 'react'
import { templateMarketplace, type TemplateSubmission } from '@/lib/marketplace/template-marketplace'
import { type ProjectTemplate } from '@/lib/templates/index'
import {
  DocumentPlusIcon,
  CodeBracketIcon,
  TagIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface TemplateSubmissionFormProps {
  onSubmissionComplete: (submissionId: string) => void
  onCancel: () => void
}

export function TemplateSubmissionForm({ onSubmissionComplete, onCancel }: TemplateSubmissionFormProps) {
  const [template, setTemplate] = useState<Partial<ProjectTemplate>>({
    name: '',
    description: '',
<<<<<<< HEAD
<<<<<<< HEAD
    category: 'frontend',
=======
    category: 'frontend',
<<<<<<< HEAD
    category: 'fullstack',
    category: 'frontend',
    category: 'fullstack',
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
    complexity: 'beginner',
=======
    category: 'frontend',    complexity: 'beginner',
>>>>>>> fix/consolidated-dependency-updates
    tags: [],
    files: [],
    dependencies: {},
    scripts: {},
    envVars: [],
    documentation: {
      setup: [],
      usage: [],
      deployment: []
    }
  })

  const [author, setAuthor] = useState({
    name: '',
    email: '',
    githubUrl: ''
  })

  const [marketplace, setMarketplace] = useState({
    category: [] as string[],
    pricing: 'free' as 'free' | 'paid',
    price: 0,
    license: 'MIT',
    supportUrl: '',
    demoUrl: ''
  })

  const [submission, setSubmission] = useState({
    notes: '',
    requestedFeature: false
  })

  const [newTag, setNewTag] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState(false)

  const categories = [
    'AI/ML', 'SaaS', 'Enterprise', 'Dashboard', 'Analytics',
    'E-commerce', 'Blog', 'Portfolio', 'Landing Page', 'Mobile',
    'Desktop', 'API', 'Microservices', 'DevOps', 'Education',
    'Healthcare', 'Finance', 'Gaming', 'Social', 'Productivity'
  ]

  const licenses = ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC', 'UNLICENSED']

  const handleAddTag = () => {
    if (newTag.trim() && !template.tags?.includes(newTag.trim())) {
      setTemplate(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTemplate(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }))
  }

  const handleAddCategory = () => {
    if (newCategory && !marketplace.category.includes(newCategory)) {
      setMarketplace(prev => ({
        ...prev,
        category: [...prev.category, newCategory]
      }))
      setNewCategory('')
    }
  }

  const handleRemoveCategory = (categoryToRemove: string) => {
    setMarketplace(prev => ({
      ...prev,
      category: prev.category.filter(cat => cat !== categoryToRemove)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrors([])

    try {
      const submissionData: TemplateSubmission = {
        template: {
          id: `template-${Date.now()}`,
          name: template.name || '',
          description: template.description || '',
          category: template.category || 'frontend',
<<<<<<< HEAD
          complexity: template.complexity || 'beginner',
          tags: template.tags || [],
<<<<<<< HEAD
=======
          language: ['typescript'],
          frameworks: ['react', 'nextjs'],
          features: ['modern-setup', 'production-ready'],
          estimatedSetupTime: '15 minutes',
>>>>>>> fix/consolidated-dependency-updates
=======
<<<<<<< HEAD
          category: template.category || 'fullstack',
          category: template.category || 'frontend',
          category: template.category || 'fullstack',
=======
>>>>>>> main
          complexity: template.complexity || 'beginner',
          tags: template.tags || [],
>>>>>>> merge-conflict-cleanup
          files: template.files || [],
          dependencies: template.dependencies || {},
          scripts: template.scripts || {},
          envVars: template.envVars || [],
<<<<<<< HEAD
=======
<<<<<<< HEAD
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
          documentation: {
            setup: Array.isArray(template.documentation?.setup) ? template.documentation.setup : ['Setup instructions'],
            usage: Array.isArray(template.documentation?.usage) ? template.documentation.usage : ['Usage instructions'],
            deployment: Array.isArray(template.documentation?.deployment) ? template.documentation.deployment : ['Deployment guide']
          },
<<<<<<< HEAD
          language: ['typescript'],
          frameworks: ['react', 'nextjs'],
          features: ['modern-setup', 'production-ready'],
          estimatedSetupTime: '15 minutes',
<<<<<<< HEAD
=======
<<<<<<< HEAD
<<<<<<< Updated upstream
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
          dockerSupport: false,
          kubernetesSupport: false,
          cicdTemplate: false,
          testingSetup: false,
<<<<<<< HEAD
          monitoringSetup: false
=======
<<<<<<< HEAD
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
          monitoringSetup: false,
          documentation: template.documentation || {
            setup: [],
            usage: [],
            deployment: []
          }
<<<<<<< Updated upstream
          monitoringSetup: false
          monitoringSetup: false
=======
          monitoringSetup: false
>>>>>>> main
>>>>>>> merge-conflict-cleanup
        },
=======
          dockerSupport: false,
          kubernetesSupport: false,
          cicdTemplate: false,
          testingSetup: false,        },
>>>>>>> fix/consolidated-dependency-updates
        author,
        marketplace,
        submission
      }

      const result = await templateMarketplace.submitTemplate(submissionData)

      if (result.success && result.submissionId) {
        setSuccess(true)
        setTimeout(() => {
          onSubmissionComplete(result.submissionId!)
        }, 2000)
      } else {
        setErrors([result.error || 'Submission failed'])
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Submission failed'])
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Submission Successful!</h2>
        <p className="text-gray-600 mb-4">
          Your template has been submitted for review. You&apos;ll be notified when it&apos;s approved.
        </p>
        <div className="animate-pulse text-sm text-gray-500">
          Redirecting...
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DocumentPlusIcon className="h-8 w-8 text-blue-600" />
            Submit Template
          </h2>
          <p className="text-gray-600 mt-2">
            Share your template with the community and help other developers get started faster.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Errors */}
          {errors.length > 0 && (
            <div
              id="template-submission-errors"
              className="bg-red-50 border border-red-200 rounded-md p-4"
              role="alert"
              aria-live="polite"
            >
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Please fix the following errors:
                  </h3>
                  <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Template Information */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CodeBracketIcon className="h-5 w-5" />
              Template Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={template.name}
                  onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., React TypeScript Starter"
                  required
                  aria-invalid={errors.length > 0 ? "true" : "false"}
                  aria-describedby={errors.length > 0 ? "template-submission-errors" : undefined}
                />
              </div>

              <div>
                <label htmlFor="complexity" className="block text-sm font-medium text-gray-700 mb-2">
                  Complexity
                </label>
                <select
                  id="complexity"
                  value={template.complexity}
                  onChange={(e) => setTemplate(prev => ({ ...prev, complexity: e.target.value as 'beginner' | 'intermediate' | 'advanced' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={template.description}
                onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe what your template does and what problems it solves..."
                required
                aria-invalid={errors.length > 0 ? "true" : "false"}
                aria-describedby={errors.length > 0 ? "template-submission-errors" : undefined}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {template.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1"
                  >
                    <TagIcon className="h-3 w-3" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Author Information */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Author Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={author.name}
                  onChange={(e) => setAuthor(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  aria-invalid={errors.length > 0 ? "true" : "false"}
                  aria-describedby={errors.length > 0 ? "template-submission-errors" : undefined}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={author.email}
                  onChange={(e) => setAuthor(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  aria-invalid={errors.length > 0 ? "true" : "false"}
                  aria-describedby={errors.length > 0 ? "template-submission-errors" : undefined}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                FolderHub Profile (optional)
              </label>
              <input
                type="url"
                value={author.githubUrl}
                onChange={(e) => setAuthor(prev => ({ ...prev, githubUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://github.com/yourusername"
              />
            </div>
          </div>

          {/* Marketplace Settings */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Marketplace Settings</h3>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categories *
              </label>
              <div className="flex gap-2 mb-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a category...</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!newCategory}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {marketplace.category.map((category) => (
                  <span
                    key={category}
                    className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-1"
                  >
                    {category}
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(category)}
                      className="ml-1 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pricing
                </label>
                <select
                  value={marketplace.pricing}
                  onChange={(e) => setMarketplace(prev => ({ ...prev, pricing: e.target.value as 'free' | 'paid' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              {marketplace.pricing === 'paid' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (USD)
                  </label>
                  <div className="relative">
                    <CurrencyDollarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={marketplace.price}
                      onChange={(e) => setMarketplace(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  License
                </label>
                <select
                  value={marketplace.license}
                  onChange={(e) => setMarketplace(prev => ({ ...prev, license: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {licenses.map((license) => (
                    <option key={license} value={license}>{license}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Support URL (optional)
                </label>
                <input
                  type="url"
                  value={marketplace.supportUrl}
                  onChange={(e) => setMarketplace(prev => ({ ...prev, supportUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Demo URL (optional)
                </label>
                <input
                  type="url"
                  value={marketplace.demoUrl}
                  onChange={(e) => setMarketplace(prev => ({ ...prev, demoUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Submission Notes */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes for Reviewers (optional)
              </label>
              <textarea
                value={submission.notes}
                onChange={(e) => setSubmission(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any additional information for the review team..."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="requestedFeature"
                checked={submission.requestedFeature}
                onChange={(e) => setSubmission(prev => ({ ...prev, requestedFeature: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="requestedFeature" className="ml-2 text-sm text-gray-700">
                This template was created based on a community feature request
              </label>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}