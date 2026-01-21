import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Upload, Settings, Sparkles, MessageSquare, FileText, Image, Paperclip, Globe, Zap, Terminal, Code, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HfInference } from '@huggingface/inference'
// import { logger } from '@/lib/logger';
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
    huggingFaceModel?: string
    confidence?: number
    functionCalls?: FunctionCallResult[]
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

interface FunctionCallResult {
  name: string
  arguments: Record<string, any>
  result: any
  success: boolean
  error?: string
}

interface HuggingFaceChatInterfaceProps {
  conversationId?: string
  workspaceId?: string
  initialContext?: string[]
  onFileUpload?: (files: FileList) => void
  onInputChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onInputBlur?: () => void
  className?: string
}

export const HuggingFaceChatInterface = ({
  conversationId,
  workspaceId = 'default',
  initialContext = [],
  onFileUpload,
  onInputChange,
  onInputBlur,
  className = ''
}: HuggingFaceChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-3.5-sonnet')
  const [huggingFaceModel, setHuggingFaceModel] = useState('microsoft/DialoGPT-medium')
  const [useHuggingFace, setUseHuggingFace] = useState(false)
  const [contextFiles, setContextFiles] = useState<string[]>(initialContext)
  const [showSettings, setShowSettings] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [enableWebSearch, setEnableWebSearch] = useState(false)
  const [enableRAG, setEnableRAG] = useState(true)
  const [enableFunctionCalling, setEnableFunctionCalling] = useState(false)
  const [enableAutoModelSelection, setEnableAutoModelSelection] = useState(false)
  const [hfClient, setHfClient] = useState<HfInference | null>(null)
  const [lastModelSuggestion, setLastModelSuggestion] = useState<{
    suggested: string
    current: string
    reasoning: string
    confidence: number
  } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Available models from OpenRouter and Hugging Face
  const availableModels = [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', context: '200K', type: 'openrouter' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', context: '200K', type: 'openrouter' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', context: '128K', type: 'openrouter' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', context: '128K', type: 'openrouter' },
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'Meta', context: '128K', type: 'openrouter' },
    { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'Google', context: '2M', type: 'openrouter' }
  ]

  const huggingFaceModels = [
    { id: 'microsoft/DialoGPT-medium', name: 'DialoGPT Medium', provider: 'Microsoft', type: 'conversational' },
    { id: 'microsoft/DialoGPT-large', name: 'DialoGPT Large', provider: 'Microsoft', type: 'conversational' },
    { id: 'facebook/blenderbot-400M-distill', name: 'BlenderBot 400M', provider: 'Facebook', type: 'conversational' },
    { id: 'microsoft/GODEL-v1_1-large-seq2seq', name: 'GODEL Large', provider: 'Microsoft', type: 'conversational' },
    { id: 'google/flan-t5-large', name: 'FLAN-T5 Large', provider: 'Google', type: 'text-generation' },
    { id: 'bigscience/bloom-560m', name: 'BLOOM 560M', provider: 'BigScience', type: 'text-generation' }
  ]

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (conversationId) {
      loadConversation()
    }
  }, [conversationId])

  useEffect(() => {
    // Initialize Hugging Face client if API key is available
    const initHuggingFace = async () => {
      try {
        // We'll use the server-side API key for security
        const response = await fetch('/api/ai/huggingface-init', {
          headers: {
            'x-test-user-id': 'hf-chat-user',
            'x-test-user-role': 'developer'
          }
        })
        const data = await response.json()
        if (data.initialized) {
          // Client will use server-side proxy for HF calls
          setHfClient({ initialized: true } as any)
        }
      } catch (error) {
        console.error('Failed to initialize Hugging Face client:', error)
      }
    }
    
    initHuggingFace()
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadConversation = async () => {
    try {
      const response = await fetch('/api/chat/mongodb-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': 'hf-chat-user',
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

  const sendMessageToHuggingFace = async (prompt: string): Promise<string> => {
    try {
      const response = await fetch('/api/ai/huggingface-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': 'hf-chat-user',
          'x-test-user-role': 'developer'
        },
        body: JSON.stringify({
          model: huggingFaceModel,
          input: prompt,
          context: messages.slice(-5).map(m => ({ role: m.from, content: m.content }))
        })
      })

      const data = await response.json()
      if (data.success) {
        return data.response
      } else {
        throw new Error(data.error || 'HuggingFace API error')
      }
    } catch (error) {
      console.error('HuggingFace API error:', error)
      throw error
    }
  }

  const getIntelligentModelSuggestion = async (prompt: string) => {
    if (!enableAutoModelSelection) return null

    try {
      const response = await fetch('/api/ai/model-selection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': 'hf-chat-user',
          'x-test-user-role': 'developer'
        },
        body: JSON.stringify({
          prompt,
          metadata: {
            hasImages: attachedFiles.some(f => f.type.startsWith('image/')),
            hasFiles: attachedFiles.length > 0,
            fileTypes: attachedFiles.map(f => f.type),
            conversationHistory: messages.length,
            urgency: 'medium'
          },
          preferences: {
            allowHuggingFace: true,
            prioritizeQuality: true
          }
        })
      })

      const data = await response.json()
      if (data.success) {
        return {
          suggested: data.selection.selectedModel,
          current: useHuggingFace ? huggingFaceModel : selectedModel,
          reasoning: data.selection.reasoning,
          confidence: data.selection.confidence
        }
      }
    } catch (error) {
      console.error('Failed to get model suggestion:', error)
    }
    return null
  }

  const sendMessage = async () => {
    if (!input.trim() && attachedFiles.length === 0) return

    // Get intelligent model suggestion
    const suggestion = await getIntelligentModelSuggestion(input)
    if (suggestion && suggestion.suggested !== suggestion.current && suggestion.confidence > 0.7) {
      setLastModelSuggestion(suggestion)
    }

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
    const currentInput = input
    setInput('')
    setAttachedFiles([])
    setIsStreaming(true)

    try {
      // Upload files if any
      if (attachedFiles.length > 0) {
        const formData = new FormData()
        attachedFiles.forEach(file => formData.append('files', file))
        formData.append('workspaceId', workspaceId)

        await fetch('/api/ai/upload', {
          method: 'POST',
          headers: {
            'x-test-user-id': 'hf-chat-user',
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
            'x-test-user-id': 'hf-chat-user',
            'x-test-user-role': 'developer'
          },
          body: JSON.stringify({
            action: 'add_message',
            conversationId,
            content: currentInput,
            from: 'user'
          })
        })
      }

      let assistantResponse = ''
      let responseMetadata: any = {}

      if (useHuggingFace && hfClient) {
        // Use Hugging Face for response
        assistantResponse = await sendMessageToHuggingFace(currentInput)
        responseMetadata = {
          huggingFaceModel,
          model: 'Hugging Face',
          responseTime: Date.now()
        }
      } else {
        // Use OpenRouter API (existing flow)
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-user-id': 'hf-chat-user',
            'x-test-user-role': 'developer'
          },
          body: JSON.stringify({
            conversationId: conversationId || `conv-${Date.now()}`,
            message: currentInput,
            model: selectedModel,
            workspaceId,
            files: attachedFiles.map(file => file.name),
            enableWebSearch,
            enableRAG,
            enableFunctionCalling
          })
        })

        if (!response.ok) {
          throw new Error('Failed to get AI response')
        }

        // Handle streaming response
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (reader) {
          let streamedContent = ''
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
                    streamedContent += parsed.content
                  } else if (parsed.type === 'metadata') {
                    responseMetadata = { ...responseMetadata, ...parsed.metadata }
                  }
                } catch (e) {
                  continue
                }
              }
            }
          }
          assistantResponse = streamedContent
        }
      }

      // Create final assistant message
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        from: 'assistant',
        content: assistantResponse,
        createdAt: new Date(),
        metadata: responseMetadata
      }

      setMessages(prev => [...prev, assistantMessage])

      // Save assistant message to MongoDB
      if (conversationId) {
        await fetch('/api/chat/mongodb-simple', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-user-id': 'hf-chat-user',
            'x-test-user-role': 'developer'
          },
          body: JSON.stringify({
            action: 'add_message',
            conversationId,
            content: assistantResponse,
            from: 'assistant',
            metadata: responseMetadata
          })
        })
      }

    } catch (error) {
      console.error('Failed to send message:', error)
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
              <span className="font-semibold">Hugging Face AI Chat</span>
              {conversationId && (
                <Badge variant="outline" className="text-xs">
                  {conversationId.slice(-8)}
                </Badge>
              )}
              {useHuggingFace && (
                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                  🤗 HF
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Select value={useHuggingFace ? huggingFaceModel : selectedModel} 
                      onValueChange={(value) => {
                        if (huggingFaceModels.some(m => m.id === value)) {
                          setHuggingFaceModel(value)
                          setUseHuggingFace(true)
                        } else {
                          setSelectedModel(value)
                          setUseHuggingFace(false)
                        }
                      }}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500">OpenRouter Models</div>
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
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 border-t mt-1 pt-2">
                    🤗 Hugging Face Models
                  </div>
                  {huggingFaceModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span>🤗 {model.name}</span>
                        <span className="text-xs text-gray-500">
                          {model.provider} • {model.type}
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
                  <Globe className="w-4 h-4" />
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
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm">Use Hugging Face</span>
                </div>
                <Button
                  variant={useHuggingFace ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseHuggingFace(!useHuggingFace)}
                  disabled={!hfClient}
                >
                  {useHuggingFace ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4 h-4" />
                  <span className="text-sm">Function Calling</span>
                </div>
                <Button
                  variant={enableFunctionCalling ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnableFunctionCalling(!enableFunctionCalling)}
                >
                  {enableFunctionCalling ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm">Auto Model Selection</span>
                </div>
                <Button
                  variant={enableAutoModelSelection ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnableAutoModelSelection(!enableAutoModelSelection)}
                >
                  {enableAutoModelSelection ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        {/* Model Suggestion Banner */}
        {lastModelSuggestion && lastModelSuggestion.suggested !== lastModelSuggestion.current && (
          <CardContent className="flex-none p-3 border-b bg-amber-50 border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-amber-900">
                    Better Model Suggested
                  </div>
                  <div className="text-xs text-amber-700 mt-1">
                    {lastModelSuggestion.reasoning}
                  </div>
                </div>
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                  {Math.round(lastModelSuggestion.confidence * 100)}% confidence
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const suggestedModel = lastModelSuggestion.suggested
                    if (huggingFaceModels.some(m => m.id === suggestedModel)) {
                      setHuggingFaceModel(suggestedModel)
                      setUseHuggingFace(true)
                    } else {
                      setSelectedModel(suggestedModel)
                      setUseHuggingFace(false)
                    }
                    setLastModelSuggestion(null)
                  }}
                  className="text-amber-700 border-amber-300 hover:bg-amber-100"
                >
                  Switch to {[...availableModels, ...huggingFaceModels].find(m => m.id === lastModelSuggestion.suggested)?.name || lastModelSuggestion.suggested}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLastModelSuggestion(null)}
                  className="text-amber-600 hover:bg-amber-100"
                >
                  ×
                </Button>
              </div>
            </div>
          </CardContent>
        )}

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
                        message.from === 'user' ? 'bg-blue-500' : 
                        message.metadata?.huggingFaceModel ? 'bg-orange-500' : 'bg-purple-500'
                      }`}>
                        {message.from === 'user' ? (
                          <User className="w-4 h-4 text-white" />
                        ) : message.metadata?.huggingFaceModel ? (
                          <span className="text-white text-xs">🤗</span>
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>

                      {/* Message Content */}
                      <div className={`flex-1 ${message.from === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block p-3 rounded-lg ${
                          message.from === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : message.metadata?.huggingFaceModel 
                            ? 'bg-orange-50 text-gray-900 border border-orange-200'
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
                                {message.metadata.huggingFaceModel && (
                                  <span>🤗 {message.metadata.huggingFaceModel}</span>
                                )}
                                {message.metadata.model && !message.metadata.huggingFaceModel && (
                                  <span>{message.metadata.model}</span>
                                )}
                                {message.metadata.responseTime && (
                                  <span>{message.metadata.responseTime}ms</span>
                                )}
                                {message.metadata.tokens && (
                                  <span>{message.metadata.tokens} tokens</span>
                                )}
                              </div>
                              {message.metadata.functionCalls && message.metadata.functionCalls.length > 0 && (
                                <div className="mt-1">
                                  <span className="text-xs font-semibold">Functions: </span>
                                  {message.metadata.functionCalls.map((call, index) => (
                                    <span key={index} className={`text-xs inline-flex items-center mr-2 ${
                                      call.success ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      <Terminal className="w-3 h-3 mr-1" />
                                      {call.name}
                                      {call.success ? ' ✓' : ' ✗'}
                                    </span>
                                  ))}
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
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      useHuggingFace ? 'bg-orange-500' : 'bg-purple-500'
                    }`}>
                      {useHuggingFace ? (
                        <span className="text-white text-xs">🤗</span>
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="inline-block p-3 rounded-lg bg-gray-100 text-gray-900">
                        <div className="flex items-center space-x-2">
                          <Sparkles className="w-4 h-4 animate-pulse" />
                          <span>{useHuggingFace ? '🤗 Generating...' : 'Thinking...'}</span>
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
                onChange={(e) => {
                  setInput(e.target.value)
                  onInputChange?.(e)
                }}
                onBlur={onInputBlur}
                onKeyDown={handleKeyDown}
                placeholder={useHuggingFace ? "Chat with Hugging Face models..." : "Ask me anything or attach files..."}
                className="min-h-[60px] resize-none"
                disabled={isStreaming}
              />
            </div>
            
            <div className="flex space-x-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.h,.css,.html,.json,.yaml,.yml,.xml,.sql,.sh,.bat,.ps1,.png,.jpg,.jpeg,.gif,.bmp,.svg"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isStreaming}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Attach files</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={sendMessage}
                    disabled={isStreaming || (!input.trim() && attachedFiles.length === 0)}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Send message</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

export default HuggingFaceChatInterface