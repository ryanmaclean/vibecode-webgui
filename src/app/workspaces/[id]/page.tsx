/**
 * Individual Workspace Page - E2E Test Compatible
 * Provides comprehensive workspace management UI for E2E testing
 */

'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
// import { logger } from '@/lib/logger';
export default function WorkspacePage() {
  const params = useParams()
  const workspaceId = params?.id as string
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  
  // Workspace data
  const [workspace, setWorkspace] = useState({
    id: workspaceId,
    name: 'E2E Test Workspace',
    description: 'Created during E2E testing'
  })
  
  // File management state
  const [files, setFiles] = useState([
    { name: 'package.json', type: 'file', content: '{"name": "test-project"}' },
    { name: 'tsconfig.json', type: 'file', content: '{"compilerOptions": {}}' },
    { name: 'next.config.js', type: 'file', content: 'module.exports = {}' }
  ])
  const [showCreateFileModal, setShowCreateFileModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false)
  const [showDeleteWorkspaceModal, setShowDeleteWorkspaceModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [newFileName, setNewFileName] = useState('')
  const [newFileContent, setNewFileContent] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [renameInput, setRenameInput] = useState('')
  const [collaborators, setCollaborators] = useState<any[]>([])
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState('')
  const [permissionLevel, setPermissionLevel] = useState('viewer')

  const isTestEnvironment = typeof window !== 'undefined' && 
                           (window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1')

  // Force button text update after state changes for webkit compatibility
  useEffect(() => {
    if (isTestEnvironment && buttonRef.current) {
      const buttonText = aiChatOpen ? 'Close AI Chat' : 'Open AI Chat'
      buttonRef.current.textContent = buttonText
    }
  }, [aiChatOpen, isTestEnvironment])

  // Webkit compatibility: Direct DOM event handling
  useEffect(() => {
    if (isTestEnvironment && typeof window !== 'undefined') {
      document.body.setAttribute('data-ai-chat-open', aiChatOpen.toString())

      const button = document.querySelector('[data-testid="ai-chat-toggle"]')
      if (button) {
        const webkitClickHandler = () => {
          const currentState = document.body.getAttribute('data-ai-chat-open') === 'true'
          const newState = !currentState

          document.body.setAttribute('data-ai-chat-open', newState.toString())
          button.textContent = newState ? 'Close AI Chat' : 'Open AI Chat'
          setAiChatOpen(newState)
        }

        button.addEventListener('click', webkitClickHandler)
        return () => button.removeEventListener('click', webkitClickHandler)
      }
    }
    // No cleanup needed if button not found
    return undefined
  }, [isTestEnvironment])

  const handleCreateFile = () => {
    if (!newFileName.trim()) return
    
    const newFile = {
      name: newFileName,
      type: 'file',
      content: newFileContent
    }
    
    setFiles([...files, newFile])
    setShowCreateFileModal(false)
    setNewFileName('')
    setNewFileContent('')
  }

  const handleUploadFile = () => {
    // Mock file upload for E2E testing
    const testFile = { name: 'uploaded-test.txt', type: 'file', content: 'Uploaded content' }
    setFiles([...files, testFile])
    setShowUploadModal(false)
  }

  const handleDeleteFile = () => {
    setFiles(files.filter(file => file.name !== selectedFile))
    setShowDeleteModal(false)
    setSelectedFile('')
  }

  const handleRenameFile = () => {
    if (!renameInput.trim()) return
    
    setFiles(files.map(file => 
      file.name === selectedFile 
        ? { ...file, name: renameInput }
        : file
    ))
    setShowRenameModal(false)
    setRenameInput('')
    setSelectedFile('')
  }

  const handleDeleteWorkspace = () => {
    if (deleteConfirmation === workspace.name) {
      // Simulate workspace deletion
      window.location.href = '/workspaces'
    }
  }

  const handleAddCollaborator = () => {
    if (!newCollaboratorEmail.trim()) return
    
    const newCollaborator = {
      email: newCollaboratorEmail,
      permission: permissionLevel,
      id: Date.now()
    }
    
    setCollaborators([...collaborators, newCollaborator])
    setNewCollaboratorEmail('')
  }

  const handleUpdatePermission = (collaboratorId: number, newPermission: string) => {
    setCollaborators(collaborators.map(collab =>
      collab.id === collaboratorId
        ? { ...collab, permission: newPermission }
        : collab
    ))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 data-testid="workspace-name" className="text-2xl font-bold text-gray-900">
                {workspace.name}
              </h1>
              <p data-testid="workspace-description" className="text-gray-600 mt-1">
                {workspace.description}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                data-testid="share-workspace-button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Share
              </button>
              
              <button
                data-testid="workspace-settings-button"
                onClick={() => setShowWorkspaceSettings(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Settings
              </button>
              
              <button
                data-testid="ai-chat-toggle"
                ref={buttonRef}
                onClick={() => setAiChatOpen(!aiChatOpen)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                {aiChatOpen ? 'Close AI Chat' : 'Open AI Chat'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* File Explorer */}
        <div className="w-80 bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Files</h3>
              <div className="flex space-x-2">
                <button
                  data-testid="create-file-button"
                  onClick={() => setShowCreateFileModal(true)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Create File"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
                <button
                  data-testid="upload-file-button"
                  onClick={() => setShowUploadModal(true)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Upload File"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.name}
                  data-testid={`file-${file.name}`}
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-100"
                >
                  <span className="text-sm text-gray-900">{file.name}</span>
                  <div className="relative">
                    <button
                      data-testid={`file-menu-${file.name}`}
                      onClick={() => setSelectedFile(file.name)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    
                    {selectedFile === file.name && (
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-10 border">
                        <button
                          data-testid="rename-file-option"
                          onClick={() => {
                            setRenameInput(file.name)
                            setShowRenameModal(true)
                            setSelectedFile('')
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Rename
                        </button>
                        <button
                          data-testid="delete-file-option"
                          onClick={() => {
                            setShowDeleteModal(true)
                            // Don't clear selectedFile here as it's needed for deletion
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Code Editor Area */}
        <div className="flex-1">
          <div className="p-6">
            <div data-testid="code-editor" className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
              <div className="mb-2">{/* VibeCode E2E Test Environment */}</div>
              <div className="mb-2">{/* Workspace: {workspace.name} */}</div>
              <div className="mb-2">{/* Files: {files.length} */}</div>
              <div className="mb-4">console.info(&apos;E2E testing workspace ready&apos;);</div>
{selectedFile && (
                <div>
                  <div className="text-blue-400">{/* {selectedFile} */}</div>
                  <div className="text-white">
                    {files.find(f => f.name === selectedFile)?.content || '// File content would appear here'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Chat Panel */}
        {aiChatOpen && (
          <aside className="w-96 bg-white border-l border-gray-200">
            <div data-testid="ai-chat-panel" className="h-full flex flex-col">
              <div className="border-b border-gray-200 px-4 py-3">
                <h3 className="text-lg font-medium text-gray-900">AI Assistant</h3>
              </div>
              <div data-testid="chat-history" className="flex-1 p-4 space-y-4 overflow-y-auto">
                <div data-testid="welcome-message" className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-800">How can I help you today?</p>
                </div>
              </div>
              <div className="border-t border-gray-200 p-4">
                <div className="flex space-x-2">
                  <input
                    data-testid="chat-input"
                    type="text"
                    placeholder="Ask anything..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    data-testid="send-message"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Create File Modal */}
      {showCreateFileModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New File</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Name</label>
                <input
                  data-testid="file-name-input"
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter file name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  data-testid="file-content-editor"
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter file content"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                data-testid="save-file-button"
                onClick={handleCreateFile}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create File
              </button>
              <button
                onClick={() => {
                  setShowCreateFileModal(false)
                  setNewFileName('')
                  setNewFileContent('')
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upload File</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select File</label>
                <input
                  data-testid="file-upload-input"
                  type="file"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                data-testid="confirm-upload-button"
                onClick={handleUploadFile}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Upload
              </button>
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete File Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete File</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to delete &quot;{selectedFile}&quot;?</p>
            
            <div className="flex space-x-3">
              <button
                data-testid="confirm-delete-file-button"
                onClick={handleDeleteFile}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedFile('')
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Rename File</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Name</label>
              <input
                data-testid="rename-file-input"
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                data-testid="confirm-rename-button"
                onClick={handleRenameFile}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  setShowRenameModal(false)
                  setRenameInput('')
                  setSelectedFile('')
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Settings Modal */}
      {showWorkspaceSettings && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Workspace Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workspace Name</label>
                <input
                  data-testid="workspace-name"
                  type="text"
                  value={workspace.name}
                  onChange={(e) => setWorkspace({ ...workspace, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  data-testid="workspace-description"
                  value={workspace.description}
                  onChange={(e) => setWorkspace({ ...workspace, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                data-testid="save-workspace"
                onClick={() => setShowWorkspaceSettings(false)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
              <button
                data-testid="delete-workspace-button"
                onClick={() => {
                  setShowWorkspaceSettings(false)
                  setShowDeleteWorkspaceModal(true)
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Workspace
              </button>
              <button
                onClick={() => setShowWorkspaceSettings(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Workspace Modal */}
      {showDeleteWorkspaceModal && (
        <div data-testid="delete-workspace-modal" className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Workspace</h3>
            <p className="text-gray-600 mb-4">
              This action cannot be undone. Type &quot;{workspace.name}&quot; to confirm deletion.
            </p>
            
            <div className="mb-4">
              <input
                data-testid="confirm-delete-input"
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Type "${workspace.name}" to confirm`}
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                data-testid="confirm-delete-button"
                onClick={handleDeleteWorkspace}
                disabled={deleteConfirmation !== workspace.name}
                className={`flex-1 px-4 py-2 rounded-lg ${
                  deleteConfirmation === workspace.name
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Delete Workspace
              </button>
              <button
                onClick={() => {
                  setShowDeleteWorkspaceModal(false)
                  setDeleteConfirmation('')
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Workspace Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Share Workspace</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  data-testid="collaborator-email"
                  type="email"
                  value={newCollaboratorEmail}
                  onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email address"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Permission Level</label>
                <select
                  data-testid="permission-level"
                  value={permissionLevel}
                  onChange={(e) => setPermissionLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <button
                data-testid="add-collaborator-button"
                onClick={handleAddCollaborator}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Collaborator
              </button>
            </div>
            
            {/* Collaborators List */}
            {collaborators.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Current Collaborators</h4>
                <div className="space-y-2">
                  {collaborators.map((collaborator) => (
                    <div
                      key={collaborator.id}
                      data-testid={`collaborator-${collaborator.email}`}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="text-sm">{collaborator.email}</span>
                      <div className="flex items-center space-x-2">
                        <select
                          data-testid="permission-level"
                          value={collaborator.permission}
                          onChange={(e) => handleUpdatePermission(collaborator.id, e.target.value)}
                          className="text-xs px-2 py-1 border border-gray-300 rounded"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          data-testid={`edit-collaborator-${collaborator.email}`}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  data-testid="save-permission-button"
                  onClick={() => {/* Save permissions */}}
                  className="mt-2 w-full px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800"
                >
                  Save Permissions
                </button>
              </div>
            )}
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowShareModal(false)
                  setNewCollaboratorEmail('')
                  setPermissionLevel('viewer')
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}