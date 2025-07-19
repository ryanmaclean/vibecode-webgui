/**
 * Collaborative Workspace Component
 * Real-time collaboration features for VibeCode workspaces
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Users, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Share, 
  MessageSquare, 
  Terminal, 
  Bug, 
  Phone,
  PhoneOff,
  Settings,
  UserPlus,
  Crown,
  Eye,
  Edit3,
  Circle
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { CollaborationUser, TerminalSession, DebugSession } from '@/lib/collaboration/workspace-collaboration';

interface CollaborativeWorkspaceProps {
  workspaceId: string;
  onUserInvite?: () => void;
  onCreateTerminal?: () => void;
  onCreateDebugSession?: () => void;
  className?: string;
}

interface UserPresence {
  user: CollaborationUser;
  isTyping: boolean;
  currentFile?: string;
  cursorPosition?: {
    line: number;
    column: number;
  };
}

export default function CollaborativeWorkspace({
  workspaceId,
  onUserInvite,
  onCreateTerminal,
  onCreateDebugSession,
  className
}: CollaborativeWorkspaceProps) {
  const { data: session } = useSession();
  const [connectedUsers, setConnectedUsers] = useState<UserPresence[]>([]);
  const [sharedTerminals, setSharedTerminals] = useState<TerminalSession[]>([]);
  const [debugSessions, setDebugSessions] = useState<DebugSession[]>([]);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeChat, setActiveChat] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!session?.user?.id) return;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'}/collaboration/${workspaceId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to collaboration server');
      // Join workspace
      ws.send(JSON.stringify({
        type: 'join_workspace',
        data: {
          userId: session.user.id,
          user: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            avatar: session.user.image,
            role: 'editor', // This would come from workspace permissions
            status: 'online'
          }
        }
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleCollaborationMessage(message);
    };

    ws.onclose = () => {
      console.log('Disconnected from collaboration server');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'leave_workspace',
          data: { userId: session.user.id }
        }));
      }
      ws.close();
    };
  }, [workspaceId, session?.user?.id]);

  const handleCollaborationMessage = (message: any) => {
    switch (message.type) {
      case 'user_joined':
        handleUserJoined(message.data);
        break;
      case 'user_left':
        handleUserLeft(message.data);
        break;
      case 'user_updated':
        handleUserUpdated(message.data);
        break;
      case 'cursor_moved':
        handleCursorMoved(message.data);
        break;
      case 'file_changed':
        handleFileChanged(message.data);
        break;
      case 'terminal_created':
        handleTerminalCreated(message.data);
        break;
      case 'debug_session_created':
        handleDebugSessionCreated(message.data);
        break;
      case 'voice_call_started':
        handleVoiceCallStarted(message.data);
        break;
    }
  };

  const handleUserJoined = (data: { user: CollaborationUser }) => {
    setConnectedUsers(prev => {
      const existing = prev.find(u => u.user.id === data.user.id);
      if (existing) {
        return prev.map(u => 
          u.user.id === data.user.id 
            ? { ...u, user: data.user }
            : u
        );
      }
      return [...prev, { user: data.user, isTyping: false }];
    });
  };

  const handleUserLeft = (data: { userId: string }) => {
    setConnectedUsers(prev => prev.filter(u => u.user.id !== data.userId));
  };

  const handleUserUpdated = (data: { user: CollaborationUser }) => {
    setConnectedUsers(prev => 
      prev.map(u => 
        u.user.id === data.user.id 
          ? { ...u, user: data.user }
          : u
      )
    );
  };

  const handleCursorMoved = (data: { userId: string, cursor: any }) => {
    setConnectedUsers(prev => 
      prev.map(u => 
        u.user.id === data.userId 
          ? { 
              ...u, 
              cursorPosition: data.cursor,
              currentFile: data.cursor?.file
            }
          : u
      )
    );
  };

  const handleFileChanged = (data: any) => {
    // Handle file changes from other users
    console.log('File changed by collaborator:', data);
  };

  const handleTerminalCreated = (data: { terminal: TerminalSession }) => {
    setSharedTerminals(prev => [...prev, data.terminal]);
  };

  const handleDebugSessionCreated = (data: { debugSession: DebugSession }) => {
    setDebugSessions(prev => [...prev, data.debugSession]);
  };

  const handleVoiceCallStarted = (data: any) => {
    setIsVoiceConnected(true);
  };

  const sendWebSocketMessage = (type: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  };

  const startVoiceCall = () => {
    setIsVoiceConnected(true);
    setIsMicEnabled(true);
    sendWebSocketMessage('start_voice_call', { userId: session?.user?.id });
  };

  const endVoiceCall = () => {
    setIsVoiceConnected(false);
    setIsVideoEnabled(false);
    setIsMicEnabled(false);
    sendWebSocketMessage('end_voice_call', { userId: session?.user?.id });
  };

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
    sendWebSocketMessage('toggle_video', { 
      userId: session?.user?.id, 
      enabled: !isVideoEnabled 
    });
  };

  const toggleMic = () => {
    setIsMicEnabled(!isMicEnabled);
    sendWebSocketMessage('toggle_mic', { 
      userId: session?.user?.id, 
      enabled: !isMicEnabled 
    });
  };

  const startScreenShare = () => {
    setIsScreenSharing(true);
    sendWebSocketMessage('start_screen_share', { userId: session?.user?.id });
  };

  const stopScreenShare = () => {
    setIsScreenSharing(false);
    sendWebSocketMessage('stop_screen_share', { userId: session?.user?.id });
  };

  const createSharedTerminal = () => {
    if (onCreateTerminal) {
      onCreateTerminal();
    } else {
      sendWebSocketMessage('create_terminal', {
        userId: session?.user?.id,
        options: {
          name: `Terminal ${sharedTerminals.length + 1}`,
          command: '/bin/bash',
          cwd: '/workspace'
        }
      });
    }
  };

  const createDebugSession = () => {
    if (onCreateDebugSession) {
      onCreateDebugSession();
    } else {
      sendWebSocketMessage('create_debug_session', {
        userId: session?.user?.id,
        config: {
          name: `Debug Session ${debugSessions.length + 1}`,
          language: 'javascript',
          executable: 'node',
          args: ['--inspect']
        }
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'editor':
        return <Edit3 className="h-3 w-3 text-blue-500" />;
      case 'viewer':
        return <Eye className="h-3 w-3 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Collaboration Toolbar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Collaboration ({connectedUsers.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isVoiceConnected ? (
                <Button onClick={startVoiceCall} size="sm" variant="outline">
                  <Phone className="h-4 w-4 mr-1" />
                  Call
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    onClick={toggleMic}
                    size="sm"
                    variant={isMicEnabled ? "default" : "destructive"}
                  >
                    {isMicEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    onClick={toggleVideo}
                    size="sm"
                    variant={isVideoEnabled ? "default" : "secondary"}
                  >
                    {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  </Button>
                  <Button onClick={endVoiceCall} size="sm" variant="destructive">
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <Button
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                size="sm"
                variant={isScreenSharing ? "default" : "outline"}
              >
                <Share className="h-4 w-4 mr-1" />
                {isScreenSharing ? 'Stop Share' : 'Share'}
              </Button>
              
              {onUserInvite && (
                <Button onClick={onUserInvite} size="sm" variant="outline">
                  <UserPlus className="h-4 w-4 mr-1" />
                  Invite
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="terminals">Terminals</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected Users</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {connectedUsers.map((userPresence) => (
                    <div key={userPresence.user.id} className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={userPresence.user.avatar} />
                          <AvatarFallback>
                            {userPresence.user.name?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${getStatusColor(userPresence.user.status)}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {userPresence.user.name}
                          </p>
                          {getRoleIcon(userPresence.user.role)}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500 truncate">
                            {userPresence.currentFile || 'No file open'}
                          </p>
                          {userPresence.isTyping && (
                            <Badge variant="secondary" className="text-xs">
                              Typing...
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {userPresence.user.role}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  
                  {connectedUsers.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No other users in this workspace</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terminals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Shared Terminals</CardTitle>
                <Button onClick={createSharedTerminal} size="sm">
                  <Terminal className="h-4 w-4 mr-1" />
                  New Terminal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {sharedTerminals.map((terminal) => (
                    <div key={terminal.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Terminal className="h-4 w-4" />
                          <span className="font-medium">{terminal.name}</span>
                          <Badge variant={terminal.isActive ? "default" : "secondary"}>
                            {terminal.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {terminal.users.map((userId) => {
                            const user = connectedUsers.find(u => u.user.id === userId);
                            return user ? (
                              <Avatar key={userId} className="h-6 w-6">
                                <AvatarImage src={user.user.avatar} />
                                <AvatarFallback className="text-xs">
                                  {user.user.name?.substring(0, 1)}
                                </AvatarFallback>
                              </Avatar>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Command: <code className="bg-gray-100 px-1 rounded">{terminal.command}</code></p>
                        <p>Working Directory: <code className="bg-gray-100 px-1 rounded">{terminal.cwd}</code></p>
                      </div>
                    </div>
                  ))}
                  
                  {sharedTerminals.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No shared terminals</p>
                      <p className="text-xs">Create a terminal to collaborate</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debug" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Debug Sessions</CardTitle>
                <Button onClick={createDebugSession} size="sm">
                  <Bug className="h-4 w-4 mr-1" />
                  New Session
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {debugSessions.map((debug) => (
                    <div key={debug.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Bug className="h-4 w-4" />
                          <span className="font-medium">{debug.name}</span>
                          <Badge variant={
                            debug.status === 'running' ? 'default' :
                            debug.status === 'paused' ? 'secondary' :
                            debug.status === 'stopped' ? 'destructive' : 'outline'
                          }>
                            {debug.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {debug.users.map((userId) => {
                            const user = connectedUsers.find(u => u.user.id === userId);
                            return user ? (
                              <Avatar key={userId} className="h-6 w-6">
                                <AvatarImage src={user.user.avatar} />
                                <AvatarFallback className="text-xs">
                                  {user.user.name?.substring(0, 1)}
                                </AvatarFallback>
                              </Avatar>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Language: <span className="font-medium">{debug.language}</span></p>
                        <p>Breakpoints: <span className="font-medium">{debug.breakpoints.length}</span></p>
                      </div>
                    </div>
                  ))}
                  
                  {debugSessions.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No debug sessions</p>
                      <p className="text-xs">Start debugging to collaborate</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Team Chat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 mb-3">
                <div className="space-y-3">
                  {activeChat.map((message, index) => (
                    <div key={index} className="text-sm">
                      {/* Chat messages would be rendered here */}
                      <p className="text-gray-600">{message}</p>
                    </div>
                  ))}
                  
                  {activeChat.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-xs">Start a conversation with your team</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      // Send message
                      const input = e.target as HTMLInputElement;
                      if (input.value.trim()) {
                        sendWebSocketMessage('send_message', {
                          userId: session?.user?.id,
                          message: input.value.trim()
                        });
                        input.value = '';
                      }
                    }
                  }}
                />
                <Button size="sm">Send</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 