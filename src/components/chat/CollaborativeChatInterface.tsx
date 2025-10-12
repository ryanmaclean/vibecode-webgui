import React, { useState, useEffect, useRef } from 'react'
import { Users, Wifi, WifiOff, Eye, MessageCircle, UserCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCollaboration } from '@/hooks/useCollaboration'
import HuggingFaceChatInterface from './HuggingFaceChatInterface'

interface CollaborativeChatInterfaceProps {
  conversationId?: string
  workspaceId: string
  userId: string
  userName: string
  onFileUpload?: (files: FileList) => void
  className?: string
}

export const CollaborativeChatInterface = ({
  conversationId,
  workspaceId,
  userId,
  userName,
  onFileUpload,
  className = ''
}: CollaborativeChatInterfaceProps) => {
  const [showCollaborators, setShowCollaborators] = useState(true)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const {
    isConnected,
    connectionError,
    activeUsers,
    typingUsers,
    startTyping,
    stopTyping,
    cursors,
    updateCursor,
    socket
  } = useCollaboration({
    workspaceId,
    conversationId,
    userId,
    userName,
    enabled: true
  })

  // Track mouse movement for cursor sharing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!chatContainerRef.current) return
      
      const rect = chatContainerRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100 // Percentage
      const y = ((e.clientY - rect.top) / rect.height) * 100 // Percentage
      
      setMousePosition({ x, y })
      updateCursor(x, y)
    }

    const container = chatContainerRef.current
    if (container) {
      container.addEventListener('mousemove', handleMouseMove)
      return () => container.removeEventListener('mousemove', handleMouseMove)
    }
  }, [updateCursor])

  // Handle typing indicators
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (conversationId && e.target.value.length > 0) {
      startTyping(conversationId)
    }
  }

  const handleInputBlur = () => {
    if (conversationId) {
      stopTyping(conversationId)
    }
  }

  const renderCursors = () => {
    return cursors.map((cursor) => {
      const user = activeUsers.find(u => u.id === cursor.userId)
      if (!user || cursor.userId === userId) return null

      return (
        <div
          key={cursor.userId}
          className="absolute pointer-events-none z-50 transition-all duration-150"
          style={{
            left: `${cursor.x}%`,
            top: `${cursor.y}%`,
            transform: 'translate(-2px, -2px)'
          }}
        >
          {/* Cursor dot */}
          <div 
            className="w-3 h-3 rounded-full border-2 border-white shadow-lg"
            style={{ backgroundColor: user.color }}
          />
          {/* User label */}
          <div 
            className="absolute top-4 left-0 px-2 py-1 text-xs text-white rounded shadow-lg whitespace-nowrap"
            style={{ backgroundColor: user.color }}
          >
            {user.name}
          </div>
        </div>
      )
    })
  }

  const renderTypingIndicators = () => {
    if (!conversationId) return null
    
    const currentTypingUsers = typingUsers(conversationId)
    if (currentTypingUsers.length === 0) return null

    return (
      <div className="flex items-center space-x-2 p-2 bg-blue-50 border border-blue-200 rounded-lg mb-4">
        <MessageCircle className="w-4 h-4 text-blue-500 animate-pulse" />
        <span className="text-sm text-blue-700">
          {currentTypingUsers.length === 1 ? (
            <>
              <span style={{ color: currentTypingUsers[0].color }} className="font-medium">
                {currentTypingUsers[0].name}
              </span>
              {' '}is typing...
            </>
          ) : (
            <>
              <span className="font-medium">
                {currentTypingUsers.slice(0, 2).map((user, index) => (
                  <span key={user.id}>
                    {index > 0 && ', '}
                    <span style={{ color: user.color }}>{user.name}</span>
                  </span>
                ))}
                {currentTypingUsers.length > 2 && ` and ${currentTypingUsers.length - 2} others`}
              </span>
              {' '}are typing...
            </>
          )}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Collaboration Header */}
      <Card className="flex-none mb-4 border-2 border-blue-100">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium text-sm">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {connectionError && (
                <Badge variant="destructive" className="text-xs">
                  {connectionError}
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">
                  {activeUsers.length} online
                </span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCollaborators(!showCollaborators)}
                className="text-xs"
              >
                <Eye className="w-3 h-3 mr-1" />
                {showCollaborators ? 'Hide' : 'Show'} Users
              </Button>
            </div>
          </div>

          {/* Active Users */}
          {showCollaborators && activeUsers.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-xs font-medium text-gray-600">Active Users:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center space-x-2 px-3 py-1 rounded-full border"
                    style={{ borderColor: user.color + '40', backgroundColor: user.color + '10' }}
                  >
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: user.color }}
                    />
                    <span className="text-sm font-medium" style={{ color: user.color }}>
                      {user.name}
                      {user.id === userId && ' (You)'}
                    </span>
                    {user.isActive && (
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat Interface with Collaboration */}
      <div 
        ref={chatContainerRef}
        className="flex-1 relative"
        style={{ position: 'relative' }}
      >
        {/* Render other users' cursors */}
        {renderCursors()}
        
        {/* Typing Indicators */}
        {renderTypingIndicators()}
        
        {/* Main Chat Interface */}
        <HuggingFaceChatInterface
          conversationId={conversationId}
          workspaceId={workspaceId}
          onFileUpload={onFileUpload}
          className="h-full"
          // Pass collaboration events
          onInputChange={handleInputChange}
          onInputBlur={handleInputBlur}
        />
      </div>

      {/* Collaboration Status Bar */}
      <div className="flex-none mt-2">
        <div className="flex items-center justify-between text-xs text-gray-500 px-2">
          <div className="flex items-center space-x-4">
            <span>Workspace: {workspaceId.slice(-8)}</span>
            {conversationId && <span>Chat: {conversationId.slice(-8)}</span>}
          </div>
          <div className="flex items-center space-x-2">
            {isConnected && (
              <>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>Real-time collaboration active</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CollaborativeChatInterface