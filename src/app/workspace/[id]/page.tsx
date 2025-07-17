/**
 * Workspace page for VibeCode WebGUI - Enhanced with AI Chat Integration
 * Provides a complete vibe coding experience with AI assistance
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Code,
  MessageSquare,
  Upload,
  Settings,
  Play,
  GitBranch,
  Terminal,
  Folders,
  Bot,
  Sparkles
} from 'lucide-react'
import VSCodeIntegration from '@/components/ai/VSCodeIntegration'
import AIChatInterface from '@/components/ai/AIChatInterface'

interface WorkspaceInfo {
  id: string
  name: string
  status: 'running' | 'stopped' | 'starting'
  url: string
  lastActive: string
  resources: {
    cpu: string
    memory: string
    storage: string
  }
  gitRepo?: string
  branch?: string
  language?: string
}

export default function WorkspacePage() {
  const params = useParams()
  const workspaceId = params.id as string

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [activeTab, setActiveTab] = useState('integrated') // Start with AI+Code view
  const [isLoading, setIsLoading] = useState(true)

  // Load workspace data
  useEffect(() => {
    const mockWorkspace: WorkspaceInfo = {
      id: workspaceId,
      name: `VibeCode ${workspaceId}`,
      status: 'running',
      url: `http://localhost:8080`, // Use local code-server for now
      lastActive: new Date().toISOString(),
      resources: {
        cpu: '50%',
        memory: '1.2GB',
        storage: '8.5GB'
      },
      gitRepo: 'https://github.com/user/my-project',
      branch: 'main',
      language: 'TypeScript'
    }

    setTimeout(() => {
      setWorkspace(mockWorkspace)
      setIsLoading(false)
    }, 1000)
  }, [workspaceId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your vibe coding workspace...</p>
        </div>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Workspace Not Found</h1>
          <p className="text-gray-600">The requested workspace could not be loaded.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {workspace.name}
                </h1>
                <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                  <Badge variant={workspace.status === 'running' ? 'default' : 'secondary'}>
                    {workspace.status}
                  </Badge>
                  <span className="flex items-center">
                    <Bot className="w-3 h-3 mr-1" />
                    AI Enhanced
                  </span>
                  {workspace.language && (
                    <span className="flex items-center">
                      <Code className="w-3 h-3 mr-1" />
                      {workspace.language}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right text-sm text-gray-500 dark:text-gray-400">
              <div>CPU: {workspace.resources.cpu}</div>
              <div>Memory: {workspace.resources.memory}</div>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <TabsList className="h-12 w-full justify-start rounded-none bg-transparent p-0">
              <TabsTrigger
                value="integrated"
                className="flex items-center space-x-2 h-12 px-6 data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-900/20 data-[state=active]:text-blue-600"
              >
                <Sparkles className="w-4 h-4" />
                <span>Vibe Code (AI + Editor)</span>
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="flex items-center space-x-2 h-12 px-6 data-[state=active]:bg-gray-50 dark:data-[state=active]:bg-gray-700"
              >
                <Bot className="w-4 h-4" />
                <span>AI Chat</span>
              </TabsTrigger>
              <TabsTrigger
                value="code"
                className="flex items-center space-x-2 h-12 px-6 data-[state=active]:bg-gray-50 dark:data-[state=active]:bg-gray-700"
              >
                <Code className="w-4 h-4" />
                <span>Code Only</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="integrated" className="h-full m-0">
              {/* The magical vibe coding experience */}
              <VSCodeIntegration
                workspaceId={workspaceId}
                codeServerUrl={workspace.url}
                isEmbedded={false}
                className="h-full"
              />
            </TabsContent>

            <TabsContent value="ai" className="h-full m-0">
              {/* AI-only view for pure conversation */}
              <div className="h-full p-6">
                <div className="max-w-4xl mx-auto h-full">
                  <AIChatInterface
                    workspaceId={workspaceId}
                    className="h-full"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="code" className="h-full m-0">
              {/* Traditional code-only view */}
              <iframe
                src={workspace.url}
                className="w-full h-full border-0"
                title="VS Code"
                allow="clipboard-read; clipboard-write"
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Quick Actions Floating Panel */}
      <div className="fixed bottom-6 left-6 z-40">
        <Card className="shadow-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardContent className="p-3">
            <div className="flex space-x-2">
              <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-white/20">
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </Button>
              <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-white/20">
                <MessageSquare className="w-4 h-4 mr-2" />
                Quick Chat
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
