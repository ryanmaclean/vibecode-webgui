// VS Code Integration Component - Embeds AI chat within code-server
// Provides seamless AI assistance within the VS Code environment

import React, { useEffect, useRef, useState } from 'react'
import { Bot, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  className = ''
}: VSCodeIntegrationProps) {
  const [currentFile, setCurrentFile] = useState<string>('')
  const [selectedText, setSelectedText] = useState<string>('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Listen for messages from code-server iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Basic security check
      if (!event.origin.includes('localhost') && !event.origin.includes(codeServerUrl)) {
        return
      }

      try {
        const message: CodeServerMessage = event.data

        switch (message.type) {
          case 'file-change':
            setCurrentFile(message.data.fileName || '')
            break
          case 'selection-change':
            setSelectedText(message.data.selectedText || '')
            break
          case 'error':
            console.error('Code-server error:', message.data)
            break
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [codeServerUrl])

  // Helper component for the AI chat interface
  const VSCodeAIChat = () => (
    <div className="h-full flex flex-col bg-gray-800">
      <CardHeader className="p-4 border-b border-gray-700">
        <CardTitle className="text-lg flex items-center">
          <Bot className="w-5 h-5 mr-2" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-y-auto">
        <AIChatInterface
          workspaceId={workspaceId}
          initialPrompt={selectedText ? `Explain this code:\n\`\`\`\n${selectedText}\n\`\`\`` : ''}
          context={{ currentFile, selectedText }}
        />
      </CardContent>
      <div className="p-2 border-t border-gray-700">
        <Button size="sm" variant="ghost" className="w-full justify-start">
          <Upload className="w-4 h-4 mr-2" />
          Upload Context
        </Button>
      </div>
    </div>
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
