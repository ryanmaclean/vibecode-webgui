// VS Code Integration Component - Embeds AI chat within code-server
// Provides seamless AI assistance within the VS Code environment

import React, { useEffect, useRef, useState } from 'react'
import { MessageSquare, Bot, Upload, Settings, Minimize2, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AIChatInterface from './AIChatInterface'

interface VSCodeIntegrationProps {
  workspaceId: string
  codeServerUrl?: string
  isEmbedded?: boolean
  className?: string
}

interface CodeServerMessage {
  type: 'file-change' | 'selection-change' | 'error' | 'context-update'
  data: any
}

export default function VSCodeIntegration({
  workspaceId,
  codeServerUrl = 'http://localhost:8080',
  isEmbedded = false,
  className = ''
}: VSCodeIntegrationProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [currentContext, setCurrentContext] = useState<string[]>([])
  const [currentFile, setCurrentFile] = useState<string>('')
  const [selectedText, setSelectedText] = useState<string>('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Listen for messages from code-server iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Ensure message is from our code-server
      if (!event.origin.includes('localhost') && !event.origin.includes(codeServerUrl)) {
        return
      }

      try {
        const message: CodeServerMessage = event.data

        switch (message.type) {
          case 'file-change':
            setCurrentFile(message.data.fileName || '')
            updateContext(message.data.fileName)
            break

          case 'selection-change':
            setSelectedText(message.data.selectedText || '')
            break

          case 'context-update':
            setCurrentContext(message.data.files || [])
            break

          case 'error':
            console.error('Code-server error:', message.data)
            break
        }
      } catch (error) {
        console.error('Failed to parse message from code-server:', error)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [codeServerUrl])

  // Send message to code-server iframe
  const sendToCodeServer = (type: string, data: any) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type,
        data
      }, '*')
    }
  }

  // Update context when file changes
  const updateContext = (fileName: string) => {
    if (fileName && !currentContext.includes(fileName)) {
      setCurrentContext(prev => [...prev.slice(-4), fileName]) // Keep last 5 files
    }
  }

  // Handle file upload and add to context
  const handleFileUpload = async (files: FileList) => {
    try {
      const formData = new FormData()
      formData.append('workspaceId', workspaceId)

      Array.from(files).forEach(file => {
        formData.append('files', file)
      })

      const response = await fetch('/api/ai/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        const uploadedFileNames = result.files.map((f: any) => f.name)
        setCurrentContext(prev => [...prev, ...uploadedFileNames])

        // Notify user of successful upload
        console.log(`Uploaded ${result.filesUploaded} files for AI context`)
      }
    } catch (error) {
      console.error('File upload failed:', error)
    }
  }

  // Generate AI prompt with current context
  const generateContextualPrompt = (userInput: string) => {
    let prompt = userInput

    if (currentFile) {
      prompt += `\n\nCurrent file: ${currentFile}`
    }

    if (selectedText) {
      prompt += `\n\nSelected code:\n\`\`\`\n${selectedText}\n\`\`\``
    }

    if (currentContext.length > 0) {
      prompt += `\n\nRelevant files: ${currentContext.join(', ')}`
    }

    return prompt
  }

  // Enhanced AI chat interface with VS Code context
  const VSCodeAIChat = () => (
    <AIChatInterface
      workspaceId={workspaceId}
      initialContext={currentContext}
      onFileUpload={handleFileUpload}
      className="h-full"
    />
  )

  // For workspace tab integration, always show side-by-side
  return (
    <div className={`flex h-full bg-gray-900 ${className}`}>
      {/* Code-server panel */}
      <div className="flex-1">
        <iframe
          ref={iframeRef}
          src={codeServerUrl}
          className="w-full h-full border-0 bg-gray-900"
          title="VS Code"
          allow="clipboard-read; clipboard-write"
          style={{ backgroundColor: '#0d1117' }}
        />
      </div>

      {/* AI Chat panel */}
      <div className="w-96 border-l border-gray-700 bg-gray-800">
        <VSCodeAIChat />
      </div>
    </div>
  )
}
