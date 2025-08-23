'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Send, 
  Bot, 
  User, 
  Settings, 
  Zap, 
  Brain, 
  DollarSign, 
  Clock,
  Tools,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  AI_PROVIDERS, 
  getModelInfo, 
  getProviderForModel, 
  getRecommendedModel,
  estimateCost,
  MODEL_REGISTRY,
  type SupportedModel 
} from '@/lib/ai-providers'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  model?: string
  tokens?: number
  cost?: number
}

interface EnhancedAIChatProps {
  workspaceId: string
  contextFiles: string[]
  onModelChange?: (model: string) => void
  className?: string
}

export function EnhancedAIChatInterface({ 
  workspaceId, 
  contextFiles, 
  onModelChange,
  className 
}: EnhancedAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4-turbo')
  const [enableTools, setEnableTools] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [totalCost, setTotalCost] = useState(0)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Get current model info
  const currentModel = getModelInfo(selectedModel)
  const currentProvider = getProviderForModel(selectedModel)

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    onModelChange?.(model)
  }

  const handleQuickSelect = (task: 'coding' | 'reasoning' | 'speed' | 'cost') => {
    const recommendedModel = getRecommendedModel(task)
    handleModelChange(recommendedModel)
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai/chat/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          model: selectedModel,
          context: {
            workspaceId,
            files: contextFiles,
            previousMessages: messages.slice(-6)
          },
          enableTools
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        model: selectedModel
      }

      setMessages(prev => [...prev, assistantMessage])

      if (reader) {
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
                  assistantContent += data.content
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: assistantContent }
                      : msg
                  ))
                }
                if (data.done) {
                  // Calculate cost estimate
                  const inputTokens = Math.ceil(input.length / 4)
                  const outputTokens = Math.ceil(assistantContent.length / 4)
                  const cost = estimateCost(selectedModel, inputTokens, outputTokens)
                  
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, tokens: inputTokens + outputTokens, cost }
                      : msg
                  ))
                  
                  setTotalCost(prev => prev + cost)
                }
              } catch (e) {
                // Ignore parsing errors for streaming chunks
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        model: selectedModel
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className={cn("flex flex-col h-full max-w-4xl mx-auto", className)}>
      {/* Header with Model Selection */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Enhanced AI Assistant</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Model Selection */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Model:</label>
              <Select value={selectedModel} onValueChange={handleModelChange}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AI_PROVIDERS).map(provider => (
                    <div key={provider.id}>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500">
                        {provider.name}
                      </div>
                      {provider.models.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center gap-2">
                            <span>{model.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              ${model.costPer1kTokens.input}k
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Selection */}
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('coding')}
                className="text-xs"
              >
                <Zap className="h-3 w-3 mr-1" />
                Coding
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('reasoning')}
                className="text-xs"
              >
                <Brain className="h-3 w-3 mr-1" />
                Reasoning
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('speed')}
                className="text-xs"
              >
                <Clock className="h-3 w-3 mr-1" />
                Speed
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('cost')}
                className="text-xs"
              >
                <DollarSign className="h-3 w-3 mr-1" />
                Cost
              </Button>
            </div>
          </div>

          {/* Model Info */}
          {currentModel && currentProvider && (
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>
                <strong>{currentProvider.name}</strong> - {currentModel.description}
              </span>
              <Badge variant="outline">
                {currentModel.contextWindow.toLocaleString()} tokens
              </Badge>
              {totalCost > 0 && (
                <Badge variant="secondary">
                  Session cost: ${totalCost.toFixed(4)}
                </Badge>
              )}
            </div>
          )}
        </CardHeader>

        {/* Settings Panel */}
        {showSettings && (
          <CardContent className="pt-0 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tools className="h-4 w-4" />
                <label className="text-sm font-medium">Enable AI Tools</label>
              </div>
              <Switch checked={enableTools} onCheckedChange={setEnableTools} />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tools allow the AI to search code, analyze projects, and generate specific code snippets.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-50 rounded-lg">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">AI Assistant Ready</h3>
            <p className="text-sm">
              Ask me about your code, request new features, or get help with debugging.
              I have access to your workspace context and can use tools to help you.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3 max-w-3xl",
              message.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0",
              message.role === 'user' ? 'bg-blue-500' : 'bg-green-500'
            )}>
              {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            
            <div className={cn(
              "rounded-lg px-4 py-2 max-w-full",
              message.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-white border shadow-sm'
            )}>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
              </div>
              
              {/* Message metadata */}
              <div className={cn(
                "flex items-center gap-2 mt-2 text-xs",
                message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
              )}>
                <span>{message.timestamp.toLocaleTimeString()}</span>
                {message.model && (
                  <>
                    <span>•</span>
                    <span>{getModelInfo(message.model)?.name}</span>
                  </>
                )}
                {message.tokens && (
                  <>
                    <span>•</span>
                    <span>{message.tokens} tokens</span>
                  </>
                )}
                {message.cost && (
                  <>
                    <span>•</span>
                    <span>${message.cost.toFixed(4)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-3 max-w-3xl mr-auto">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-white border rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                <span className="text-sm text-gray-500">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me about your code, request new features, or get help with debugging..."
          className="flex-1 min-h-[50px] max-h-32 resize-none"
          disabled={isLoading}
        />
        <Button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          size="lg"
          className="px-4"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Context Info */}
      {contextFiles.length > 0 && (
        <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
          <Search className="h-3 w-3" />
          <span>Context: {contextFiles.length} files in workspace</span>
          {enableTools && <Badge variant="outline" className="text-xs">Tools enabled</Badge>}
        </div>
      )}
    </div>
  )
}