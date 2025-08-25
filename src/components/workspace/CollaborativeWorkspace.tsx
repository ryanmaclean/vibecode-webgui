/**
 * Comprehensive collaborative workspace component
 * Integrates marketplace, real-time collaboration, and deployment features
 */

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCollaboration } from '@/hooks/useCollaboration'
import { TemplateMarketplace } from '@/components/marketplace/TemplateMarketplace'
import { type MarketplaceTemplate } from '@/lib/marketplace/template-marketplace'
import { GitHubDeploymentWorkflow } from '@/components/deployment/GitHubDeploymentWorkflow'
import CollaborativeChatInterface from '@/components/chat/CollaborativeChatInterface'
import { 
  generateFromTemplate, 
  type GeneratedProject,
  type GenerateFromTemplateOptions
} from '@/lib/templates/generator'
import {
  UsersIcon,
  ChatBubbleLeftRightIcon,
  RocketLaunchIcon,
  CodeBracketIcon,
  ShareIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  Cog6ToothIcon,
  FolderOpenIcon,
  CommandLineIcon,
  BugAntIcon,
  PhoneIcon,
  PhoneXMarkIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  MicrophoneIcon,
  UserPlusIcon,
  PencilIcon
} from '@heroicons/react/24/outline'

interface CollaborativeWorkspaceProps {
  workspaceId?: string
  userId?: string
  userName?: string
  initialProject?: GeneratedProject
  onUserInvite?: () => void
  onCreateTerminal?: () => void
  onCreateDebugSession?: () => void
  className?: string
}

interface WorkspaceActivityData {
  templateId?: string
  projectName?: string
  message?: string
  deploymentUrl?: string
  userRole?: string
}

interface WorkspaceActivity {
  id: string
  type: 'template_selected' | 'project_generated' | 'deployment_started' | 'user_joined' | 'message_sent'
  userId: string
  userName: string
  timestamp: Date
  data?: WorkspaceActivityData
}

interface TeamMember {
  id: string
  name: string
  avatar?: string
  color: string
  isActive: boolean
  role: 'owner' | 'collaborator' | 'viewer'
  joinedAt: Date
}

export function CollaborativeWorkspace({
  workspaceId: initialWorkspaceId,
  userId: initialUserId,
  userName: initialUserName,
  initialProject,
  onUserInvite,
  onCreateTerminal,
  onCreateDebugSession,
  className
}: CollaborativeWorkspaceProps) {
  const [workspaceId] = useState(initialWorkspaceId || `workspace-${Date.now()}`)
  const [userId] = useState(initialUserId || `user-${Math.random().toString(36).substr(2, 9)}`)
  const [userName] = useState(initialUserName || `User-${Math.random().toString(36).substr(2, 4)}`)
  const [activeTab, setActiveTab] = useState<'templates' | 'chat' | 'deploy' | 'users' | 'terminals' | 'debug'>('templates')
  const [selectedProject, setSelectedProject] = useState<GeneratedProject | null>(initialProject || null)
  const [showDeployment, setShowDeployment] = useState(false)
  const [workspaceActivity, setWorkspaceActivity] = useState<WorkspaceActivity[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [conversationId, setConversationId] = useState<string>()
  const [isGeneratingProject, setIsGeneratingProject] = useState(false)
  const [isVoiceConnected, setIsVoiceConnected] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isMicEnabled, setIsMicEnabled] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const {
    isConnected,
    connectionError,
    activeUsers,
    socket
  } = useCollaboration({
    workspaceId,
    conversationId,
    userId,
    userName,
    enabled: true
  })

  // Initialize team members from active users
  useEffect(() => {
    const members = activeUsers.map(user => ({
      id: user.id,
      name: user.name,
      color: user.color,
      isActive: user.isActive,
      role: (user.id === userId ? 'owner' : 'collaborator') as 'owner' | 'collaborator' | 'viewer',
      joinedAt: new Date()
    }))
    setTeamMembers(members)
  }, [activeUsers, userId])

  // Handle template selection and project generation
  const handleTemplateSelect = async (template: MarketplaceTemplate) => {
    const templateId = template.id
    setIsGeneratingProject(true)
    
    try {
      const options: GenerateFromTemplateOptions = {
        projectName: `${templateId}-project`,
        template: templateId,
        customizations: {
          description: `Generated from ${templateId} template in collaborative workspace`,
          author: userName
        }
      }

      const project = await generateFromTemplate(options)
      
      // Add workspace-specific metadata
      const workspaceProject: GeneratedProject = {
        ...project,
        id: `${workspaceId}-${templateId}-${Date.now()}`,
        createdAt: new Date(),
        category: templateId.split('-')[0] || 'general',
        complexity: 'intermediate' as const,
        tags: [templateId, 'collaborative'],
        estimatedTime: 30,
        features: [],
        documentation: {
          readme: `# ${project.name}\n\nGenerated in collaborative workspace`,
          setup: 'Run npm install && npm run dev',
          deployment: 'Deploy using the integrated GitHub workflow'
        }
      }

      setSelectedProject(workspaceProject)
      
      // Broadcast to workspace
      if (socket) {
        socket.emit('workspace_event', {
          type: 'template_selected',
          templateId,
          projectName: workspaceProject.name,
          userId,
          userName
        })
      }

      // Add to activity feed
      addActivity({
        type: 'template_selected',
        userId,
        userName,
        data: { templateId, projectName: workspaceProject.name }
      })

      // Auto-switch to chat tab for collaboration
      setActiveTab('chat')

    } catch (error) {
      console.error('Failed to generate project:', error)
    } finally {
      setIsGeneratingProject(false)
    }
  }

  const handleDeploymentStart = () => {
    if (!selectedProject) return
    
    setShowDeployment(true)
    setActiveTab('deploy')
    
    addActivity({
      type: 'deployment_started',
      userId,
      userName,
      data: { projectName: selectedProject.name }
    })
  }

  const addActivity = (activity: Omit<WorkspaceActivity, 'id' | 'timestamp'>) => {
    const newActivity: WorkspaceActivity = {
      ...activity,
      id: `activity-${Date.now()}`,
      timestamp: new Date()
    }
    setWorkspaceActivity(prev => [newActivity, ...prev].slice(0, 20))
  }

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
          title: `Workspace Collaboration - ${workspaceId.slice(-8)}`,
          sessionId: `workspace-${workspaceId}`,
          model: 'anthropic/claude-3.5-sonnet',
          workspaceId
        })
      })

      const data = await response.json()
      if (data.success && data.conversation) {
        setConversationId(data.conversation.id)
      }
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  const shareWorkspace = () => {
    const shareUrl = `${window.location.origin}/workspace/collaborative?id=${workspaceId}`
    navigator.clipboard.writeText(shareUrl)
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString()
  }


  const renderSidebar = () => (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Workspace Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Workspace</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <Badge variant={isConnected ? 'secondary' : 'destructive'} className="text-xs">
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        </div>
        
        <div className="text-sm text-gray-600 mb-3">
          ID: {workspaceId.slice(-12)}
        </div>

        <Button
          onClick={shareWorkspace}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <ShareIcon className="w-4 h-4 mr-2" />
          Share Workspace
        </Button>
      </div>

      {/* Team Members */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
          <UsersIcon className="w-4 h-4 mr-2" />
          Team ({teamMembers.length})
        </h3>
        <div className="space-y-2">
          {teamMembers.map((member) => (
            <div key={member.id} className="flex items-center space-x-3">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: member.color }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {member.name}
                  {member.id === userId && ' (You)'}
                </div>
                <div className="text-xs text-gray-500 capitalize">{member.role}</div>
              </div>
              {member.isActive && (
                <div className="w-2 h-2 bg-green-400 rounded-full" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="flex-1 p-4 overflow-y-auto">
        <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
          <ClockIcon className="w-4 h-4 mr-2" />
          Recent Activity
        </h3>
        <div className="space-y-3">
          {workspaceActivity.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4">
              No activity yet. Start by selecting a template!
            </div>
          ) : (
            workspaceActivity.map((activity) => (
              <div key={activity.id} className="text-sm">
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {activity.type === 'template_selected' && <FolderOpenIcon className="w-4 h-4 text-blue-500" />}
                    {activity.type === 'deployment_started' && <RocketLaunchIcon className="w-4 h-4 text-green-500" />}
                    {activity.type === 'user_joined' && <UsersIcon className="w-4 h-4 text-purple-500" />}
                    {activity.type === 'message_sent' && <ChatBubbleLeftRightIcon className="w-4 h-4 text-orange-500" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-gray-900">
                      <span className="font-medium">{activity.userName}</span>
                      {activity.type === 'template_selected' && ' selected template'}
                      {activity.type === 'deployment_started' && ' started deployment'}
                      {activity.type === 'user_joined' && ' joined workspace'}
                      {activity.type === 'message_sent' && ' sent a message'}
                    </div>
                    {activity.data && (
                      <div className="text-gray-600 text-xs mt-1">
                        {activity.data.templateId || activity.data.projectName || activity.data.message}
                      </div>
                    )}
                    <div className="text-gray-500 text-xs mt-1">
                      {formatTimeAgo(activity.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )

  const renderMainContent = () => (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Collaborative Workspace</h1>
            <p className="text-gray-600">
              {selectedProject ? `Working on: ${selectedProject.name}` : 'Choose a template to get started'}
            </p>
          </div>
          
          {selectedProject && (
            <div className="flex items-center space-x-3">
              <Button
                onClick={handleDeploymentStart}
                className="bg-green-600 hover:bg-green-700"
              >
                <RocketLaunchIcon className="w-4 h-4 mr-2" />
                Deploy Project
              </Button>
              
              {!conversationId && (
                <Button
                  onClick={createNewConversation}
                  variant="outline"
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4 mr-2" />
                  Start Chat
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content Tabs */}
      <div className="flex-1 bg-gray-50">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="h-full">
          <TabsList className="border-b border-gray-200 bg-white">
            <TabsTrigger value="templates" className="flex items-center space-x-2">
              <FolderOpenIcon className="w-4 h-4" />
              <span>Templates</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center space-x-2">
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
              <span>Team Chat</span>
              {conversationId && <Badge variant="secondary" className="ml-1">Active</Badge>}
            </TabsTrigger>
            <TabsTrigger value="deploy" className="flex items-center space-x-2">
              <RocketLaunchIcon className="w-4 h-4" />
              <span>Deploy</span>
              {selectedProject && <Badge variant="secondary" className="ml-1">Ready</Badge>}
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <UsersIcon className="w-4 h-4" />
              <span>Users</span>
            </TabsTrigger>
            <TabsTrigger value="terminals" className="flex items-center space-x-2">
              <CommandLineIcon className="w-4 h-4" />
              <span>Terminals</span>
            </TabsTrigger>
            <TabsTrigger value="debug" className="flex items-center space-x-2">
              <BugAntIcon className="w-4 h-4" />
              <span>Debug</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="h-full p-6">
            {isGeneratingProject ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Generating project from template...</p>
                </div>
              </div>
            ) : (
              <TemplateMarketplace
                onSelectTemplate={handleTemplateSelect}
              />
            )}
          </TabsContent>

          <TabsContent value="chat" className="h-full">
            {conversationId ? (
              <CollaborativeChatInterface
                conversationId={conversationId}
                workspaceId={workspaceId}
                userId={userId}
                userName={userName}
                className="h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Chat</h3>
                  <p className="text-gray-600 mb-4">Start a conversation with your team</p>
                  <Button onClick={createNewConversation}>
                    Start Team Chat
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="deploy" className="h-full">
            {selectedProject && showDeployment ? (
              <GitHubDeploymentWorkflow
                project={selectedProject}
                onDeploymentComplete={(result) => {
                  console.log('Deployment completed:', result)
                  setShowDeployment(false)
                }}
                onClose={() => setShowDeployment(false)}
              />
            ) : selectedProject ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <RocketLaunchIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Deploy</h3>
                  <p className="text-gray-600 mb-4">
                    Deploy {selectedProject.name} to the cloud with GitHub integration
                  </p>
                  <Button onClick={handleDeploymentStart} className="bg-green-600 hover:bg-green-700">
                    Start Deployment
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <CodeBracketIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Project Selected</h3>
                  <p className="text-gray-600 mb-4">Choose a template first to enable deployment</p>
                  <Button onClick={() => setActiveTab('templates')} variant="outline">
                    Browse Templates
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-4 p-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UsersIcon className="h-5 w-5" />
                  Connected Users ({teamMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center space-x-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {member.name}
                              {member.id === userId && ' (You)'}
                            </p>
                          </div>
                          <div className="text-xs text-gray-500 capitalize">{member.role}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {member.role}
                          </Badge>
                          {member.isActive && (
                            <div className="w-2 h-2 bg-green-400 rounded-full" />
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {teamMembers.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        <UsersIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No other users in this workspace</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terminals" className="space-y-4 p-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Shared Terminals</CardTitle>
                  <Button onClick={onCreateTerminal} size="sm">
                    <CommandLineIcon className="h-4 w-4 mr-1" />
                    New Terminal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center text-gray-500 py-8">
                  <CommandLineIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No shared terminals</p>
                  <p className="text-xs">Create a terminal to collaborate</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="debug" className="space-y-4 p-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Debug Sessions</CardTitle>
                  <Button onClick={onCreateDebugSession} size="sm">
                    <BugAntIcon className="h-4 w-4 mr-1" />
                    New Session
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center text-gray-500 py-8">
                  <BugAntIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No debug sessions</p>
                  <p className="text-xs">Start debugging to collaborate</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )

  return (
    <div className="h-screen flex bg-gray-50">
      {renderSidebar()}
      {renderMainContent()}
    </div>
  )
}

export default CollaborativeWorkspace