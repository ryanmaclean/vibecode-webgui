// AI Chat Interface - Core user interaction component
// Inspired by Claude, ChatGPT, and Lovable.dev interfaces

import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Upload, Code, Settings, Sparkles, MessageSquare, Wand2, FileText } from 'lucide-react'
import { Button, Textarea, Card, CardContent, Badge, ScrollArea } from '@/components/ui';
// import PromptTemplates from './PromptTemplates'
// import PromptEnhancer from './PromptEnhancer'

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

export const AIChatInterface = ({
  workspaceId = 'default',
  initialContext = [],
  onFileUpload,
  className = ''
}: AIChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-3-sonnet')
  const [contextFiles, setContextFiles] = useState<string[]>(initialContext)
  const [showSettings, setShowSettings] = useState(false)
  // const [showPromptTemplates, setShowPromptTemplates] = useState(false)
  // const [showPromptEnhancer, setShowPromptEnhancer] = useState(false)

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
          }
        })
      })

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      let accumulatedContent = ''

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        const chunk = decoder.decode(value, { stream: true })
        accumulatedContent += chunk

        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: accumulatedContent } 
            : msg
        ))
      }

      const finalMessages = [...messages, userMessage, { ...assistantMessage, content: accumulatedContent }]
      saveConversation(finalMessages)

    } catch (error) {
      console.error('Error streaming AI response:', error)
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        metadata: { model: 'system' }
      }
      setMessages(prev => [...prev.slice(0, -1), errorMessage])
    } finally {
      setIsStreaming(false)
    }
  }

  const saveConversation = async (messagesToSave: Message[]) => {
    try {
      await fetch(`/api/ai/conversations/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesToSave }),
      })
    } catch (error) {
      console.error('Failed to save conversation:', error)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const fileNames = Array.from(event.target.files).map(file => file.name)
      setContextFiles(prev => [...prev, ...fileNames])
      onFileUpload?.(event.target.files)
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  /*
  const handlePromptTemplate = (prompt: string) => {
    setInput(prompt)
    // setShowPromptTemplates(false)
    // Focus the textarea after applying a template
    setTimeout(() => textareaRef.current?.focus(), 100)
  }
  */

  /*
  const handleEnhancedPrompt = (prompt: string) => {
    setInput(prompt)
    // setShowPromptEnhancer(false)
    // Focus the textarea after enhancement
    setTimeout(() => textareaRef.current?.focus(), 100)
  }
  */

  const currentModel = availableModels.find(m => m.id === selectedModel)

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="w-6 h-6 text-blue-600" />
            <h2 className="font-semibold text-lg">AI Assistant</h2>
            <Badge variant="outline">{currentModel?.name}</Badge>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            {/* <Button
              variant="ghost"
              size="sm"
              onClick={() => {}}
              title="Prompt Templates"
            >
              <FileText className="w-4 h-4" />
            </Button> */}
            {/* <Button
              variant="ghost"
              size="sm"
              onClick={() => {}}
              title="Enhance Prompt"
            >
              <Wand2 className="w-4 h-4" />
            </Button> */}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <label htmlFor="model-select" className="block text-sm font-medium mb-2">Select AI Model:</label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full p-2 border rounded-md bg-white dark:bg-gray-900"
          >
            {availableModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.icon} {model.name} ({model.provider})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Panels for Templates and Enhancer */}
      <div className="relative">
        {/* {showPromptTemplates && (
          <div className="mt-4 max-h-96 overflow-y-auto">
            <PromptTemplates
              onSelectTemplate={handlePromptTemplate}
              onClose={() => setShowPromptTemplates(false)}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg"
            />
          </div>
        )} */}
        {/* {showPromptEnhancer && input.trim() && (
          <div className="mt-4 max-h-96 overflow-y-auto">
            <PromptEnhancer
              originalPrompt={input}
              onEnhancedPrompt={handleEnhancedPrompt}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
            />
          </div>
        )} */}
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 p-4" data-testid="chat-messages">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={message.id} className={`flex items-start gap-3 ${message.type === 'user' ? 'justify-end' : ''}`}>
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
              data-testid="file-upload-input"
            />

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              aria-label="Upload files"
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
