'use client'

import React, { useState } from 'react'
import HuggingFaceChatInterface from '@/components/chat/HuggingFaceChatInterface'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, Bot, Zap, FileText, Link, Terminal, Code, Package, Search, Sparkles } from 'lucide-react'

export default function EnhancedChatPage() {
  const [conversationId, setConversationId] = useState<string>()
  const [workspaceId] = useState('enhanced-workspace-' + Math.random().toString(36).substr(2, 9))
  const [demoMode, setDemoMode] = useState<'chat' | 'functions' | 'rag' | 'web'>('chat')

  const createNewConversation = async () => {
    try {
      const response = await fetch('/api/chat/mongodb-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': 'enhanced-demo-user',
          'x-test-user-role': 'developer'
        },
        body: JSON.stringify({
          action: 'create_conversation',
          title: 'Enhanced AI Chat Session',
          sessionId: 'enhanced-session-' + Date.now(),
          model: 'anthropic/claude-3.5-sonnet',
          workspaceId
        })
      })

      const data = await response.json()
      if (data.success && data.conversation) {
        setConversationId(data.conversation.id)
      } else {
        // Failed to create conversation
      }
    } catch (error) {
      // Error creating conversation
    }
  }

  const handleFileUpload = (files: FileList) => {
    // Files uploaded to enhanced chat
  }

  const demoQueries = {
    chat: [
      "Hello! Can you help me with my Next.js project?",
      "What are the best practices for React development?",
      "Explain TypeScript generics with examples"
    ],
    functions: [
      "Can you create a new file called 'utils.ts' with some helper functions?",
      "Execute this JavaScript code: // Debug log removed",
      "Install the lodash package using npm",
      "List all files in my workspace"
    ],
    rag: [
      "Based on my uploaded files, what's the main architecture pattern?",
      "Analyze the code structure and suggest improvements",
      "Find all instances of async functions in my codebase"
    ],
    web: [
      "What are the latest features in Next.js 15?",
      "Find current best practices for MongoDB indexing",
      "Search for recent TypeScript 5.0 updates and changes"
    ]
  }

  return (
    <div className="min-h-screen bg-gradient-from-gray-50 to-gray-100 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <Card className="border-2 border-blue-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center space-x-3 text-xl">
              <Bot className="w-7 h-7" />
              <span>🚀 Enhanced AI Chat Platform</span>
              <Badge className="bg-white text-blue-600 font-bold">
                Enterprise Ready
              </Badge>
            </CardTitle>
            <div className="text-blue-100 mt-2 text-sm">
              Experience the full power of VibeCode&apos;s AI platform with Hugging Face models, 
              RAG context, web search, and function calling capabilities.
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {/* Feature Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="flex items-center space-x-2 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <Bot className="w-6 h-6 text-orange-600" />
                <div>
                  <div className="font-semibold text-sm">🤗 HF Models</div>
                  <div className="text-xs text-gray-600">6+ Open Source</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                <Terminal className="w-6 h-6 text-green-600" />
                <div>
                  <div className="font-semibold text-sm">Function Calling</div>
                  <div className="text-xs text-gray-600">Code & File Ops</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
                <div>
                  <div className="font-semibold text-sm">RAG Context</div>
                  <div className="text-xs text-gray-600">Smart File Search</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <Link className="w-6 h-6 text-purple-600" />
                <div>
                  <div className="font-semibold text-sm">Web Search</div>
                  <div className="text-xs text-gray-600">Real-time Info</div>
                </div>
              </div>
            </div>

            {/* Demo Mode Selector */}
            <Tabs value={demoMode} onValueChange={(value: string) => setDemoMode(value as "chat" | "functions" | "rag" | "web")} className="mb-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="chat" className="flex items-center space-x-1">
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat</span>
                </TabsTrigger>
                <TabsTrigger value="functions" className="flex items-center space-x-1">
                  <Terminal className="w-4 h-4" />
                  <span>Functions</span>
                </TabsTrigger>
                <TabsTrigger value="rag" className="flex items-center space-x-1">
                  <FileText className="w-4 h-4" />
                  <span>RAG</span>
                </TabsTrigger>
                <TabsTrigger value="web" className="flex items-center space-x-1">
                  <Link className="w-4 h-4" />
                  <span>Web Search</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value={demoMode} className="mt-4">
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <h4 className="font-semibold text-sm mb-2 flex items-center">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Try these {demoMode} examples:
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                     {demoQueries[demoMode].map((query, index) => (
                       <div key={index} className="text-sm bg-white p-2 rounded border italic text-gray-700">
                         &quot;{query}&quot;
                       </div>
                     ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex items-center space-x-3">
              <Button 
                onClick={createNewConversation}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Start Enhanced Chat
              </Button>
              {conversationId && (
                <Badge variant="outline" className="px-3 py-1 border-blue-300">
                  Session: {conversationId.slice(-8)}
                </Badge>
              )}
              <Badge variant="outline" className="px-3 py-1 border-green-300">
                Workspace: {workspaceId.slice(-9)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chat Interface */}
      <div className="max-w-7xl mx-auto">
        <div className="h-[calc(100vh-300px)]">
          <HuggingFaceChatInterface
            conversationId={conversationId}
            workspaceId={workspaceId}
            onFileUpload={handleFileUpload}
            className="h-full shadow-xl border-2 border-gray-200"
          />
        </div>
      </div>

      {/* Feature Details */}
      <div className="max-w-7xl mx-auto mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Terminal className="w-5 h-5 mr-2 text-green-600" />
                Function Calling Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-blue-500" />
                <span><strong>Code Execution:</strong> Run JavaScript, Python, Bash</span>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-green-500" />
                <span><strong>File Operations:</strong> Create, list, manage files</span>
              </div>
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-orange-500" />
                <span><strong>Package Management:</strong> Install npm, pip packages</span>
              </div>
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-purple-500" />
                <span><strong>Web Search:</strong> Real-time information retrieval</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Bot className="w-5 h-5 mr-2 text-orange-600" />
                AI Model Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="space-y-1">
                <div><strong>🤗 Hugging Face Models:</strong></div>
                <div className="text-xs text-gray-600 pl-4">
                  • DialoGPT Medium/Large<br/>
                  • BlenderBot 400M<br/>
                  • GODEL Large<br/>
                  • FLAN-T5 Large
                </div>
              </div>
              <div className="space-y-1">
                <div><strong>🚀 OpenRouter Models:</strong></div>
                <div className="text-xs text-gray-600 pl-4">
                  • Claude 3.5 Sonnet<br/>
                  • GPT-4o<br/>
                  • Llama 3.1 405B<br/>
                  • Gemini Pro 1.5
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}