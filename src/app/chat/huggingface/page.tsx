'use client'

import React, { useState } from 'react'
import HuggingFaceChatInterface from '@/components/chat/HuggingFaceChatInterface'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Bot, Zap, FileText, Link } from 'lucide-react'

export default function HuggingFaceChatPage() {
  const [conversationId, setConversationId] = useState<string>()
  const [workspaceId] = useState('hf-workspace-' + Math.random().toString(36).substr(2, 9))

  const createNewConversation = async () => {
    try {
      const response = await fetch('/api/chat/mongodb-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': 'hf-demo-user',
          'x-test-user-role': 'developer'
        },
        body: JSON.stringify({
          action: 'create_conversation',
          title: 'Hugging Face Chat Session',
          sessionId: 'hf-session-' + Date.now(),
          model: 'microsoft/DialoGPT-medium',
          workspaceId
        })
      })

      const data = await response.json()
      if (data.success && data.conversation) {
        setConversationId(data.conversation.id)
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-3">
              <Bot className="w-6 h-6 text-orange-500" />
              <span>🤗 Hugging Face Enhanced Chat</span>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                Production Ready
              </Badge>
            </CardTitle>
            <div className="text-sm text-gray-600 mt-2">
              Experience the power of open-source conversational AI with Hugging Face transformers, 
              integrated seamlessly with VibeCode&apos;s enterprise platform.
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="font-medium text-sm">Multiple Models</div>
                  <div className="text-xs text-gray-500">6+ HF Models Available</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
                <FileText className="w-5 h-5 text-green-500" />
                <div>
                  <div className="font-medium text-sm">File Attachments</div>
                  <div className="text-xs text-gray-500">Multimodal Support</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-purple-50 rounded-lg">
                <Link className="w-5 h-5 text-purple-500" />
                <div>
                  <div className="font-medium text-sm">RAG Integration</div>
                  <div className="text-xs text-gray-500">Context-Aware Chat</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg">
                <Zap className="w-5 h-5 text-orange-500" />
                <div>
                  <div className="font-medium text-sm">Real-time</div>
                  <div className="text-xs text-gray-500">Instant Responses</div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button 
                onClick={createNewConversation}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                🤗 Start New Chat
              </Button>
              {conversationId && (
                <Badge variant="outline" className="px-3 py-1">
                  Session: {conversationId.slice(-8)}
                </Badge>
              )}
              <Badge variant="outline" className="px-3 py-1">
                Workspace: {workspaceId.slice(-9)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chat Interface */}
      <div className="max-w-7xl mx-auto">
        <div className="h-[calc(100vh-250px)]">
          <HuggingFaceChatInterface
            conversationId={conversationId}
            workspaceId={workspaceId}
            onFileUpload={handleFileUpload}
            className="h-full shadow-lg"
          />
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="max-w-7xl mx-auto mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-orange-200">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center">
                <Bot className="w-4 h-4 mr-2 text-orange-500" />
                Available Models
              </h3>
              <div className="space-y-1 text-xs text-gray-600">
                <div>🤗 DialoGPT Medium/Large</div>
                <div>🤗 BlenderBot 400M</div>
                <div>🤗 GODEL Large</div>
                <div>🤗 FLAN-T5 Large</div>
                <div>🤗 BLOOM 560M</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-blue-200">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center">
                <Zap className="w-4 h-4 mr-2 text-blue-500" />
                Enterprise Features
              </h3>
              <div className="space-y-1 text-xs text-gray-600">
                <div>✅ MongoDB Persistence</div>
                <div>✅ File Upload Support</div>
                <div>✅ RAG Context Integration</div>
                <div>✅ Real-time Streaming</div>
                <div>✅ Fallback to OpenRouter</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-green-200">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2 text-green-500" />
                Use Cases
              </h3>
              <div className="space-y-1 text-xs text-gray-600">
                <div>💬 Interactive Conversations</div>
                <div>📝 Content Generation</div>
                <div>🔍 Document Q&A</div>
                <div>💡 Creative Assistance</div>
                <div>🛠️ Code Help & Debugging</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}