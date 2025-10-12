/**
 * AI Code Assistant Component for VibeCode WebGUI
 * Provides AI-powered code assistance using Vercel AI SDK
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from 'ai/react'
import { useAuth } from '@/hooks/useAuth'

interface CodeAssistantProps {
  workspaceId: string
  visible: boolean
  onToggle: () => void
  className?: string
}

interface CodeContext {
  fileName?: string
  language?: string
  selectedCode?: string
  cursorPosition?: { line: number; column: number }
}

export default function CodeAssistant({
  workspaceId,
  visible,
  onToggle,
  className = '',
}: CodeAssistantProps) {
  const { user } = useAuth()
  const [codeContext, setCodeContext] = useState<CodeContext>({})
  const [isMinimized, setIsMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/ai/chat',
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hello! I'm your AI coding assistant for workspace ${workspaceId}. I can help you with:

• Code explanations and debugging
• Code generation and completion
• Best practices and optimization
• Architecture suggestions
• Testing strategies

Feel free to share your code or ask any development questions!`,
      },
    ],
    body: {
      workspaceId,
      userId: user?.id,
      codeContext,
    },
  })

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Listen for code context from the IDE
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'code-context') {
        setCodeContext(event.data.context)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleQuickAction = (action: string) => {
    let prompt = ''

    switch (action) {
      case 'explain':
        prompt = codeContext.selectedCode
          ? `Please explain this ${codeContext.language || 'code'}:\n\n\`\`\`${codeContext.language || ''}\n${codeContext.selectedCode}\n\`\`\``
          : 'Please explain the current code file'
        break
      case 'optimize':
        prompt = codeContext.selectedCode
          ? `How can I optimize this ${codeContext.language || 'code'}?\n\n\`\`\`${codeContext.language || ''}\n${codeContext.selectedCode}\n\`\`\``
          : 'How can I optimize this code file?'
        break
      case 'debug':
        prompt = codeContext.selectedCode
          ? `Help me debug this ${codeContext.language || 'code'}:\n\n\`\`\`${codeContext.language || ''}\n${codeContext.selectedCode}\n\`\`\``
          : 'Help me debug this code'
        break
      case 'test':
        prompt = codeContext.selectedCode
          ? `Write tests for this ${codeContext.language || 'code'}:\n\n\`\`\`${codeContext.language || ''}\n${codeContext.selectedCode}\n\`\`\``
          : 'Help me write tests for this code'
        break
      default:
        return
    }

    // Update input value and submit
    handleInputChange({ target: { value: prompt } } as React.ChangeEvent<HTMLInputElement>)

    // Use a timeout to ensure the input value is updated before submission
    setTimeout(() => {
      const form = document.querySelector('form')
      if (form) {
        const event = new Event('submit', { cancelable: true, bubbles: true })
        form.dispatchEvent(event)
      }
    }, 100)
  }

  if (!visible) return null

  return (
    <div className={`fixed right-4 bottom-4 w-96 bg-white border border-gray-200 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <div className="h-6 w-6 bg-blue-600 rounded flex items-center justify-center">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">AI Assistant</h3>
          {codeContext.fileName && (
            <span className="text-xs text-gray-500">• {codeContext.fileName}</span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-gray-400 hover:text-gray-600"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMinimized ? "M4 8l4-4 4 4" : "M20 12l-4 4-4-4"} />
            </svg>
          </button>
          <button
            onClick={onToggle}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Quick Actions */}
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Quick Actions:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleQuickAction('explain')}
                disabled={isLoading}
                className="px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 disabled:opacity-50"
              >
                Explain Code
              </button>
              <button
                onClick={() => handleQuickAction('optimize')}
                disabled={isLoading}
                className="px-3 py-2 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded border border-green-200 disabled:opacity-50"
              >
                Optimize
              </button>
              <button
                onClick={() => handleQuickAction('debug')}
                disabled={isLoading}
                className="px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 disabled:opacity-50"
              >
                Debug Help
              </button>
              <button
                onClick={() => handleQuickAction('test')}
                disabled={isLoading}
                className="px-3 py-2 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 disabled:opacity-50"
              >
                Write Tests
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="h-64 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg text-sm ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 p-3 rounded-lg text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                    <span>AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-start">
                <div className="bg-red-50 text-red-800 p-3 rounded-lg text-sm border border-red-200">
                  <p className="font-medium">Error:</p>
                  <p>{error.message}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask me anything about your code..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
