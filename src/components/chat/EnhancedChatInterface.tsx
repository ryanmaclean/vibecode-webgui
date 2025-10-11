import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Upload, Code, Settings, Sparkles, MessageSquare, Wand2, FileText, Image, Search, Zap, Link } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'

interface Message {
  id: string
  from: 'user' | 'assistant'
  content: string
  createdAt: Date
  files?: AttachmentFile[]
  metadata?: {
    model?: string
    context?: string[]
    tokens?: number
    responseTime?: number
    ragSources?: string[]
    webSearchResults?: WebSearchResult[]
  }
}

interface AttachmentFile {
  id: string
  name: string
  type: 'file' | 'image' | 'document'
  size: number
  ragIndexed?: boolean
}

interface WebSearchResult {
  title: string
  url: string
  snippet: string
  relevance: number
}

interface EnhancedChatInterfaceProps {
  conversationId?: string
  workspaceId?: string
  initialContext?: string[]
  onFileUpload?: (files: FileList) => void
  className?: string
}

export const EnhancedChatInterface = ({
  conversationId,
  workspaceId = 'default',
  initialContext = [],
  onFileUpload,
  className = ''
}: EnhancedChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-3.5-sonnet')
  const [contextFiles, setContextFiles] = useState<string[]>(initialContext)
  const [showSettings, setShowSettings] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [enableWebSearch, setEnableWebSearch] = useState(false)
  const [enableRAG, setEnableRAG] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Available AI models from OpenRouter
  const availableModels = [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', context: '200K' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', context: '200K' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', context: '128K' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', context: '128K' },
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'Meta', context: '128K' },
    { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'Google', context: '2M' }
  ]

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (conversationId) {
      loadConversation()
    }
  }, [conversationId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadConversation = async () => {
    try {
      const response = await fetch('/api/chat/mongodb-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': 'enhanced-chat-user',
          'x-test-user-role': 'developer'
        },
        body: JSON.stringify({
          action: 'get_conversation',
          conversationId
        })
      })

      const data = await response.json()
      if (data.success && data.conversation) {
        setMessages(data.conversation.messages.map((msg: any) => ({
          ...msg,
          createdAt: new Date(msg.createdAt)
        })))
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setAttachedFiles(prev => [...prev, ...files])
    
    if (onFileUpload && event.target.files) {
      onFileUpload(event.target.files)
    }
  }

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const sendMessage = async () => {
    if (!input.trim() && attachedFiles.length === 0) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      from: 'user',
      content: input,
      createdAt: new Date(),
      files: attachedFiles.map(file => ({
        id: `file-${Date.now()}-${file.name}`,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        size: file.size
      }))
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setAttachedFiles([])
    setIsStreaming(true)

    try {
      // First, upload any attached files
      if (attachedFiles.length > 0) {
        const formData = new FormData()
        attachedFiles.forEach(file => formData.append('files', file))
        formData.append('workspaceId', workspaceId)

        await fetch('/api/ai/upload', {
          method: 'POST',
          headers: {
            'x-test-user-id': 'enhanced-chat-user',
            'x-test-user-role': 'developer'
          },
          body: formData
        })
      }

      // Save user message to MongoDB
      if (conversationId) {
        await fetch('/api/chat/mongodb-simple', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-user-id': 'enhanced-chat-user',
            'x-test-user-role': 'developer'
          },
          body: JSON.stringify({
            action: 'add_message',
            conversationId,
            content: input,
            from: 'user'
          })
        })
      }

      // Stream AI response
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': 'enhanced-chat-user',
          'x-test-user-role': 'developer'
        },
        body: JSON.stringify({
          conversationId: conversationId || `conv-${Date.now()}`,
          message: input,
          model: selectedModel,
          workspaceId,
          files: attachedFiles.map(file => file.name),
          enableWebSearch,
          enableRAG
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        from: 'assistant',
        content: '',
        createdAt: new Date(),
        metadata: {
          model: selectedModel,
          ragSources: [],
          webSearchResults: []
        }
      }

      setMessages(prev => [...prev, assistantMessage])

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter(line => line.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              try {
                const parsed = JSON.parse(data)
                
                if (parsed.type === 'content') {
                  setMessages(prev => prev.map((msg, index) => 
                    index === prev.length - 1 
                      ? { ...msg, content: msg.content + parsed.content }
                      : msg
                  ))
                } else if (parsed.type === 'metadata') {
                  setMessages(prev => prev.map((msg, index) => 
                    index === prev.length - 1 
                      ? { 
                          ...msg, 
                          metadata: { 
                            ...msg.metadata, 
                            ...parsed.metadata 
                          }
                        }
                      : msg
                  ))
                }
              } catch (e) {
                // Skip invalid JSON
                continue
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        from: 'assistant',
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
        createdAt: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <TooltipProvider>
      <Card className={`flex flex-col h-full ${className}`}>
        {/* Header */}
        <CardContent className="flex-none p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <span className="font-semibold">Enhanced AI Chat</span>
              {conversationId && (
                <Badge variant="outline" className="text-xs">
                  {conversationId.slice(-8)}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span>{model.name}</span>
                        <span className="text-xs text-gray-500">
                          {model.provider} • {model.context}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Link className="w-4 h-4" />
                  <span className="text-sm">Web Search</span>
                </div>
                <Button
                  variant={enableWebSearch ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnableWebSearch(!enableWebSearch)}
                >
                  {enableWebSearch ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm">RAG Context</span>
                </div>
                <Button
                  variant={enableRAG ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnableRAG(!enableRAG)}
                >
                  {enableRAG ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        {/* Messages Area */}
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${message.from === 'user' ? 'order-2' : 'order-1'}`}>
                    <div className={`flex items-start space-x-3 ${message.from === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      {/* Avatar */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        message.from === 'user' ? 'bg-blue-500' : 'bg-purple-500'
                      }`}>
                        {message.from === 'user' ? (
                          <User className="w-4 h-4 text-white" />
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>

                      {/* Message Content */}
                      <div className={`flex-1 ${message.from === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block p-3 rounded-lg ${
                          message.from === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <div className="whitespace-pre-wrap">{message.content}</div>
                          
                          {/* File attachments */}
                          {message.files && message.files.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {message.files.map((file) => (
                                <div key={file.id} className="flex items-center space-x-2 p-2 bg-black/10 rounded">
                                  {file.type === 'image' ? (
                                    <Image className="w-4 h-4" />
                                  ) : (
                                    <FileText className="w-4 h-4" />
                                  )}
                                  <span className="text-sm">{file.name}</span>
                                  <span className="text-xs opacity-70">
                                    {formatFileSize(file.size)}
                                  </span>
                                  {file.ragIndexed && (
                                    <Badge variant="secondary" className="text-xs">
                                      RAG Indexed
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Metadata */}
                          {message.metadata && (
                            <div className="mt-2 text-xs opacity-70">
                              <div className="flex items-center space-x-4">
                                {message.metadata.model && (
                                  <span>{message.metadata.model}</span>
                                )}
                                {message.metadata.responseTime && (
                                  <span>{message.metadata.responseTime}ms</span>
                                )}
                                {message.metadata.tokens && (
                                  <span>{message.metadata.tokens} tokens</span>
                                )}
                              </div>
                              {message.metadata.ragSources && message.metadata.ragSources.length > 0 && (
                                <div className="mt-1">
                                  <span>Sources: {message.metadata.ragSources.join(', ')}</span>
                                </div>
                              )}
                              {message.metadata.webSearchResults && message.metadata.webSearchResults.length > 0 && (
                                <div className="mt-1">
                                  <span>Web: {message.metadata.webSearchResults.length} results</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-1 text-xs text-gray-500">
                          {message.createdAt.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isStreaming && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="inline-block p-3 rounded-lg bg-gray-100 text-gray-900">
                        <div className="flex items-center space-x-2">
                          <Sparkles className="w-4 h-4 animate-pulse" />
                          <span>Thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </CardContent>

        {/* Input Area */}
        <CardContent className="flex-none p-4 border-t">
          {/* File attachments preview */}
          {attachedFiles.length > 0 && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium mb-2">Attached Files:</div>
              <div className="space-y-2">
                {attachedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex items-center space-x-2">
                      {file.type.startsWith('image/') ? (
                        <Image className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachedFile(index)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything or attach files..."
                className="min-h-[60px] resize-none"
                disabled={isStreaming}
              />
            </div>
            
            <div className="flex space-x-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.h,.css,.html,.json,.yaml,.yml,.xml,.sql,.sh,.bat,.ps1"
                onChange={handleFileUpload}
                className="hidden"
              />
              
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> fix/consolidated-dependency-updates
              <Tooltip content="Attach files">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
              </Tooltip>

              <Tooltip content="Send message">
                <Button
                  variant="default"
                  size="sm"
                  onClick={sendMessage}
                  disabled={isStreaming || (!input.trim() && attachedFiles.length === 0)}
                >
                  <Send className="w-4 h-4" />
<<<<<<< HEAD
                </Button>
              </Tooltip>
=======
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                title="Attach files"
              >
                <Link className="w-4 h-4" />
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={sendMessage}
                disabled={isStreaming || (!input.trim() && attachedFiles.length === 0)}
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
>>>>>>> ai-sdk-openai-v2-test
=======
                </Button>              </Tooltip>
>>>>>>> fix/consolidated-dependency-updates
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

export default EnhancedChatInterface