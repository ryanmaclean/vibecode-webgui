/**
 * AI Chat Panel Component
 * 
 * Claude Code AI-powered chat interface integrated with web-based IDE
 * Based on claude-prompt.md webview integration patterns
 * 
 * Staff Engineer Implementation - Production-ready AI assistance
 */

'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Code, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { claudeCodeSDK } from '@/lib/claude-code-sdk'
import type { ChatRequest, ChatResponse, CodeContext } from '@/lib/claude-code-sdk'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  codeBlocks?: Array<{
    language: string
    code: string
    explanation?: string
  }>
  actions?: Array<{
    type: 'refactor' | 'test' | 'explain' | 'optimize'
    target: string
    description: string
  }>
}

interface AIChatPanelProps {
  className?: string
  codeContext?: CodeContext
  onCodeInsert?: (code: string, language: string) => void
  onActionRequest?: (action: string, target: string) => void
}

export default function AIChatPanel({ 
  className = '',
  codeContext,
  onCodeInsert,
  onActionRequest 
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setError(null)

    try {
      const request: ChatRequest = {
        message: inputValue,
        context: codeContext || {
          language: 'javascript',
          filePath: 'untitled.js'
        },
        conversationHistory: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      }

      const response: ChatResponse = await claudeCodeSDK.chat(request)

      const assistantMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        codeBlocks: response.codeBlocks,
        actions: response.actions
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI response')
      console.error('AI Chat error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleCodeInsert = (code: string, language: string) => {
    onCodeInsert?.(code, language)
  }

  const handleActionClick = (action: string, target: string) => {
    onActionRequest?.(action, target)
  }

  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Claude Code Assistant</h3>
        </div>
        {codeContext && (
          <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
            <FileText className="w-3 h-3" />
            <span>{codeContext.filePath}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Ask Claude about your code, request explanations, or get help with debugging.</p>
          </div>
        )}

        {messages.map(message => (
          <MessageComponent
            key={message.id}
            message={message}
            onCodeInsert={handleCodeInsert}
            onActionClick={handleActionClick}
          />
        ))}

        {isLoading && (
          <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Claude is thinking...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex space-x-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Claude about your code..."
            className="flex-1 resize-none border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface MessageComponentProps {
  message: Message
  onCodeInsert: (code: string, language: string) => void
  onActionClick: (action: string, target: string) => void
}

function MessageComponent({ message, onCodeInsert, onActionClick }: MessageComponentProps) {
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
        <div className="flex items-center space-x-2 mb-1">
          {message.role === 'user' ? (
            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <Bot className="w-4 h-4 text-green-600 dark:text-green-400" />
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        
        <div className={`p-3 rounded-lg ${
          message.role === 'user'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
        }`}>
          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
          
          {/* Code blocks */}
          {message.codeBlocks && message.codeBlocks.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.codeBlocks.map((block, index) => (
                <div key={index} className="bg-gray-900 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
                    <span className="text-xs text-gray-300">{block.language}</span>
                    <button
                      onClick={() => onCodeInsert(block.code, block.language)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Insert Code
                    </button>
                  </div>
                  <pre className="p-3 text-sm text-gray-100 overflow-x-auto">
                    <code>{block.code}</code>
                  </pre>
                  {block.explanation && (
                    <div className="p-2 text-xs text-gray-400 border-t border-gray-700">
                      {block.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Action buttons */}
          {message.actions && message.actions.length > 0 && (
            <div className="mt-3 space-y-1">
              {message.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => onActionClick(action.type, action.target)}
                  className="flex items-center space-x-2 w-full p-2 text-left text-xs bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800 transition-colors"
                >
                  <Code className="w-3 h-3" />
                  <span>{action.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}