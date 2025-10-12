/**
 * UnifiedAgentChat Component
 *
 * Single conversation interface for all agents with SSE streaming,
 * message history, code rendering, and @-mention support.
 *
 * Features:
 * - SSE streaming integration for real-time updates
 * - Message history with efficient rendering
 * - Code block syntax highlighting
 * - @-mention support for multi-agent coordination
 * - Auto-scroll with smart detection
 * - Message actions (copy, retry, delete)
 *
 * @module components/ai/UnifiedAgentChat
 */

'use client'

import { logger } from '@/lib/logger';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Send,
  Bot,
  User,
  Copy,
  RefreshCw,
  Trash2,
  Check,
  AlertCircle,
  Code,
  MessageSquare
} from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { createSSEClient, type SSEClient, type SSEConnectionState } from '@/lib/streaming/sse-client'
import type { AgentType, AgentResponse } from '@/types/agent-api'

// ============================================================================
// Type Definitions
// ============================================================================

interface Message {
  id: string
  agentId: string
  agentType: AgentType
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    model?: string
    tokens?: number
    responseTime?: number
  }
  status?: 'sending' | 'sent' | 'error'
  isStreaming?: boolean
}

interface UnifiedAgentChatProps {
  /** Currently active agent */
  agent: AgentResponse
  /** Initial message history */
  initialMessages?: Message[]
  /** Callback when message is sent */
  onMessageSend?: (message: string) => void
  /** Callback when connection state changes */
  onConnectionStateChange?: (state: SSEConnectionState) => void
  /** Enable @-mentions for multi-agent coordination */
  enableMentions?: boolean
  /** Available agents for @-mentions */
  availableAgents?: AgentResponse[]
  /** Custom className */
  className?: string
  /** Maximum message history length */
  maxMessages?: number
}

interface CodeBlockProps {
  code: string
  language?: string
}

// ============================================================================
// Constants
// ============================================================================

const MENTION_REGEX = /@(\w+)/g
const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g

// ============================================================================
// Code Block Component
// ============================================================================

function CodeBlock({ code, language = 'plaintext' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      logger.error('Failed to copy code:', error)
    }
  }, [code])

  return (
    <div className="relative group my-3 rounded-lg border bg-muted/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
        <Badge variant="outline" className="text-xs font-mono">
          {language}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2"
          aria-label={copied ? 'Code copied' : 'Copy code'}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
          ) : (
            <Copy className="h-3 w-3" aria-hidden="true" />
          )}
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  )
}

// ============================================================================
// Message Component
// ============================================================================

interface MessageItemProps {
  message: Message
  onRetry?: () => void
  onDelete?: () => void
  onCopy?: () => void
}

function MessageItem({ message, onRetry, onDelete, onCopy }: MessageItemProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  // Parse message content for code blocks
  const parsedContent = useMemo(() => {
    const parts: React.ReactNode[] = []
    let lastIndex = 0

    // Extract code blocks
    const matches = Array.from(message.content.matchAll(CODE_BLOCK_REGEX))

    matches.forEach((match, index) => {
      const [fullMatch, language, code] = match
      const matchIndex = match.index!

      // Add text before code block
      if (matchIndex > lastIndex) {
        parts.push(
          <p key={`text-${index}`} className="whitespace-pre-wrap break-words">
            {message.content.substring(lastIndex, matchIndex)}
          </p>
        )
      }

      // Add code block
      parts.push(
        <CodeBlock key={`code-${index}`} code={code.trim()} language={language} />
      )

      lastIndex = matchIndex + fullMatch.length
    })

    // Add remaining text
    if (lastIndex < message.content.length) {
      parts.push(
        <p key="text-final" className="whitespace-pre-wrap break-words">
          {message.content.substring(lastIndex)}
        </p>
      )
    }

    return parts.length > 0 ? parts : (
      <p className="whitespace-pre-wrap break-words">{message.content}</p>
    )
  }, [message.content])

  return (
    <div
      className={cn(
        "flex gap-3 group",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : isSystem ? (
          <MessageSquare className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "flex-1 min-w-0 space-y-1",
          isUser && "flex flex-col items-end"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">
            {isUser ? 'You' : isSystem ? 'System' : message.agentType}
          </span>
          <span>•</span>
          <time dateTime={message.timestamp.toISOString()}>
            {message.timestamp.toLocaleTimeString()}
          </time>
          {message.metadata?.responseTime && (
            <>
              <span>•</span>
              <span>{message.metadata.responseTime}ms</span>
            </>
          )}
        </div>

        {/* Content */}
        <div
          className={cn(
            "rounded-lg px-4 py-3 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          {parsedContent}

          {/* Streaming indicator */}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}

          {/* Error indicator */}
          {message.status === 'error' && (
            <div className="flex items-center gap-2 mt-2 text-red-500">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs">Failed to send message</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isSystem && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onCopy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCopy}
                className="h-7 px-2"
                aria-label="Copy message"
              >
                <Copy className="h-3 w-3" aria-hidden="true" />
              </Button>
            )}
            {!isUser && onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-7 px-2"
                aria-label="Retry message"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-7 px-2 text-red-500 hover:text-red-600"
                aria-label="Delete message"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function UnifiedAgentChat({
  agent,
  initialMessages = [],
  onMessageSend,
  onConnectionStateChange,
  enableMentions = false,
  availableAgents = [],
  className,
  maxMessages = 1000
}: UnifiedAgentChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected')
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sseClientRef = useRef<SSEClient | null>(null)
  const userScrolledRef = useRef(false)

  // Initialize SSE client
  useEffect(() => {
    if (!agent.stream_url) return

    const client = createSSEClient(
      {
        url: agent.stream_url,
        method: 'GET',
        enableMetrics: true,
        debug: process.env.NODE_ENV === 'development'
      },
      {
        onMessage: (chunk) => {
          if (chunk.type === 'content') {
            // Add or update streaming message
            setMessages(prev => {
              const lastMessage = prev[prev.length - 1]

              if (lastMessage?.isStreaming) {
                return [
                  ...prev.slice(0, -1),
                  {
                    ...lastMessage,
                    content: lastMessage.content + chunk.content
                  }
                ]
              }

              return [
                ...prev,
                {
                  id: `assistant-${Date.now()}`,
                  agentId: agent.agent_id,
                  agentType: agent.agent_type || 'aider',
                  role: 'assistant',
                  content: chunk.content,
                  timestamp: new Date(),
                  isStreaming: true
                }
              ]
            })
          }
        },
        onOpen: () => {
          setIsConnected(true)
          setConnectionState('connected')
        },
        onClose: () => {
          setIsConnected(false)
          setConnectionState('disconnected')

          // Mark last message as complete
          setMessages(prev => {
            const lastMessage = prev[prev.length - 1]
            if (lastMessage?.isStreaming) {
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, isStreaming: false }
              ]
            }
            return prev
          })
        },
        onError: (error) => {
          logger.error('SSE error:', error)
          setConnectionState('failed')
        },
        onStateChange: (state) => {
          setConnectionState(state)
          onConnectionStateChange?.(state)
        }
      }
    )

    client.connect()
    sseClientRef.current = client

    return () => {
      client.disconnect()
      sseClientRef.current = null
    }
  }, [agent, onConnectionStateChange])

  // Auto-scroll to bottom (unless user has scrolled up)
  useEffect(() => {
    if (!userScrolledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Detect user scroll
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement
    const { scrollTop, scrollHeight, clientHeight } = target
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

    userScrolledRef.current = !isAtBottom
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // Handle @-mentions
  useEffect(() => {
    if (!enableMentions) return

    const lastAtIndex = input.lastIndexOf('@')
    if (lastAtIndex === -1) {
      setShowMentionSuggestions(false)
      return
    }

    const afterAt = input.substring(lastAtIndex + 1)
    const hasSpace = afterAt.includes(' ')

    if (hasSpace) {
      setShowMentionSuggestions(false)
      return
    }

    setShowMentionSuggestions(true)
    setMentionFilter(afterAt.toLowerCase())
  }, [input, enableMentions])

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || !isConnected) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      agentId: agent.agent_id,
      agentType: agent.agent_type || 'aider',
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      status: 'sending'
    }

    setMessages(prev => [...prev.slice(-maxMessages + 1), userMessage])
    setInput('')

    try {
      onMessageSend?.(userMessage.content)

      // Update message status
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id ? { ...msg, status: 'sent' as const } : msg
        )
      )
    } catch (error) {
      logger.error('Failed to send message:', error)

      // Update message status to error
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id ? { ...msg, status: 'error' as const } : msg
        )
      )
    }
  }, [input, isConnected, agent, maxMessages, onMessageSend])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const handleCopyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
    } catch (error) {
      logger.error('Failed to copy message:', error)
    }
  }, [])

  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId))
  }, [])

  const handleRetryMessage = useCallback((messageId: string) => {
    const message = messages.find(msg => msg.id === messageId)
    if (message && message.role === 'user') {
      setInput(message.content)
      handleDeleteMessage(messageId)
    }
  }, [messages, handleDeleteMessage])

  const filteredMentionAgents = useMemo(() => {
    if (!showMentionSuggestions) return []

    return availableAgents.filter(a =>
      a.agent_id.toLowerCase().includes(mentionFilter) ||
      (a.agent_type && a.agent_type.toLowerCase().includes(mentionFilter))
    )
  }, [showMentionSuggestions, availableAgents, mentionFilter])

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5" aria-hidden="true" />
            {agent.agent_type || 'Agent'} Chat
          </CardTitle>
          <Badge
            variant={connectionState === 'connected' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {connectionState === 'connected' && (
              <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
            )}
            {connectionState}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 relative">
        <ScrollArea
          className="h-full px-4 py-3"
          onScroll={handleScroll}
        >
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                onCopy={() => handleCopyMessage(message.content)}
                onDelete={() => handleDeleteMessage(message.id)}
                onRetry={() => handleRetryMessage(message.id)}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* @-mention suggestions */}
        {showMentionSuggestions && filteredMentionAgents.length > 0 && (
          <div className="absolute bottom-0 left-4 right-4 mb-2 p-2 bg-popover border rounded-lg shadow-lg z-10">
            <div className="text-xs text-muted-foreground mb-1">Mention agent:</div>
            <div className="space-y-1">
              {filteredMentionAgents.map(a => (
                <button
                  key={a.agent_id}
                  className="w-full text-left px-2 py-1 text-sm rounded hover:bg-accent"
                  onClick={() => {
                    const lastAtIndex = input.lastIndexOf('@')
                    setInput(input.substring(0, lastAtIndex) + `@${a.agent_id} `)
                    setShowMentionSuggestions(false)
                  }}
                >
                  @{a.agent_id}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t p-3">
        <div className="flex gap-2 w-full">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isConnected
                ? "Type a message... (Shift+Enter for new line)"
                : "Waiting for connection..."
            }
            disabled={!isConnected}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[40px]"
            rows={1}
            aria-label="Message input"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || !isConnected}
            size="icon"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
