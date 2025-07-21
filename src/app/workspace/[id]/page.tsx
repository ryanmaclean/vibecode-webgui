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
import { AIChatInterface } from '@/components/ai/AIChatInterface'

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
    const loadWorkspace = async () => {
      try {
        // Try to get real workspace info from the session API
        const response = await fetch(`/api/code-server/session?workspaceId=${workspaceId}`)
        
        if (response.ok) {
          const data = await response.json()
          const session = data.sessions?.[0]
          
          if (session) {
            const realWorkspace: WorkspaceInfo = {
              id: workspaceId,
              name: `VibeCode ${workspaceId}`,
              status: session.status === 'ready' ? 'running' : 'starting',
              url: session.url,
              lastActive: new Date(session.last_active * 1000).toLocaleString(),
              resources: {
                cpu: '1 vCPU',
                memory: '2 GB',
                storage: '10 GB',
              },
              gitRepo: 'github.com/vibecode/platform',
              branch: 'main',
              language: 'TypeScript',
            }
            setWorkspace(realWorkspace)
          } else {
            throw new Error('Workspace session not found')
          }
        } else {
          throw new Error('Failed to fetch workspace session')
        }
      } catch (error) {
        console.warn('Failed to fetch real workspace, using mock data:', error)
        // Fallback to mock data if API fails
        setWorkspace({
          id: workspaceId,
          name: `VibeCode ${workspaceId}`,
          status: 'running',
          url: `http://localhost:8080/?folder=/home/coder/project/${workspaceId}`,
          lastActive: '5 minutes ago',
          resources: {
            cpu: '2 vCPU',
            memory: '4 GB',
            storage: '20 GB',
          },
          gitRepo: 'github.com/vibecode/platform',
          branch: 'feature/ai-chat',
          language: 'TypeScript',
        })
      }
      setIsLoading(false)
    }

    loadWorkspace()
  }, [workspaceId])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <Sparkles className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold">Loading Your VibeCode Workspace...</h2>
          <p className="text-gray-400">Please wait while we set up your coding environment.</p>
        </div>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <h2 className="text-2xl font-bold">Workspace not found.</h2>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between p-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">{workspace.name}</h1>
          <Badge variant={workspace.status === 'running' ? 'default' : 'destructive'}>
            {workspace.status}
          </Badge>
          <div className="flex items-center text-sm text-gray-400">
            <GitBranch className="w-4 h-4 mr-2" />
            <span>{workspace.branch}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col">
          <TabsList className="bg-gray-800 border-b border-gray-700 rounded-none">
            <TabsTrigger value="integrated">
              <Sparkles className="w-4 h-4 mr-2" />
              Vibe
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Bot className="w-4 h-4 mr-2" />
              AI Chat
            </TabsTrigger>
            <TabsTrigger value="code">
              <Code className="w-4 h-4 mr-2" />
              Code Editor
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="integrated" className="h-full m-0">
              {/* The magical vibe coding experience */}
              <VSCodeIntegration
                workspaceId={workspaceId}
                codeServerUrl={workspace.url}
                isEmbedded={true}
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
