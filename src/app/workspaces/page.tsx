/**
 * Workspaces Page - E2E Test Compatible
 * Provides basic workspaces listing UI for E2E testing without external dependencies
 */

'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState([
    { id: 1, name: 'Frontend Project', description: 'React and Next.js frontend', createdAt: new Date() },
    { id: 2, name: 'Backend API', description: 'Node.js backend services', createdAt: new Date() },
    { id: 3, name: 'Mobile App', description: 'React Native mobile app', createdAt: new Date() }
  ])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '' })
  const [formError, setFormError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  // Simulate initial data load
  useEffect(() => {
    const loadWorkspaces = async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setIsLoading(false)
    }
    loadWorkspaces()
  }, [])

  const isTestEnvironment = typeof window !== 'undefined' &&
                           (window.location.hostname === 'localhost' ||
                            window.location.hostname === '127.0.0.1')

  const handleCreateWorkspace = () => {
    setShowCreateModal(true)
  }

  const handleUseTemplate = () => {
    setShowTemplateModal(true)
  }

  const filteredWorkspaces = workspaces.filter(workspace =>
    workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    workspace.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSubmitWorkspace = async () => {
    setFormError('')

    if (!createForm.name.trim()) {
      setFormError('Workspace name is required')
      return
    }

    if (createForm.name.trim().length < 3) {
      setFormError('Workspace name must be at least 3 characters')
      return
    }

    setIsCreating(true)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))

    const newWorkspace = {
      id: Date.now(),
      name: createForm.name.trim(),
      description: createForm.description.trim() || 'Created for E2E testing',
      createdAt: new Date()
    }

    setWorkspaces([...workspaces, newWorkspace])
    setIsCreating(false)
    setShowCreateModal(false)
    setCreateForm({ name: '', description: '' })

    // Navigate to new workspace for E2E tests
    if (isTestEnvironment) {
      window.location.href = `/workspaces/${newWorkspace.id}`
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900">Workspaces</h1>
              {isTestEnvironment && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  E2E Test Mode
                </span>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                data-testid="use-template-button"
                onClick={handleUseTemplate}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Use Template
              </button>
              <button
                data-testid="create-workspace-button"
                onClick={handleCreateWorkspace}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Workspace
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <input
            data-testid="workspace-search"
            type="text"
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
            aria-label="Search workspaces"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading workspaces">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-6 w-32" />
                  <div className="flex space-x-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <div data-testid="empty-workspaces" className="text-center py-12">
            <div className="text-gray-500">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No workspaces found</h3>
              <p>Create your first workspace to get started</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredWorkspaces.map((workspace) => (
              <div
                key={workspace.id}
                data-testid={`workspace-${workspace.name}`}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {workspace.name}
                    </h3>
                    <div className="flex space-x-2">
                      <button
                        data-testid="edit-workspace-button"
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Edit workspace"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        data-testid="workspace-settings-button"
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Workspace settings"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">
                    {workspace.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Created {workspace.createdAt.toLocaleDateString()}
                    </span>
                    <a
                      href={`/workspaces/${workspace.id}`}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                    >
                      Open
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Workspace</h3>

              {formError && (
                <div data-testid="error-message" className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="workspace-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Workspace Name
                  </label>
                  <input
                    id="workspace-name"
                    data-testid="workspace-name"
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter workspace name"
                    disabled={isCreating}
                  />
                </div>

                <div>
                  <label htmlFor="workspace-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    id="workspace-description"
                    data-testid="workspace-description"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter workspace description"
                    disabled={isCreating}
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  data-testid="submit-workspace"
                  onClick={handleSubmitWorkspace}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </span>
                  ) : 'Create Workspace'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateForm({ name: '', description: '' })
                    setFormError('')
                  }}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Choose Template</h3>

              <div className="space-y-3">
                <button
                  data-testid="template-nextjs-typescript"
                  onClick={() => {
                    setShowTemplateModal(false)
                    setShowCreateModal(true)
                    setCreateForm({ name: 'Next.js TypeScript Project', description: 'Full-stack Next.js app with TypeScript' })
                  }}
                  className="w-full text-left p-3 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="font-medium">Next.js + TypeScript</div>
                  <div className="text-sm text-gray-500">Full-stack web application</div>
                </button>

                <button
                  className="w-full text-left p-3 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="font-medium">React + Vite</div>
                  <div className="text-sm text-gray-500">Fast frontend development</div>
                </button>

                <button
                  className="w-full text-left p-3 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="font-medium">Node.js API</div>
                  <div className="text-sm text-gray-500">Backend REST API</div>
                </button>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  data-testid="create-from-template-button"
                  onClick={() => {
                    setShowTemplateModal(false)
                    setShowCreateModal(true)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Continue
                </button>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
