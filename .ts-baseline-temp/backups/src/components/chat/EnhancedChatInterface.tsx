import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Settings, Sparkles, MessageSquare, FileText, Image as ImageIcon, Paperclip, Globe, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { createSSEDecoder } from '@/lib/ai/utils/sse-decoder'

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
  error?: boolean
  retryable?: boolean
}

type AssistantMessage = Message & { from: 'assistant' }

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

interface ConversationApiMessage extends Omit<Message, 'createdAt'> {
  createdAt: string
}

interface ConversationApiResponse {
  success: boolean
  conversation?: {
    messages: ConversationApiMessage[]
  }
}

const isAssistantMessage = (message: Message): message is AssistantMessage => message.from === 'assistant'

const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', context: '200K' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', context: '200K' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', context: '128K' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', context: '128K' },
  { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'Meta', context: '128K' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'Google', context: '2M' }
] as const

const STREAM_FLUSH_THRESHOLD = 8192
const STREAM_FLUSH_INTERVAL_MS = 48
const REDUCED_MOTION_STREAM_FLUSH_INTERVAL_MS = 600
const REDUCED_MOTION_STREAM_FLUSH_THRESHOLD = STREAM_FLUSH_THRESHOLD * 4
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 1000

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
  const [showJumpButton, setShowJumpButton] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const initialScrollBehaviorRef = useRef<string | null>(null)
  const autoScrollRef = useRef(true)
  const prefersReducedMotionRef = useRef(false)
  const contentBufferRef = useRef<{ chunks: string[]; size: number }>({ chunks: [], size: 0 })
  const flushTimeoutRef = useRef<number | null>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const lastAnnouncedAssistantMessageIdRef = useRef<string | null>(null)
  const errorAnnouncementRef = useRef<HTMLDivElement>(null)
  const retryTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    setContextFiles([...initialContext])
  }, [initialContext])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = (event?: MediaQueryListEvent) => {
      const matches = event ? event.matches : mediaQuery.matches
      prefersReducedMotionRef.current = matches
      setPrefersReducedMotion(matches)
    }

    updatePreference()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference)
      return () => mediaQuery.removeEventListener('change', updatePreference)
    }

    mediaQuery.addListener(updatePreference)
    return () => mediaQuery.removeListener(updatePreference)
  }, [])

  useEffect(() => {
    return () => {
      if (streamAbortRef.current) {
        streamAbortRef.current.abort()
        streamAbortRef.current = null
      }

      if (flushTimeoutRef.current !== null) {
        clearTimeout(flushTimeoutRef.current)
        flushTimeoutRef.current = null
      }

      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const root = scrollAreaRef.current
    if (!root) return

    const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null
    if (!viewport) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight)
      const isPinnedToBottom = distanceFromBottom < 48
      autoScrollRef.current = isPinnedToBottom
      setShowJumpButton(prev => (prev === !isPinnedToBottom ? prev : !isPinnedToBottom))
    }

    viewport.addEventListener('scroll', handleScroll)
    handleScroll()

    return () => {
      viewport.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    const root = scrollAreaRef.current
    if (!root) return

    const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null
    if (!viewport) return

    if (initialScrollBehaviorRef.current === null) {
      initialScrollBehaviorRef.current = viewport.style.scrollBehavior || ''
    }

    if (prefersReducedMotion) {
      viewport.dataset.prefersReducedMotion = 'true'
      viewport.style.scrollBehavior = 'auto'
    } else {
      delete viewport.dataset.prefersReducedMotion
      viewport.style.scrollBehavior = initialScrollBehaviorRef.current ?? ''
    }

    return () => {
      viewport.style.scrollBehavior = initialScrollBehaviorRef.current ?? ''
      delete viewport.dataset.prefersReducedMotion
    }
  }, [prefersReducedMotion])

  const maybeScrollToBottom = useCallback(() => {
    if (!autoScrollRef.current) return

    if (prefersReducedMotionRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      setShowJumpButton(false)
      return
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowJumpButton(false)
  }, [setShowJumpButton])

  useEffect(() => {
    maybeScrollToBottom()
  }, [messages, maybeScrollToBottom])

  useEffect(() => {
    const lastMessage = messages.at(-1)
    if (!lastMessage || !isAssistantMessage(lastMessage)) {
      return
    }

    if (!lastMessage.content.trim()) {
      return
    }

    if (lastAnnouncedAssistantMessageIdRef.current === lastMessage.id) {
      return
    }

    lastAnnouncedAssistantMessageIdRef.current = lastMessage.id

    const liveRegion = liveRegionRef.current
    if (liveRegion) {
      liveRegion.textContent = prefersReducedMotionRef.current
        ? 'New assistant message available. Auto-scroll paused. Activate Jump to latest to review.'
        : 'New assistant message available.'
    }
  }, [messages])

  const announceError = useCallback((errorMessage: string) => {
    if (errorAnnouncementRef.current) {
      errorAnnouncementRef.current.textContent = `Error: ${errorMessage}`
    }
  }, [])

  const loadConversation = useCallback(async () => {
    if (!conversationId) return

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

      if (!response.ok) {
        throw new Error('Failed to load conversation')
      }

      const data: ConversationApiResponse = await response.json()
      if (data.success && data.conversation?.messages) {
        setMessages(
          data.conversation.messages.map<Message>((msg) => ({
            ...msg,
            createdAt: new Date(msg.createdAt)
          }))
        )
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
      announceError('Failed to load conversation history')
    }
  }, [conversationId, announceError])

  useEffect(() => {
    if (conversationId) {
      void loadConversation()
    }
  }, [conversationId, loadConversation])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    setAttachedFiles(prev => [...prev, ...files])
    setContextFiles(prev => {
      const next = new Set(prev)
      files.forEach(file => next.add(file.name))
      return Array.from(next)
    })

    if (onFileUpload && event.target.files) {
      onFileUpload(event.target.files)
    }
  }

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const updateLastAssistantMessage = useCallback((updater: (message: AssistantMessage) => AssistantMessage) => {
    setMessages(prev => {
      const lastMessage = prev.at(-1)
      if (!lastMessage || !isAssistantMessage(lastMessage)) {
        return prev
      }

      const nextMessages = prev.slice()
      nextMessages[nextMessages.length - 1] = updater(lastMessage)
      return nextMessages
    })
  }, [])

  const clearFlushTimer = useCallback(() => {
    if (flushTimeoutRef.current !== null) {
      clearTimeout(flushTimeoutRef.current)
      flushTimeoutRef.current = null
    }
  }, [])

  const flushContentBuffer = useCallback((force = false) => {
    const buffer = contentBufferRef.current
    if (!buffer.size) {
      if (force) {
        clearFlushTimer()
      }
      return
    }

    const threshold = prefersReducedMotionRef.current
      ? REDUCED_MOTION_STREAM_FLUSH_THRESHOLD
      : STREAM_FLUSH_THRESHOLD

    if (!force && buffer.size < threshold) {
      return
    }

    const joined = buffer.chunks.join('')
    buffer.chunks = []
    buffer.size = 0

    clearFlushTimer()

    if (!joined) return

    updateLastAssistantMessage(message => ({
      ...message,
      content: `${message.content}${joined}`
    }))
  }, [clearFlushTimer, updateLastAssistantMessage])

  const scheduleContentFlush = useCallback(() => {
    const threshold = prefersReducedMotionRef.current
      ? REDUCED_MOTION_STREAM_FLUSH_THRESHOLD
      : STREAM_FLUSH_THRESHOLD

    if (contentBufferRef.current.size >= threshold) {
      flushContentBuffer(true)
      return
    }

    if (typeof window === 'undefined') {
      flushContentBuffer(true)
      return
    }

    if (flushTimeoutRef.current !== null) return

    const delay = prefersReducedMotionRef.current
      ? REDUCED_MOTION_STREAM_FLUSH_INTERVAL_MS
      : STREAM_FLUSH_INTERVAL_MS

    flushTimeoutRef.current = window.setTimeout(() => {
      flushTimeoutRef.current = null
      flushContentBuffer(true)
    }, delay)
  }, [flushContentBuffer])

  const retryMessage = useCallback(async (messageContent: string, attempt: number = 0) => {
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      setStreamError('Maximum retry attempts reached. Please try again later.')
      announceError('Maximum retry attempts reached')
      return false
    }

    setRetryCount(attempt + 1)

    if (attempt > 0) {
      // Wait before retrying
      await new Promise(resolve => {
        retryTimeoutRef.current = window.setTimeout(resolve, RETRY_DELAY_MS * attempt)
      })
    }

    return true
  }, [announceError])

  const sendMessage = async (retryAttempt: number = 0) => {
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

    if (retryAttempt === 0) {
      setMessages(prev => [...prev, userMessage])
      setInput('')
      setAttachedFiles([])
    }

    setIsStreaming(true)
    setShowJumpButton(false)
    setStreamError(null)
    contentBufferRef.current = { chunks: [], size: 0 }

    if (streamAbortRef.current) {
      streamAbortRef.current.abort()
      streamAbortRef.current = null
      clearFlushTimer()
    }

    const abortController = new AbortController()
    streamAbortRef.current = abortController

    try {
      // First, upload any attached files
      if (attachedFiles.length > 0 && retryAttempt === 0) {
        const formData = new FormData()
        attachedFiles.forEach(file => formData.append('files', file))
        formData.append('workspaceId', workspaceId)

        await fetch('/api/ai/upload', {
          method: 'POST',
          headers: {
            'x-test-user-id': 'enhanced-chat-user',
            'x-test-user-role': 'developer'
          },
          body: formData,
          signal: abortController.signal
        })
      }

      // Save user message to MongoDB
      if (conversationId && retryAttempt === 0) {
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
          }),
          signal: abortController.signal
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
        }),
        signal: abortController.signal
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`API error (${response.status}): ${errorText}`)
      }

      const assistantMessage: AssistantMessage = {
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

      if (retryAttempt === 0) {
        setMessages(prev => [...prev, assistantMessage])
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        const sseDecoder = createSSEDecoder(
          {
            onContentChunk: chunk => {
              const buffer = contentBufferRef.current
              buffer.chunks.push(chunk.content)
              buffer.size += chunk.content.length
              scheduleContentFlush()
            },
            onMetadataChunk: chunk => {
              flushContentBuffer(true)
              updateLastAssistantMessage(message => ({
                ...message,
                metadata: {
                  ...(message.metadata ?? {}),
                  ...(chunk.metadata as Partial<NonNullable<AssistantMessage['metadata']>>)
                }
              }))
            },
            onErrorChunk: chunk => {
              console.error('Stream error chunk:', chunk)
              setStreamError(chunk.error)
              announceError(chunk.error)
            },
            onMalformedChunk: (error, rawPayload) => {
              console.warn('Failed to parse stream chunk', error, rawPayload)
            },
            onConnectionTimeout: () => {
              console.error('Stream connection timeout')
              setStreamError('Connection timeout - attempting to reconnect')
              announceError('Connection timeout')
            },
            onBackpressure: (bufferSize) => {
              console.warn('Stream backpressure detected:', bufferSize, 'bytes')
            }
          },
          {
            maxBufferSize: 1024 * 1024, // 1MB
            maxChunkSize: 100 * 1024, // 100KB
            timeoutMs: 30000, // 30 seconds
            maxErrorCount: 5
          }
        )

        try {
          while (true) {
            const { done, value } = await reader.read()

            if (value) {
              const decodedValue = decoder.decode(value, { stream: true })
              sseDecoder.push(decodedValue)
            }

            if (done) {
              const finalValue = decoder.decode()
              if (finalValue) {
                sseDecoder.push(finalValue)
              }
              sseDecoder.finish()
              flushContentBuffer(true)
              break
            }

            // Check decoder health
            if (!sseDecoder.isHealthy()) {
              throw new Error('Stream decoder is unhealthy')
            }
          }

          // Reset retry count on success
          setRetryCount(0)
        } finally {
          sseDecoder.finish()
          try {
            await reader.cancel()
          } catch (cancelError) {
            if (!abortController.signal.aborted) {
              console.warn('Failed to cancel stream reader', cancelError)
            }
          }

          flushContentBuffer(true)

          try {
            reader.releaseLock()
          } catch (releaseError) {
            console.warn('Failed to release stream reader', releaseError)
          }
        }
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        // Intentional abort; no user-facing error.
        announceError('Message sending cancelled')
      } else {
        console.error('Failed to send message:', error)

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        setStreamError(errorMessage)
        announceError(errorMessage)

        // Attempt retry if not already at max retries
        const canRetry = await retryMessage(input, retryAttempt)
        if (canRetry) {
          setTimeout(() => {
            sendMessage(retryAttempt + 1)
          }, RETRY_DELAY_MS)
          return
        }

        const finalErrorMessage: Message = {
          id: `error-${Date.now()}`,
          from: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
          createdAt: new Date(),
          error: true,
          retryable: retryAttempt < MAX_RETRY_ATTEMPTS
        }
        setMessages(prev => [...prev, finalErrorMessage])
      }
    } finally {
      if (streamAbortRef.current === abortController) {
        streamAbortRef.current = null
      }
      contentBufferRef.current = { chunks: [], size: 0 }
      clearFlushTimer()
      if (abortController.signal.aborted) {
        autoScrollRef.current = true
        setShowJumpButton(false)
      }
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    } else if (event.key === 'Escape' && isStreaming) {
      event.preventDefault()
      streamAbortRef.current?.abort()
      announceError('Streaming cancelled by user')
    }
  }

  const handleJumpToLatest = useCallback(() => {
    autoScrollRef.current = true
    const behavior: ScrollBehavior = prefersReducedMotionRef.current ? 'auto' : 'smooth'
    messagesEndRef.current?.scrollIntoView({ behavior })
    messagesEndRef.current?.focus()
    setShowJumpButton(false)
  }, [setShowJumpButton])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <TooltipProvider>
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        aria-relevant="additions text"
        role="status"
        className="sr-only"
        data-testid="chat-live-region"
      />
      <div
        ref={errorAnnouncementRef}
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
        data-testid="chat-error-announcement"
      />
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
                <SelectTrigger className="w-48" aria-label="Select AI model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map(model => (
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
                aria-label="Toggle settings"
                aria-expanded={showSettings}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3" role="region" aria-label="Chat settings">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4" aria-hidden="true" />
                  <span className="text-sm">Web Search</span>
                </div>
                <Button
                  variant={enableWebSearch ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnableWebSearch(!enableWebSearch)}
                  aria-pressed={enableWebSearch}
                >
                  {enableWebSearch ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  <span className="text-sm">RAG Context</span>
                </div>
                <Button
                  variant={enableRAG ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnableRAG(!enableRAG)}
                  aria-pressed={enableRAG}
                >
                  {enableRAG ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
              {contextFiles.length > 0 && (
                <div className="pt-3 border-t border-gray-200 space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Active Context Files
                  </span>
                  <div className="flex flex-wrap gap-2" role="list" aria-label="Context files">
                    {contextFiles.map(fileName => (
                      <Badge key={fileName} variant="secondary" className="text-xs" role="listitem">
                        {fileName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {streamError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2" role="alert">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm text-red-800">{streamError}</p>
                {retryCount > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    Retry attempt {retryCount} of {MAX_RETRY_ATTEMPTS}
                  </p>
                )}
              </div>
              {retryCount > 0 && (
                <RefreshCw className="w-4 h-4 text-red-600 animate-spin" aria-hidden="true" />
              )}
            </div>
          )}
        </CardContent>

        {/* Messages Area */}
        <CardContent className="relative flex-1 overflow-hidden p-0">
          {showJumpButton && !prefersReducedMotion && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center z-10">
              <Button
                size="sm"
                data-testid="chat-jump-button"
                aria-label="Jump to latest message"
                aria-controls="chat-scroll-anchor"
                className="pointer-events-auto shadow-md motion-reduce:shadow-none motion-reduce:transition-none"
                onClick={handleJumpToLatest}
              >
                Jump to latest
              </Button>
            </div>
          )}
          <ScrollArea
            ref={scrollAreaRef}
            className="h-full p-4"
            data-testid="chat-scroll-area"
          >
            <div
              className="space-y-4"
              data-testid="chat-message-list"
              role="log"
              aria-live="polite"
              aria-busy={isStreaming ? 'true' : 'false'}
              aria-label="Chat messages"
            >
              {showJumpButton && prefersReducedMotion && (
                <div className="flex justify-center" role="status">
                  <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700">
                    <span>New messages available</span>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="chat-jump-button"
                      aria-label="Jump to latest message"
                      aria-controls="chat-scroll-anchor"
                      onClick={handleJumpToLatest}
                    >
                      Jump to latest
                    </Button>
                  </div>
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}
                  role="article"
                  aria-label={`${message.from === 'user' ? 'User' : 'Assistant'} message`}
                >
                  <div className={`max-w-[80%] ${message.from === 'user' ? 'order-2' : 'order-1'}`}>
                    <div className={`flex items-start space-x-3 ${message.from === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      {/* Avatar */}
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          message.from === 'user' ? 'bg-blue-500' : message.error ? 'bg-red-500' : 'bg-purple-500'
                        }`}
                        aria-hidden="true"
                      >
                        {message.from === 'user' ? (
                          <User className="w-4 h-4 text-white" />
                        ) : message.error ? (
                          <AlertCircle className="w-4 h-4 text-white" />
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>

                      {/* Message Content */}
                      <div className={`flex-1 ${message.from === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block p-3 rounded-lg ${
                          message.from === 'user'
                            ? 'bg-blue-500 text-white'
                            : message.error
                            ? 'bg-red-50 text-red-900 border border-red-200'
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <div className="whitespace-pre-wrap">{message.content}</div>

                          {/* File attachments */}
                          {message.files && message.files.length > 0 && (
                            <div className="mt-2 space-y-1" role="list" aria-label="Attached files">
                              {message.files.map((file) => (
                                <div key={file.id} className="flex items-center space-x-2 p-2 bg-black/10 rounded" role="listitem">
                                  {file.type === 'image' ? (
                                    <ImageIcon aria-hidden="true" className="w-4 h-4" />
                                  ) : (
                                    <FileText className="w-4 h-4" aria-hidden="true" />
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
                <div className="flex justify-start" role="status" aria-live="polite">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center" aria-hidden="true">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="inline-block p-3 rounded-lg bg-gray-100 text-gray-900">
                        <div
                          className="flex items-center space-x-2"
                          data-testid="chat-streaming-indicator"
                        >
                          {!prefersReducedMotion && (
                            <Sparkles className="w-4 h-4 animate-pulse" aria-hidden="true" />
                          )}
                          <span>
                            {prefersReducedMotion ? 'Assistant is preparing a response...' : 'Thinking...'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} tabIndex={-1} data-testid="chat-scroll-anchor" id="chat-scroll-anchor" />
            </div>
          </ScrollArea>
        </CardContent>

        {/* Input Area */}
        <CardContent className="flex-none p-4 border-t">
          {/* File attachments preview */}
          {attachedFiles.length > 0 && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg" role="region" aria-label="Attached files">
              <div className="text-sm font-medium mb-2">Attached Files:</div>
              <div className="space-y-2" role="list">
                {attachedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border" role="listitem">
                    <div className="flex items-center space-x-2">
                      {file.type.startsWith('image/') ? (
                        <ImageIcon aria-hidden="true" className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" aria-hidden="true" />
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
                      aria-label={`Remove ${file.name}`}
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
                placeholder="Ask me anything or attach files... (Press Escape to cancel streaming)"
                className="min-h-[60px] resize-none"
                disabled={isStreaming}
                data-testid="chat-input"
                aria-label="Chat message input"
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
                aria-label="File upload input"
              />
              <Tooltip content="Attach files">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming}
                  aria-label="Attach files"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
              </Tooltip>

              <Tooltip content="Send message (Enter) or cancel streaming (Escape)">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => sendMessage()}
                  disabled={isStreaming || (!input.trim() && attachedFiles.length === 0)}
                  data-testid="chat-send-button"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

export default EnhancedChatInterface
