/**
 * Workspace Layout Component for VibeCode WebGUI
 * Provides the main development environment layout with resizable panels
 */

'use client'

import { useState, useRef, useCallback } from 'react'
import CodeServerIDE from '@/components/ide/CodeServerIDE'
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
  const [terminalHeight, setTerminalHeight] = useState(200)
  const [isResizing, setIsResizing] = useState<'sidebar' | 'terminal' | null>(null)
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
      const newHeight = Math.max(150, Math.min(400, rect.bottom - e.clientY))
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

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col">
          {/* Code-server IDE */}
          <div className="flex-1">
            <CodeServerIDE
              workspaceId={workspaceId}
              className="h-full"
              onReady={(iframe) => {
                console.log('Code-server IDE ready:', iframe)
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

          {/* Terminal Panel */}
          <div 
            className="bg-gray-900 border-t border-gray-700"
            style={{ height: terminalHeight }}
          >
            {/* Terminal Header */}
            <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center px-3">
              <span className="text-gray-300 text-sm font-medium">Terminal</span>
              <div className="flex-1" />
              <button className="text-gray-400 hover:text-white text-xs">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            </div>
            
            {/* Terminal Content Placeholder */}
            <div className="p-3 text-green-400 font-mono text-sm">
              <div>$ npm run dev</div>
              <div className="text-gray-400">Starting development server...</div>
              <div className="text-gray-400">Local: http://localhost:3000</div>
              <div className="text-gray-400">Ready in 1.2s</div>
              <div className="flex items-center">
                <span>$ </span>
                <div className="w-2 h-5 bg-green-400 ml-1 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}