/**
 * Collaborative Workspace Component
 * Real-time collaborative workspace with multiple users and shared projects
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UsersIcon,
  UserPlusIcon,
  ChatBubbleLeftIcon,
  FolderIcon,
  CodeBracketIcon,
  PlayIcon,
  CogIcon,
  ShareIcon,
  CursorArrowRaysIcon,
  EyeIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { logger } from '@/lib/logger';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  isActive: boolean;
  role: 'owner' | 'collaborator' | 'viewer';
  lastSeen: Date;
  cursor?: {
    x: number;
    y: number;
    file?: string;
  };
}

interface WorkspaceActivity {
  id: string;
  type: 'user_joined' | 'user_left' | 'file_opened' | 'file_edited' | 'project_created' | 'terminal_command';
  userId: string;
  userName: string;
  timestamp: Date;
  data?: {
    file?: string;
    project?: string;
    command?: string;
    message?: string;
  };
}

interface CollaborativeWorkspaceProps {
  workspaceId?: string;
  userId?: string;
  userName?: string;
  initialProject?: {
    id: string;
    name: string;
    files: Array<{
      name: string;
      path: string;
      content: string;
      language: string;
    }>;
  };
  onUserInvite?: () => void;
  onProjectCreate?: (project: any) => void;
  onFileOpen?: (file: string) => void;
  onFileEdit?: (file: string, content: string) => void;
  className?: string;
}

export function CollaborativeWorkspace({
  workspaceId = 'default-workspace',
  userId = 'current-user',
  userName = 'Current User',
  initialProject,
  onUserInvite,
  onProjectCreate,
  onFileOpen,
  onFileEdit,
  className = ''
}: CollaborativeWorkspaceProps) {
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [workspaceActivity, setWorkspaceActivity] = useState<WorkspaceActivity[]>([]);
  const [selectedProject, setSelectedProject] = useState(initialProject || null);
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    userId: string;
    userName: string;
    message: string;
    timestamp: Date;
  }>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  // Initialize workspace
  useEffect(() => {
    initializeWorkspace();
  }, [workspaceId]);

  const initializeWorkspace = async () => {
    // Initialize current user
    const currentUser: User = {
      id: userId,
      name: userName,
      email: `${userName.toLowerCase()}@example.com`,
      color: '#1f75cb',
      isActive: true,
      role: 'owner',
      lastSeen: new Date()
    };

    setActiveUsers([currentUser]);

    // Initialize activity feed
    const initialActivity: WorkspaceActivity = {
      id: 'activity-1',
      type: 'user_joined',
      userId: userId,
      userName: userName,
      timestamp: new Date(),
      data: { message: 'joined the workspace' }
    };

    setWorkspaceActivity([initialActivity]);

    // Load workspace data
    await loadWorkspaceData();
  };

  const loadWorkspaceData = async () => {
    // This would integrate with your workspace service
    // For now, simulate loading
    logger.info('Loading workspace data for:', workspaceId);
  };

  const handleTemplateSelect = async (template: any) => {
    const templateId = template.id;
    const projectName = `project-${Date.now()}`;

    try {
      // Generate project from template
      const project = await generateProjectFromTemplate(template.id, {
        name: projectName,
        workspaceId,
        settings: {
          includeTests: true,
          includeDocs: true,
          packageManager: 'npm'
        }
      });

      // Add workspace-specific metadata
      const workspaceProject = {
        ...project,
        id: `${workspaceId}-${templateId}-${Date.now()}`,
        createdAt: new Date(),
        category: (templateId.split('-')[0] || 'data') as 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'data' | 'infrastructure',
        workspaceId,
        collaborators: [userId]
      };

      setSelectedProject(workspaceProject);

      // Add activity
      const activity: WorkspaceActivity = {
        id: `activity-${Date.now()}`,
        type: 'project_created',
        userId,
        userName,
        timestamp: new Date(),
        data: { project: project.name }
      };

      setWorkspaceActivity(prev => [activity, ...prev]);

      onProjectCreate?.(workspaceProject);
    } catch (error) {
      logger.error('Failed to create project:', error);
    }
  };

  const generateProjectFromTemplate = async (templateId: string, config: any) => {
    // This would integrate with your project generation service
    // For now, return mock project
    return {
      id: `project-${Date.now()}`,
      name: config.name,
      templateId,
      files: [
        {
          name: 'package.json',
          path: 'package.json',
          content: JSON.stringify({
            name: config.name,
            version: '1.0.0',
            dependencies: {}
          }, null, 2),
          language: 'json'
        }
      ]
    };
  };

  const handleFileOpen = (filePath: string) => {
    setOpenFiles(prev => new Set([...prev, filePath]));
    setActiveFile(filePath);

    // Add activity
    const activity: WorkspaceActivity = {
      id: `activity-${Date.now()}`,
      type: 'file_opened',
      userId,
      userName,
      timestamp: new Date(),
      data: { file: filePath }
    };

    setWorkspaceActivity(prev => [activity, ...prev]);
    onFileOpen?.(filePath);
  };

  const handleFileEdit = (filePath: string, content: string) => {
    // Add activity
    const activity: WorkspaceActivity = {
      id: `activity-${Date.now()}`,
      type: 'file_edited',
      userId,
      userName,
      timestamp: new Date(),
      data: { file: filePath }
    };

    setWorkspaceActivity(prev => [activity, ...prev]);
    onFileEdit?.(filePath, content);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: `msg-${Date.now()}`,
      userId,
      userName,
      message: newMessage,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, message]);
    setNewMessage('');

    // Add activity
    const activity: WorkspaceActivity = {
      id: `activity-${Date.now()}`,
      type: 'terminal_command', // Using existing type for chat
      userId,
      userName,
      timestamp: new Date(),
      data: { command: newMessage }
    };

    setWorkspaceActivity(prev => [activity, ...prev]);
  };

  const handleUserInvite = () => {
    onUserInvite?.();
  };

  const getUserActivityColor = (userId: string): string => {
    const colors = [
      '#ef4444', '#f97316', '#eab308', '#22c55e',
      '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
    ];
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  return (
    <div className={`flex h-full bg-gray-50 ${className}`}>
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Workspace Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Workspace</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowChat(!showChat)}
                className={`p-2 rounded-md transition-colors ${
                  showChat ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'
                }`}
              >
                <ChatBubbleLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowActivity(!showActivity)}
                className={`p-2 rounded-md transition-colors ${
                  showActivity ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:bg-gray-100'
                }`}
              >
                <CursorArrowRaysIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Active Users */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Active Users</h3>
              <button
                onClick={handleUserInvite}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <UserPlusIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {activeUsers.map(user => (
                <div key={user.id} className="flex items-center space-x-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.name}
                    </p>
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${
                        user.isActive ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <p className="text-xs text-gray-500">
                        {user.role}
                      </p>
                    </div>
                  </div>
                  {user.cursor && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Project Files */}
          {selectedProject && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Project Files</h3>
              <div className="space-y-1">
                {selectedProject.files.map((file, index) => (
                  <button
                    key={index}
                    onClick={() => handleFileOpen(file.path)}
                    className={`w-full flex items-center space-x-2 p-2 rounded-md text-left transition-colors ${
                      activeFile === file.path
                        ? 'bg-blue-100 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <CodeBracketIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">{file.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        {showActivity && (
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Activity</h3>
            <div className="space-y-3">
              {workspaceActivity.map(activity => (
                <div key={activity.id} className="flex items-start space-x-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: getUserActivityColor(activity.userId) }}
                  >
                    {activity.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.userName}</span>
                      {' '}
                      {activity.type === 'user_joined' && 'joined the workspace'}
                      {activity.type === 'file_opened' && `opened ${activity.data?.file}`}
                      {activity.type === 'file_edited' && `edited ${activity.data?.file}`}
                      {activity.type === 'project_created' && `created project ${activity.data?.project}`}
                      {activity.type === 'terminal_command' && `ran: ${activity.data?.command}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activity.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {showChat && (
          <div className="flex-1 flex flex-col border-t border-gray-200">
            <div className="p-3 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">Team Chat</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map(message => (
                <div key={message.id} className="flex items-start space-x-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                    style={{ backgroundColor: getUserActivityColor(message.userId) }}
                  >
                    {message.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {message.userName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{message.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSendMessage}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Content Header */}
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {selectedProject ? selectedProject.name : 'Collaborative Workspace'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {activeUsers.length} active user{activeUsers.length !== 1 ? 's' : ''}
                {selectedProject && ` • ${selectedProject.files.length} files`}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {activeFile && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <PencilIcon className="h-4 w-4" />
                  <span>Editing: {activeFile}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* File Editor Area */}
        <div className="flex-1 p-4">
          {selectedProject ? (
            <div className="h-full bg-white rounded-lg border border-gray-200 p-4">
              {activeFile ? (
                <div className="h-full">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">{activeFile}</h3>
                    <div className="flex items-center space-x-2">
                      <button className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
                        Save
                      </button>
                    </div>
                  </div>
                  <div className="h-full bg-gray-900 rounded-lg p-4">
                    <pre className="text-sm text-gray-300 h-full overflow-auto">
                      {selectedProject.files.find(f => f.path === activeFile)?.content || 'File content would be displayed here...'}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <FolderIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Select a file to start editing
                    </h3>
                    <p className="text-gray-600">
                      Choose a file from the sidebar to begin collaborative editing
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <UsersIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome to Collaborative Workspace
                </h2>
                <p className="text-gray-600 mb-6 max-w-md">
                  Create a new project or invite team members to start collaborating in real-time.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={handleUserInvite}
                    className="w-full max-w-xs mx-auto flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <UserPlusIcon className="h-5 w-5 mr-2" />
                    Invite Team Members
                  </button>
                  <p className="text-sm text-gray-500">
                    Start by inviting collaborators to your workspace
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating User Cursors */}
      {activeUsers.filter(user => user.id !== userId && user.cursor).map(user => (
        <div
          key={user.id}
          className="fixed pointer-events-none z-50 transition-all duration-100"
          style={{
            left: user.cursor!.x,
            top: user.cursor!.y,
            transform: 'translate(-2px, -2px)'
          }}
        >
          <div
            className="w-4 h-4 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs font-medium text-white"
            style={{ backgroundColor: user.color }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div
            className="absolute top-full left-0 mt-1 px-2 py-1 text-xs text-white rounded whitespace-nowrap"
            style={{ backgroundColor: user.color }}
          >
            {user.name}
          </div>
        </div>
      ))}
    </div>
  );
}
