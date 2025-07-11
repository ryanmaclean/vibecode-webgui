/**
 * Code Server Integration Component
 * 
 * Bridges AI assistance with code-server iframe communication
 * Based on claude-prompt.md VS Code extension patterns for webview integration
 * 
 * Staff Engineer Implementation - Production-ready AI/IDE integration
 */

'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Panel, 
  PanelGroup, 
  PanelResizeHandle,
  ImperativePanelHandle 
} from 'react-resizable-panels'
import { 
  Bot, 
  MessageSquare, 
  Code2, 
  Settings, 
  X,
  Maximize2,
  Minimize2
} from 'lucide-react'
import AIChatPanel from './AIChatPanel'
import AICodeAssistant from './AICodeAssistant'
import type { CodeContext } from '@/lib/claude-code-sdk'

interface CodeServerIntegrationProps {
  workspaceId: string
  authToken: string
  className?: string
}

interface VSCodeMessage {
  type: 'selection-changed' | 'file-changed' | 'cursor-moved' | 'ai-request' | 'settings-updated'
  data: any
}

interface CodeServerState {
  currentFile: string | null
  selectedText: string | null
  cursorPosition: { line: number; column: number } | null
  language: string | null
  projectStructure: string[]
  recentChanges: string[]
}

type AIPanel = 'chat' | 'assistant' | null

export default function CodeServerIntegration({
  workspaceId,
  authToken,
  className = ''
}: CodeServerIntegrationProps) {
  const [codeServerState, setCodeServerState] = useState<CodeServerState>({
    currentFile: null,
    selectedText: null,
    cursorPosition: null,
    language: null,
    projectStructure: [],
    recentChanges: []
  })

  const [activePanel, setActivePanel] = useState<AIPanel>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [panelSize, setPanelSize] = useState(30) // Default 30% for AI panel

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const panelRef = useRef<ImperativePanelHandle>(null)

  // Listen for messages from code-server iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security check - only accept messages from our code-server origin
      if (!event.origin.includes('localhost') && !event.origin.includes(window.location.hostname)) {
        return
      }

      const message: VSCodeMessage = event.data

      switch (message.type) {
        case 'selection-changed':
          setCodeServerState(prev => ({
            ...prev,
            selectedText: message.data.text,
            language: message.data.language
          }))
          break

        case 'file-changed':
          setCodeServerState(prev => ({
            ...prev,
            currentFile: message.data.filePath,
            language: message.data.language,
            recentChanges: [
              `Opened: ${message.data.filePath}`,
              ...prev.recentChanges.slice(0, 9)
            ]
          }))
          break

        case 'cursor-moved':
          setCodeServerState(prev => ({
            ...prev,
            cursorPosition: {
              line: message.data.line,
              column: message.data.column
            }
          }))
          break

        case 'ai-request':
          // Handle explicit AI assistance requests from VS Code
          handleAIRequest(message.data)
          break

        case 'settings-updated':
          // Handle settings changes
          console.log('Settings updated:', message.data)
          break

        default:
          console.log('Unknown message type:', message.type)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Handle AI assistance requests from code-server
  const handleAIRequest = useCallback((data: any) => {
    const { action, text, filePath } = data

    switch (action) {
      case 'explain':
      case 'optimize':
      case 'debug':
      case 'test':
        setActivePanel('assistant')
        break
      case 'chat':
        setActivePanel('chat')
        break
      default:
        setActivePanel('assistant')
    }

    // Update state with request context
    setCodeServerState(prev => ({
      ...prev,
      selectedText: text || prev.selectedText,
      currentFile: filePath || prev.currentFile
    }))
  }, [])

  // Send messages to code-server iframe
  const sendToCodeServer = useCallback((message: any) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(message, '*')
    }
  }, [])

  // Handle code insertion from AI assistance
  const handleCodeInsert = useCallback((code: string, language: string) => {
    sendToCodeServer({
      type: 'insert-code',
      data: { code, language, position: codeServerState.cursorPosition }
    })
  }, [codeServerState.cursorPosition, sendToCodeServer])

  // Handle action requests from AI assistance
  const handleActionRequest = useCallback((action: string, target: string) => {
    sendToCodeServer({
      type: 'execute-action',
      data: { action, target }
    })
  }, [sendToCodeServer])

  // Handle iframe load to establish communication
  const handleIframeLoad = useCallback(() => {
    // Initialize communication with code-server
    sendToCodeServer({
      type: 'ai-integration-ready',
      data: { workspaceId, features: ['chat', 'assistant', 'code-completion'] }
    })

    // Request current state
    sendToCodeServer({
      type: 'get-current-state',
      data: {}
    })
  }, [workspaceId, sendToCodeServer])

  // Build current code context
  const getCodeContext = useCallback((): CodeContext => {
    return {
      language: codeServerState.language || 'javascript',
      filePath: codeServerState.currentFile || 'untitled.js',
      selectedText: codeServerState.selectedText || undefined,
      cursorPosition: codeServerState.cursorPosition || undefined,
      projectStructure: codeServerState.projectStructure,
      recentChanges: codeServerState.recentChanges
    }
  }, [codeServerState])

  // Toggle AI panel
  const togglePanel = (panel: AIPanel) => {
    if (activePanel === panel) {
      setActivePanel(null)
      setPanelSize(0)
    } else {
      setActivePanel(panel)
      setPanelSize(isMaximized ? 70 : 30)
    }
  }

  // Maximize/minimize AI panel
  const toggleMaximize = () => {
    if (activePanel) {
      const newMaximized = !isMaximized
      setIsMaximized(newMaximized)
      setPanelSize(newMaximized ? 70 : 30)
    }
  }

  return (
    <div className={`w-full h-full ${className}`}>
      <PanelGroup direction="horizontal">
        {/* Code Server Panel */}
        <Panel defaultSize={activePanel ? (isMaximized ? 30 : 70) : 100} minSize={20}>
          <div className="relative w-full h-full">
            {/* Code Server Iframe */}
            <iframe
              ref={iframeRef}
              src={`/api/code-server/${workspaceId}?token=${authToken}&ai=enabled`}
              className="w-full h-full border-0"
              title="Code Editor"
              allow="microphone; camera; clipboard-read; clipboard-write"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              onLoad={handleIframeLoad}
            />

            {/* AI Panel Controls Overlay */}
            <div className="absolute top-4 right-4 flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg p-1">
              <button
                onClick={() => togglePanel('chat')}
                className={`p-2 rounded transition-colors ${
                  activePanel === 'chat'
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="AI Chat"
              >
                <MessageSquare className="w-4 h-4" />
              </button>

              <button
                onClick={() => togglePanel('assistant')}
                className={`p-2 rounded transition-colors ${
                  activePanel === 'assistant'
                    ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="Code Assistant"
              >
                <Code2 className="w-4 h-4" />
              </button>

              {activePanel && (
                <>
                  <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />
                  
                  <button
                    onClick={toggleMaximize}
                    className="p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={isMaximized ? 'Minimize AI Panel' : 'Maximize AI Panel'}
                  >
                    {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => setActivePanel(null)}
                    className="p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Close AI Panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Loading State */}
            {!codeServerState.currentFile && (
              <div className="absolute inset-0 bg-gray-900/10 flex items-center justify-center pointer-events-none">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                    <Bot className="w-5 h-5" />
                    <span>Loading IDE...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* AI Panel */}
        {activePanel && (
          <>
            <PanelResizeHandle className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors" />
            
            <Panel 
              ref={panelRef}
              defaultSize={panelSize}
              minSize={25}
              maxSize={80}
            >
              <div className="h-full border-l border-gray-200 dark:border-gray-700">
                {activePanel === 'chat' && (
                  <AIChatPanel
                    codeContext={getCodeContext()}
                    onCodeInsert={handleCodeInsert}
                    onActionRequest={handleActionRequest}
                    className="h-full"
                  />
                )}

                {activePanel === 'assistant' && (
                  <AICodeAssistant
                    codeContext={getCodeContext()}
                    selectedText={codeServerState.selectedText || undefined}
                    onCodeGenerated={handleCodeInsert}
                    onAnalysisComplete={(analysis) => {
                      console.log('Analysis complete:', analysis)
                      // Could send results back to code-server for inline display
                      sendToCodeServer({
                        type: 'analysis-complete',
                        data: analysis
                      })
                    }}
                    className="h-full"
                  />
                )}
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center space-x-4">
          {codeServerState.currentFile && (
            <span>📁 {codeServerState.currentFile}</span>
          )}
          {codeServerState.language && (
            <span>🔤 {codeServerState.language}</span>
          )}
          {codeServerState.cursorPosition && (
            <span>📍 Ln {codeServerState.cursorPosition.line}, Col {codeServerState.cursorPosition.column}</span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {activePanel && (
            <div className="flex items-center space-x-1">
              <Bot className="w-3 h-3" />
              <span>AI {activePanel === 'chat' ? 'Chat' : 'Assistant'} Active</span>
            </div>
          )}
          <span>Workspace: {workspaceId}</span>
        </div>
      </div>
    </div>
  )
}