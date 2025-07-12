// AI Chat Interface - Core user interaction component
// Inspired by Claude, ChatGPT, and Lovable.dev interfaces

import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Upload, Code, Settings, Sparkles, MessageSquare, Wand2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import PromptTemplates from './PromptTemplates'
import PromptEnhancer from './PromptEnhancer'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    model?: string
    context?: string[]
    tokens?: number
    responseTime?: number
  }
}

interface AIChatInterfaceProps {
  workspaceId?: string
  initialContext?: string[]
  onFileUpload?: (files: FileList) => void
  className?: string
}

export default function AIChatInterface({
  workspaceId = 'default',
  initialContext = [],
  onFileUpload,
  className = ''
}: AIChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-3-sonnet')
  const [contextFiles, setContextFiles] = useState<string[]>(initialContext)
  const [showSettings, setShowSettings] = useState(false)
  const [showPromptTemplates, setShowPromptTemplates] = useState(false)
  const [showPromptEnhancer, setShowPromptEnhancer] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Available AI models from OpenRouter
  const availableModels = [
    { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', icon: '🧠' },
    { id: 'openai/gpt-4', name: 'GPT-4', provider: 'OpenAI', icon: '⚡' },
    { id: 'meta-llama/llama-3-70b', name: 'Llama 3 70B', provider: 'Meta', icon: '🦙' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', icon: '💨' },
    { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', icon: '🚀' },
  ]

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load conversation history on mount
  useEffect(() => {
    loadConversationHistory()
  }, [workspaceId])

  const loadConversationHistory = async () => {
    try {
      const response = await fetch(`/api/ai/conversations/${workspaceId}`)
      if (response.ok) {
        const history = await response.json()
        setMessages(history.messages || [])
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isStreaming) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)

    try {
      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        metadata: { model: selectedModel }
      }

      setMessages(prev => [...prev, assistantMessage])

      // Stream response from AI
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          model: selectedModel,
          context: {
            workspaceId,
            files: contextFiles,
            previousMessages: messages.slice(-10) // Last 10 messages for context
          }
        })
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                accumulatedContent += data.content
                
                // Update the assistant message with streaming content
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ))
              }
            } catch (e) {
              // Ignore parsing errors for streaming chunks
            }
          }
        }
      }

      // Save conversation
      await saveConversation([...messages, userMessage, { ...assistantMessage, content: accumulatedContent }])

    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, content: 'Sorry, I encountered an error. Please try again.' }
          : msg
      ))
    } finally {
      setIsStreaming(false)
    }
  }

  const saveConversation = async (messagesToSave: Message[]) => {
    try {
      await fetch(`/api/ai/conversations/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesToSave })
      })
    } catch (error) {
      console.error('Failed to save conversation:', error)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && onFileUpload) {
      onFileUpload(files)
      // Add uploaded files to context
      const fileNames = Array.from(files).map(f => f.name)
      setContextFiles(prev => [...prev, ...fileNames])
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const handlePromptTemplate = (prompt: string) => {
    setInput(prompt)
    setShowPromptTemplates(false)
    // Focus the textarea after selecting template
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const handleEnhancedPrompt = (prompt: string) => {
    setInput(prompt)
    setShowPromptEnhancer(false)
    // Focus the textarea after enhancement
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const currentModel = availableModels.find(m => m.id === selectedModel)

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Assistant
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentModel?.icon} {currentModel?.name} • Ready to help
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {contextFiles.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {contextFiles.length} files in context
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPromptTemplates(!showPromptTemplates)}
              title="Prompt Templates"
            >
              <FileText className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPromptEnhancer(!showPromptEnhancer)}
              title="Enhance Prompt"
            >
              <Wand2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Model selector (when settings open) */}
        {showSettings && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <label className="block text-sm font-medium mb-2">AI Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
            >
              {availableModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.icon} {model.name} ({model.provider})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Prompt Templates Panel */}
        {showPromptTemplates && (
          <div className="mt-4 max-h-96 overflow-y-auto">
            <PromptTemplates 
              onSelectTemplate={handlePromptTemplate}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
            />
          </div>
        )}

        {/* Prompt Enhancer Panel */}
        {showPromptEnhancer && input.trim() && (
          <div className="mt-4 max-h-96 overflow-y-auto">
            <PromptEnhancer 
              originalPrompt={input}
              onEnhancedPrompt={handleEnhancedPrompt}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
            />
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg inline-block">
                <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 dark:text-gray-400">
                  Start a conversation with your AI assistant
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Ask questions, upload files, or request code help
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex space-x-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'assistant' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              )}
              
              <div className={`max-w-[80%] ${message.type === 'user' ? 'order-1' : ''}`}>
                <Card className={`${
                  message.type === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-50 dark:bg-gray-800'
                }`}>
                  <CardContent className="p-3">
                    <div className="whitespace-pre-wrap text-sm">
                      {message.content}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                      <span>{formatTimestamp(message.timestamp)}</span>
                      {message.metadata?.model && (
                        <span>{currentModel?.icon}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {message.type === 'user' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {isStreaming && (
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <span className="text-sm">AI is thinking...</span>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask anything... (Shift+Enter for new line)"
              className="min-h-[40px] max-h-[120px] resize-none"
              disabled={isStreaming}
            />
          </div>
          
          <div className="flex space-x-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".txt,.md,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.html,.css,.json,.xml,.yml,.yaml"
            />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
            >
              <Upload className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isStreaming}
              size="sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {contextFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {contextFiles.slice(0, 3).map((file, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                <Code className="w-3 h-3 mr-1" />
                {file}
              </Badge>
            ))}
            {contextFiles.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{contextFiles.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}