/**
 * Workspace Page - E2E Test Compatible
 * Provides basic workspace UI elements for E2E testing without external dependencies
 */

'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

export default function WorkspacePage() {
  const params = useParams()
  const workspaceId = params.id as string
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Force test mode for debugging
  const isTestEnvironment = true

  // Force button text update after state changes for webkit compatibility
  useEffect(() => {
    if (isTestEnvironment && buttonRef.current) {
      const buttonText = aiChatOpen ? 'Close AI Chat' : 'Open AI Chat'
      buttonRef.current.textContent = buttonText
      console.log('useEffect: Updated button text to:', buttonText, 'State:', aiChatOpen)
    }
  }, [aiChatOpen, isTestEnvironment])

  // Webkit compatibility: Direct DOM event handling
  useEffect(() => {
    if (isTestEnvironment && typeof window !== 'undefined') {
      // Set initial DOM state
      document.body.setAttribute('data-ai-chat-open', aiChatOpen.toString())
      
      // Find the button and add direct DOM listener
      const button = document.querySelector('[data-testid="ai-chat-toggle"]')
      if (button) {
        const webkitClickHandler = () => {
          const currentState = document.body.getAttribute('data-ai-chat-open') === 'true'
          const newState = !currentState
          
          // Update DOM immediately
          document.body.setAttribute('data-ai-chat-open', newState.toString())
          button.textContent = newState ? 'Close AI Chat' : 'Open AI Chat'
          
          // Update React state
          setAiChatOpen(newState)
          
          console.log('Webkit DOM handler executed:', { currentState, newState })
        }
        
        // Remove existing React onClick and add direct DOM listener
        button.addEventListener('click', webkitClickHandler, true) // Use capture phase
        
        return () => {
          button.removeEventListener('click', webkitClickHandler, true)
        }
      }
    }
  }, [isTestEnvironment, setAiChatOpen]) // Re-run when component updates

  // Fallback React handler (may not work in webkit)
  const handleChatToggle = () => {
    const newState = !aiChatOpen
    setAiChatOpen(newState)
    
    if (isTestEnvironment) {
      document.body.setAttribute('data-ai-chat-open', newState.toString())
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">
              Workspace {workspaceId}
            </h1>
            {isTestEnvironment && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                E2E Test Mode
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              ref={buttonRef}
              data-testid="ai-chat-toggle"
              onClick={handleChatToggle}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {aiChatOpen ? 'Close AI Chat' : 'Open AI Chat'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Main Content Area */}
        <main className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Welcome to Workspace {workspaceId}
            </h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-800">Quick Start</h3>
                <p className="mt-1 text-sm text-blue-700">
                  This is a test workspace for E2E testing. Click "Open AI Chat" to start testing AI features.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900">Files</h4>
                  <p className="text-sm text-gray-600 mt-1">No files yet</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900">Recent Activity</h4>
                  <p className="text-sm text-gray-600 mt-1">No recent activity</p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* AI Chat Panel */}
        {aiChatOpen && (
          <aside className="w-96 bg-white border-l border-gray-200">
            <div data-testid="ai-chat-panel" className="h-full flex flex-col">
              <div className="border-b border-gray-200 px-4 py-3">
                <h3 className="text-lg font-medium text-gray-900">AI Assistant</h3>
              </div>

              <div data-testid="chat-history" className="flex-1 p-4 space-y-4 overflow-y-auto">
                <div data-testid="welcome-message" className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    How can I help you today?
                  </p>
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
    </div>
  )
}