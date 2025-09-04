/**
 * Comprehensive collaborative workspace component
 * Integrates marketplace, real-time collaboration, and deployment features
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCollaboration } from '@/hooks/useCollaboration'
import { TemplateMarketplace } from '@/components/marketplace/TemplateMarketplace'
import { type MarketplaceTemplate } from '@/lib/marketplace/template-marketplace'
import { type GeneratedProject } from '@/lib/templates/generator'
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

export function CollaborativeWorkspace({
  workspaceId,
  userId,
  userName,
  initialProject,
  onCreateTerminal,
  onCreateDebugSession
}: CollaborativeWorkspaceProps) {
  const [isGeneratingProject, setIsGeneratingProject] = useState(false)
  const [activeTab, setActiveTab] = useState('templates')
  const [showDeployment, setShowDeployment] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [workspaceActivity, setWorkspaceActivity] = useState<WorkspaceActivity[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)

  const {
    activeUsers,
    isConnected,
    socket
  } = useCollaboration({
    workspaceId,    userId,
    userName,
    enabled: true
  })

  // Initialize team members from active users
  useEffect(() => {
    const members = activeUsers.map(user => ({
      id: user.id,
      name: user.name,
      color: user.color || '#1f75cb', // Provide a default color if undefined
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
      // Generate project from template
      const project = await generateFromTemplate(template.id, {
        name: `project-${Date.now()}`,
        description: template.description || 'Generated from template'
      })
      
      // Add workspace-specific metadata
      const workspaceProject: GeneratedProject = {
        ...project,
        id: `${workspaceId}-${templateId}-${Date.now()}`,
        createdAt: new Date(),
        category: (templateId.split('-')[0] || 'data') as 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'data' | 'infrastructure',
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

  // Initialize conversation for chat
  useEffect(() => {
    if (!conversationId) {
      setConversationId(`workspace-${workspaceId}-${Date.now()}`)
    }
  }, [conversationId, workspaceId])

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Collaborative Workspace</h1>
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Team members */}
            <div className="flex items-center space-x-2">
              <UsersIcon className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-600">{teamMembers.length} members</span>
              <div className="flex -space-x-2">
                {teamMembers.slice(0, 3).map((member) => (
                  <div
                    key={member.id}
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
                    style={{ backgroundColor: member.color }}
                    title={member.name}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {teamMembers.length > 3 && (
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-xs font-medium text-white">
                    +{teamMembers.length - 3}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Activity Feed</h2>
          </div>
          <ScrollArea className="flex-1 p-4">
            {workspaceActivity.length === 0 ? (
              <p className="text-sm text-gray-500">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {workspaceActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.message}</p>
                      <p className="text-xs text-gray-500">
                        {activity.userName} • {activity.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Main workspace */}
        <div className="flex-1 flex flex-col">
          {selectedProject ? (
            <div className="flex-1 flex flex-col">
              {/* Project header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedProject.name}</h2>
                    <p className="text-sm text-gray-600">{selectedProject.description}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('chat')}
                    >
                      <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
                      Chat
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeployment(true)}
                    >
                      <RocketLaunchIcon className="h-4 w-4 mr-2" />
                      Deploy
                    </Button>
                  </div>
                </div>
              </div>

              {/* Project content */}
              <div className="flex-1 p-6">
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <CodeBracketIcon className="h-5 w-5 mr-2" />
                        Files
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedProject.files.map((file, index) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            <FolderOpenIcon className="h-4 w-4 text-gray-400" />
                            <span>{file.path}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Cog6ToothIcon className="h-5 w-5 mr-2" />
                        Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={onCreateTerminal}
                        >
                          <CommandLineIcon className="h-4 w-4 mr-2" />
                          Open Terminal
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={onCreateDebugSession}
                        >
                          <BugAntIcon className="h-4 w-4 mr-2" />
                          Debug Session
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="bg-white border-b border-gray-200 px-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="templates">Templates</TabsTrigger>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="templates" className="flex-1 p-6">
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

              <TabsContent value="chat" className="flex-1">
                {conversationId ? (
                  <CollaborativeChatInterface
                    conversationId={conversationId}
                    workspaceId={workspaceId}
                    userId={userId}
                    userName={userName}
                  />
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-gray-500">Initializing chat...</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
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
      {renderMainContent()}    </div>
  )
}