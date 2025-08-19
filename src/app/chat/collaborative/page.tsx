'use client'

import React, { useState, useEffect } from 'react'
import CollaborativeChatInterface from '@/components/chat/CollaborativeChatInterface'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Users, MessageSquare, Share, Zap, Wifi, Eye, Link } from 'lucide-react'

export default function CollaborativeChatPage() {
  const [conversationId, setConversationId] = useState<string>()
  const [workspaceId] = useState('collab-workspace-' + Math.random().toString(36).substr(2, 9))
  const [userId] = useState('user-' + Math.random().toString(36).substr(2, 9))
  const [userName, setUserName] = useState('')
  const [showDemo, setShowDemo] = useState(false)

  // Generate random user name if not provided
  useEffect(() => {
    if (!userName) {
      const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']
      const randomName = names[Math.floor(Math.random() * names.length)]
      setUserName(`${randomName}-${Math.random().toString(36).substr(2, 4)}`)
    }
  }, [userName])

  const createNewConversation = async () => {
    try {
      const response = await fetch('/api/chat/mongodb-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': userId,
          'x-test-user-role': 'developer'
        },
        body: JSON.stringify({
          action: 'create_conversation',
          title: 'Collaborative AI Chat Session',
          sessionId: 'collab-session-' + Date.now(),
          model: 'anthropic/claude-3.5-sonnet',
          workspaceId
        })
      })

      const data = await response.json()
      if (data.success && data.conversation) {
        setConversationId(data.conversation.id)
        setShowDemo(true)
      } else {
        // Error handled
      }
    } catch (error) {
      // Error handled
    }
  }

  const handleFileUpload = (files: FileList) => {
    // Debug log removed.map(f => f.name))
  }

  const shareWorkspaceLink = () => {
    const link = `${window.location.origin}/chat/collaborative?workspace=${workspaceId}&conversation=${conversationId}`
    navigator.clipboard.writeText(link)
    alert('Workspace link copied to clipboard! Share it with your team.')
  }

  if (!showDemo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 flex items-center justify-center">
        <Card className="w-full max-w-2xl border-2 border-blue-200 shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center space-x-3 text-2xl">
              <Users className="w-8 h-8" />
              <span>🤝 Collaborative AI Chat</span>
              <Badge className="bg-white text-blue-600 font-bold">
                Real-time
              </Badge>
            </CardTitle>
            <div className="text-blue-100 mt-2">
              Work together with your team in real-time AI conversations. See cursors, typing indicators, 
              and share insights instantly.
            </div>
          </CardHeader>
          
          <CardContent className="p-8 space-y-6">
            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Wifi className="w-6 h-6 text-blue-600" />
                <div>
                  <div className="font-semibold text-sm">Real-time Sync</div>
                  <div className="text-xs text-gray-600">Live cursors & typing</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <MessageSquare className="w-6 h-6 text-green-600" />
                <div>
                  <div className="font-semibold text-sm">Shared Chats</div>
                  <div className="text-xs text-gray-600">Team conversations</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <Share className="w-6 h-6 text-purple-600" />
                <div>
                  <div className="font-semibold text-sm">Easy Sharing</div>
                  <div className="text-xs text-gray-600">Shareable links</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <Zap className="w-6 h-6 text-orange-600" />
                <div>
                  <div className="font-semibold text-sm">Multi-AI Models</div>
                  <div className="text-xs text-gray-600">HF + OpenRouter</div>
                </div>
              </div>
            </div>

            {/* User Setup */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name (for collaboration)
                </label>
                <Input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Workspace ID:</span>
                  <div className="font-mono text-xs bg-gray-100 p-2 rounded mt-1">
                    {workspaceId.slice(-12)}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Your User ID:</span>
                  <div className="font-mono text-xs bg-gray-100 p-2 rounded mt-1">
                    {userId.slice(-12)}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-3">
              <Button
                onClick={createNewConversation}
                disabled={!userName.trim()}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3"
              >
                <Users className="w-4 h-4 mr-2" />
                Start Collaborative Chat
              </Button>
              
              <div className="text-center text-sm text-gray-500">
                Or join an existing workspace by opening a shared link
              </div>
            </div>

            {/* Demo Instructions */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Eye className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-yellow-800">Demo Instructions:</div>
                  <div className="text-yellow-700 mt-1">
                    1. Start a chat session<br/>
                    2. Open the same page in another browser/tab<br/>
                    3. Use the workspace link to join the same session<br/>
                    4. Watch real-time collaboration in action!
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-4">
        <Card className="border-2 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Users className="w-6 h-6 text-blue-500" />
                <div>
                  <div className="font-semibold">Collaborative AI Chat</div>
                  <div className="text-sm text-gray-600">Real-time team collaboration</div>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  🟢 Live
                </Badge>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  onClick={shareWorkspaceLink}
                  variant="outline"
                  size="sm"
                  className="text-blue-600 border-blue-300"
                >
                  <Share className="w-4 h-4 mr-2" />
                  Share Workspace
                </Button>
                
                <div className="flex items-center space-x-2 text-sm">
                  <Link className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">Connected as: </span>
                  <Badge variant="secondary">{userName}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collaborative Chat Interface */}
      <div className="max-w-7xl mx-auto">
        <div className="h-[calc(100vh-180px)]">
          <CollaborativeChatInterface
            conversationId={conversationId}
            workspaceId={workspaceId}
            userId={userId}
            userName={userName}
            onFileUpload={handleFileUpload}
            className="h-full"
          />
        </div>
      </div>
    </div>
  )
}