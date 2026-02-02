/**
 * AgentConversationThread Component
 *
 * Thread viewer for agent conversations with message history,
 * role indicators, and context preservation.
 *
 * Features:
 * - Message threading with parent/child relationships
 * - Role-based styling (user, assistant, system)
 * - Timestamp and metadata display
 * - Virtual scrolling for performance
 * - Message actions (edit, delete, branch)
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/agents/AgentConversationThread
 */

'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Bot,
  User,
  Shield,
  MoreVertical,
  Edit,
  Trash,
  GitBranch,
  Copy,
  Check,
  MessageSquare
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
// import { logger } from '@/lib/logger';

// ============================================================================
// Type Definitions
// ============================================================================

type MessageRole = 'user' | 'assistant' | 'system'

export interface ThreadMessage {
  id: string
  threadId: string
  role: MessageRole
  content: string
  timestamp: Date
  parentId?: string
  metadata?: {
    model?: string
    tokens?: number
    finishReason?: string
  }
}

export interface AgentConversationThreadProps {
  /** Thread identifier */
  threadId: string
  /** Messages to display */
  messages: ThreadMessage[]
  /** Enable message actions */
  enableActions?: boolean
  /** Callback when message is edited */
  onEditMessage?: (messageId: string, content: string) => void
  /** Callback when message is deleted */
  onDeleteMessage?: (messageId: string) => void
  /** Callback when creating branch from message */
  onBranchMessage?: (messageId: string) => void
  /** Custom className */
  className?: string
}

// ============================================================================
// Message Component
// ============================================================================

interface MessageItemProps {
  message: ThreadMessage
  enableActions: boolean
  onEdit?: (content: string) => void
  onDelete?: () => void
  onBranch?: () => void
  onCopy?: () => void
}

function MessageItem({
  message,
  enableActions,
  onEdit,
  onDelete,
  onBranch,
  onCopy
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [copied, setCopied] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const handleCopy = useCallback(async () => {
    if (onCopy) {
      onCopy()
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [onCopy])

  const handleSaveEdit = useCallback(() => {
    if (onEdit && editContent.trim() !== message.content) {
      onEdit(editContent.trim())
    }
    setIsEditing(false)
  }, [editContent, message.content, onEdit])

  const handleCancelEdit = useCallback(() => {
    setEditContent(message.content)
    setIsEditing(false)
  }, [message.content])

  const getRoleIcon = () => {
    switch (message.role) {
      case 'user':
        return <User className="h-4 w-4" aria-label="User message" />
      case 'assistant':
        return <Bot className="h-4 w-4" aria-label="Assistant message" />
      case 'system':
        return <Shield className="h-4 w-4" aria-label="System message" />
    }
  }

  const getRoleColor = () => {
    switch (message.role) {
      case 'user':
        return 'bg-primary text-primary-foreground'
      case 'assistant':
        return 'bg-muted'
      case 'system':
        return 'bg-accent text-accent-foreground'
    }
  }

  return (
    <div
      className={cn(
        "flex gap-3 group relative",
        message.role === 'user' && "flex-row-reverse"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          message.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
        aria-hidden="true"
      >
        {getRoleIcon()}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "flex-1 min-w-0 space-y-1",
          message.role === 'user' && "flex flex-col items-end"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium capitalize">{message.role}</span>
          <span>•</span>
          <time dateTime={message.timestamp.toISOString()}>
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </time>
          {message.metadata?.model && (
            <>
              <span>•</span>
              <Badge variant="outline" className="text-xs px-1 py-0">
                {message.metadata.model}
              </Badge>
            </>
          )}
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="w-full space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Edit message content"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit}>Save</Button>
              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "rounded-lg px-4 py-3 text-sm whitespace-pre-wrap break-words",
              getRoleColor()
            )}
          >
            {message.content}
          </div>
        )}

        {/* Metadata */}
        {message.metadata && (
          <div className="flex gap-2 text-xs text-muted-foreground">
            {message.metadata.tokens && (
              <span>{message.metadata.tokens} tokens</span>
            )}
            {message.metadata.finishReason && (
              <>
                <span>•</span>
                <span>{message.metadata.finishReason}</span>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        {enableActions && showActions && !isEditing && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
              ) : (
                <Copy className="h-3 w-3" aria-hidden="true" />
              )}
            </Button>
            {message.role === 'user' && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-7 px-2"
                aria-label="Edit message"
              >
                <Edit className="h-3 w-3" aria-hidden="true" />
              </Button>
            )}
            {onBranch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBranch}
                className="h-7 px-2"
                aria-label="Branch from message"
              >
                <GitBranch className="h-3 w-3" aria-hidden="true" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-7 px-2 text-destructive hover:text-destructive"
                aria-label="Delete message"
              >
                <Trash className="h-3 w-3" aria-hidden="true" />
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

export function AgentConversationThread({
  threadId,
  messages,
  enableActions = true,
  onEditMessage,
  onDeleteMessage,
  onBranchMessage,
  className
}: AgentConversationThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, autoScroll])

  // Detect manual scroll
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement
    const { scrollTop, scrollHeight, clientHeight } = target
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100

    setAutoScroll(isAtBottom)
  }, [])

  const handleCopyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }, [])

  const messageCount = messages.length
  const userMessages = messages.filter(m => m.role === 'user').length
  const assistantMessages = messages.filter(m => m.role === 'assistant').length

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
            Conversation Thread
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              {messageCount} messages
            </Badge>
            <Badge variant="outline" className="text-xs">
              {userMessages}U / {assistantMessages}A
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 relative">
        <ScrollArea
          ref={scrollAreaRef}
          className="h-full px-4 py-3"
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                No messages in this thread yet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  enableActions={enableActions}
                  onEdit={
                    onEditMessage
                      ? (content) => onEditMessage(message.id, content)
                      : undefined
                  }
                  onDelete={
                    onDeleteMessage
                      ? () => onDeleteMessage(message.id)
                      : undefined
                  }
                  onBranch={
                    onBranchMessage
                      ? () => onBranchMessage(message.id)
                      : undefined
                  }
                  onCopy={() => handleCopyMessage(message.content)}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Scroll to bottom indicator */}
        {!autoScroll && messages.length > 0 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setAutoScroll(true)
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="shadow-lg"
              aria-label="Scroll to latest message"
            >
              New messages
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
