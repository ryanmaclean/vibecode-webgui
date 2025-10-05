'use client'

import React, { memo, useMemo, useCallback } from 'react'
import { FixedSizeList as List, ListChildComponentProps } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import {
  Code,
  Globe,
  Sparkles,
  Image,
  FileText,
  FileCode,
  Headphones,
  Mic,
  Clock,
  DollarSign
} from 'lucide-react'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'

interface FileAttachment {
  id: string
  name: string
  type: 'image' | 'code' | 'document' | 'audio'
  size: number
  url?: string
  content?: string
  mimeType?: string
  duration?: number
}

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  attachments?: FileAttachment[]
  audioUrl?: string
  transcription?: string
  metadata?: {
    codeGenerated?: boolean
    deploymentUrl?: string
    components?: string[]
    framework?: string
    tokens?: number
    cost?: number
    model?: string
    duration?: number
    audioInputMethod?: 'microphone' | 'file'
  }
}

interface VirtualMessageListProps {
  messages: Message[]
  isTyping: boolean
}

interface ItemData {
  messages: Message[]
}

/**
 * Single message row component (memoized for performance)
 */
const MessageRow = memo<ListChildComponentProps<ItemData>>(({ index, style, data }) => {
  const message = data.messages[index]

  return (
    <div style={style} className="px-4 py-2">
      <div
        className={cn(
          "flex w-full",
          message.type === "user" ? "justify-end" : "justify-start"
        )}
      >
        <div
          className={cn(
            "max-w-[80%] rounded-lg p-4",
            message.type === "user"
              ? "bg-gradient-to-r from-purple-500 to-blue-600 text-white ml-12"
              : "bg-card border mr-12"
          )}
        >
          <div className="flex items-start gap-3">
            {message.type === "assistant" && (
              <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>

              {/* Audio Message */}
              {message.audioUrl && (
                <div className="mt-3">
                  <audio controls className="w-full max-w-sm">
                    <source src={message.audioUrl} type="audio/wav" />
                    Your browser does not support audio playback.
                  </audio>
                  {message.transcription && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      &quot;{message.transcription}&quot;
                    </p>
                  )}
                </div>
              )}

              {/* File Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      {attachment.type === 'image' && <Image className="w-4 h-4" />}
                      {attachment.type === 'code' && <FileCode className="w-4 h-4" />}
                      {attachment.type === 'document' && <FileText className="w-4 h-4" />}
                      {attachment.type === 'audio' && <Headphones className="w-4 h-4" />}
                      <span className="text-xs">{attachment.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(attachment.size / 1024).toFixed(1)}KB)
                      </span>
                      {attachment.type === 'audio' && attachment.url && (
                        <audio controls className="ml-2" style={{ height: '24px', fontSize: '12px' }}>
                          <source src={attachment.url} type={attachment.mimeType || 'audio/wav'} />
                        </audio>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Metadata */}
              {message.metadata && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {message.metadata.codeGenerated && (
                      <Badge variant="secondary" className="text-xs">
                        <Code className="w-3 h-3 mr-1" />
                        Code Generated
                      </Badge>
                    )}
                    {message.metadata.deploymentUrl && (
                      <Badge variant="secondary" className="text-xs">
                        <Globe className="w-3 h-3 mr-1" />
                        Deployed
                      </Badge>
                    )}
                    {message.metadata.audioInputMethod && (
                      <Badge variant="secondary" className="text-xs">
                        <Mic className="w-3 h-3 mr-1" />
                        Voice Input
                      </Badge>
                    )}
                    {message.metadata.framework && (
                      <Badge variant="outline" className="text-xs">
                        {message.metadata.framework}
                      </Badge>
                    )}
                  </div>

                  {/* Token and Cost Info */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {message.metadata.tokens && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {message.metadata.tokens} tokens
                      </span>
                    )}
                    {message.metadata.cost !== undefined && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${message.metadata.cost.toFixed(4)}
                      </span>
                    )}
                    {message.metadata.duration && (
                      <span>{(message.metadata.duration / 1000).toFixed(1)}s</span>
                    )}
                  </div>

                  {/* Components */}
                  {message.metadata.components && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {message.metadata.components.map((comp, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {comp}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

MessageRow.displayName = 'MessageRow'

/**
 * Virtual scrolling message list for handling 1000+ messages
 *
 * Performance Benefits:
 * - Renders only visible messages
 * - Smooth scrolling with 1000+ messages
 * - Constant memory usage regardless of message count
 * - ~60fps scrolling performance
 *
 * Usage:
 * <VirtualMessageList messages={messages} isTyping={false} />
 */
export const VirtualMessageList = memo<VirtualMessageListProps>(({ messages, isTyping }) => {
  // Memoize item data to prevent unnecessary re-renders
  const itemData = useMemo<ItemData>(() => ({ messages }), [messages])

  // Calculate dynamic item size based on content
  const getItemSize = useCallback((index: number) => {
    const message = messages[index]
    let baseHeight = 120 // Base height for simple messages

    // Add height for attachments
    if (message.attachments && message.attachments.length > 0) {
      baseHeight += message.attachments.length * 40
    }

    // Add height for metadata
    if (message.metadata) {
      baseHeight += 40
    }

    // Add height for audio
    if (message.audioUrl) {
      baseHeight += 60
    }

    return baseHeight
  }, [messages])

  // Use average height for FixedSizeList (simpler than VariableSizeList)
  const averageItemHeight = useMemo(() => {
    if (messages.length === 0) return 120
    const totalHeight = messages.reduce((sum, _, idx) => sum + getItemSize(idx), 0)
    return Math.ceil(totalHeight / messages.length)
  }, [messages, getItemSize])

  if (messages.length === 0 && !isTyping) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No messages yet. Start a conversation!</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <AutoSizer>
        {({ height, width }) => (
          <List
            height={height}
            itemCount={messages.length}
            itemSize={averageItemHeight}
            width={width}
            itemData={itemData}
            overscanCount={5} // Render 5 extra items for smooth scrolling
          >
            {MessageRow}
          </List>
        )}
      </AutoSizer>

      {isTyping && (
        <div className="px-4 py-2 flex justify-start">
          <div className="bg-card border rounded-lg p-4 mr-12">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-150"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

VirtualMessageList.displayName = 'VirtualMessageList'

export default VirtualMessageList
