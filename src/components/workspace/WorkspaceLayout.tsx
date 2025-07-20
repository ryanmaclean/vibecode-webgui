/**
 * Workspace Layout Component for VibeCode WebGUI
 * Provides the main development environment layout with resizable panels
 */

'use client'

import { useState, useRef, useCallback } from 'react'
import CodeServerIDE from '@/components/ide/CodeServerIDE'
import CodeAssistant from '@/components/ai/CodeAssistant'
import EnhancedTerminal from '@/components/terminal/EnhancedTerminal'
import { useAuth } from '@/hooks/useAuth'

interface WorkspaceLayoutProps {
  workspaceId: string
  projectName?: string
  className?: string
}

export default function WorkspaceLayout({
  workspaceId,
  projectName = 'Untitled Project',
  className = '',
}: WorkspaceLayoutProps) {
  const { user } = useAuth()
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [terminalHeight, setTerminalHeight] = useState(320)
  const [isResizing, setIsResizing] = useState<'sidebar' | 'terminal' | null>(null)
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const layoutRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((type: 'sidebar' | 'terminal') => {
    setIsResizing(type)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !layoutRef.current) return

    const rect = layoutRef.current.getBoundingClientRect()

    if (isResizing === 'sidebar') {
      const newWidth = Math.max(200, Math.min(600, e.clientX - rect.left))
      setSidebarWidth(newWidth)
    } else if (isResizing === 'terminal') {
      const newHeight = Math.max(160, Math.min(600, rect.bottom - e.clientY))
      setTerminalHeight(newHeight)
    }
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(null)
  }, [])

  // Mouse event listeners
  useState(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)

      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  })

  return (
    <div ref={layoutRef} className={`flex flex-col h-screen bg-gray-900 ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between h-12 bg-gray-800 border-b border-gray-700 px-4">
        <div className="flex items-center space-x-3">
          <div className="h-6 w-6 bg-blue-600 rounded flex items-center justify-center">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <h1 className="text-white font-medium">{projectName}</h1>
          <span className="text-gray-400 text-sm">•</span>
          <span className="text-gray-400 text-sm">{workspaceId}</span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAIAssistant(!showAIAssistant)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              showAIAssistant
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Toggle AI Assistant"
          >
            <svg className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Assistant
          </button>
          <span className="text-gray-300 text-sm">Welcome, {user?.name}</span>
          <div className="h-6 w-6 bg-green-500 rounded-full flex items-center justify-center">
            <div className="h-2 w-2 bg-white rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className="bg-gray-800 border-r border-gray-700 flex flex-col"
          style={{ width: sidebarWidth }}
        >
          {/* Sidebar Header */}
          <div className="h-10 bg-gray-750 border-b border-gray-700 flex items-center px-3">
            <span className="text-gray-300 text-sm font-medium">Explorer</span>
          </div>

          {/* File Tree Placeholder */}
          <div className="flex-1 p-3 text-gray-400 text-sm">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                </svg>
                <span>src/</span>
              </div>
              <div className="flex items-center space-x-2 ml-4">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>app.tsx</span>
              </div>
              <div className="flex items-center space-x-2 ml-4">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>index.ts</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>package.json</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>README.md</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Resize Handle */}
        <div
          className="w-1 bg-gray-700 hover:bg-gray-600 cursor-col-resize transition-colors"
          onMouseDown={() => handleMouseDown('sidebar')}
        />

        {/* Main Editor Area - Split between Code-server IDE and Enhanced Terminal */}
        <div className="flex-1 flex flex-col">
          {/* Code Editor - Code-server without terminal */}
          <div className="flex-1">
            <CodeServerIDE
              workspaceId={workspaceId}
              className="h-full"
              onReady={(iframe) => {
                console.log('Code-server IDE ready (terminal disabled):', iframe)
                
                // Hide the built-in terminal since we use our enhanced terminal
                try {
                  iframe.contentWindow?.postMessage({
                    type: 'workbench.action.togglePanel'
                  }, '*')
                } catch (error) {
                  console.log('Could not hide terminal panel:', error)
                }
              }}
              onError={(error) => {
                console.error('Code-server IDE error:', error)
              }}
            />
          </div>

          {/* Terminal Resize Handle */}
          <div
            className="h-1 bg-gray-700 hover:bg-gray-600 cursor-row-resize transition-colors"
            onMouseDown={() => handleMouseDown('terminal')}
          />

                     {/* Enhanced Terminal with AI Integration */}
           <div className="min-h-40" style={{ height: `${terminalHeight}px` }}>
            <EnhancedTerminal
              workspaceId={workspaceId}
              className="h-full border-t border-gray-700"
              theme="dark"
              enableAI={true}
              enableWebGL={true}
              onReady={(terminal) => {
                console.log('Enhanced AI terminal ready:', terminal)
              }}
            />
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <CodeAssistant
        workspaceId={workspaceId}
        visible={showAIAssistant}
        onToggle={() => setShowAIAssistant(false)}
      />
    </div>
  )
}
