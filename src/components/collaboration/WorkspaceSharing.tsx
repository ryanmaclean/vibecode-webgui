/**
 * Workspace Sharing Component
 *
 * Advanced workspace sharing and collaboration management
 * with granular permissions, team management, and secure access controls
 *
 * Staff Engineer Implementation - Enterprise-grade workspace collaboration
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Share2,
  Users,
  Shield,
  Globe,
  Lock,
  UserPlus,
  UserMinus,
  Settings,
  Copy,
  QrCode,
  Mail,
  MessageSquare,
  Calendar,
  Clock,
  Eye,
  Edit,
  Trash2,
  Crown,
  AlertTriangle,
  CheckCircle,
  ExternalLink
} from 'lucide-react'

export interface WorkspacePermission {
  id: string
  name: string
  description: string
  level: 'read' | 'write' | 'admin' | 'owner'
  actions: string[]
}

export interface WorkspaceMember {
  userId: string
  userName: string
  userEmail: string
  userAvatar?: string
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'guest'
  permissions: WorkspacePermission[]
  joinedAt: number
  lastActive: number
  invitedBy?: string
  status: 'active' | 'pending' | 'suspended'
  accessLevel: {
    canRead: boolean
    canWrite: boolean
    canDelete: boolean
    canShare: boolean
    canManage: boolean
    canViewHistory: boolean
  }
  statistics: {
    sessionsJoined: number
    filesEdited: number
    collaborationTime: number
    lastLogin: number
  }
}

export interface ShareSettings {
  isPublic: boolean
  allowDiscovery: boolean
  requireApproval: boolean
  allowAnonymous: boolean
  maxMembers: number
  linkExpiration?: number
  passwordProtected: boolean
  password?: string
  defaultRole: WorkspaceMember['role']
  notifications: {
    onJoin: boolean
    onEdit: boolean
    onShare: boolean
    onLeave: boolean
  }
}

export interface WorkspaceTeam {
  teamId: string
  teamName: string
  description: string
  members: string[] // User IDs
  permissions: WorkspacePermission[]
  createdAt: number
  createdBy: string
}

export interface WorkspaceSharingProps {
  workspaceId: string
  workspaceName: string
  workspaceOwner: string
  currentUserId: string
  members: WorkspaceMember[]
  teams: WorkspaceTeam[]
  shareSettings: ShareSettings
  onMemberAdd: (email: string, role: WorkspaceMember['role']) => void
  onMemberRemove: (userId: string) => void
  onMemberRoleChange: (userId: string, newRole: WorkspaceMember['role']) => void
  onSettingsUpdate: (settings: Partial<ShareSettings>) => void
  onTeamCreate: (team: Omit<WorkspaceTeam, 'teamId' | 'createdAt' | 'createdBy'>) => void
  onTeamUpdate: (teamId: string, updates: Partial<WorkspaceTeam>) => void
  onTeamDelete: (teamId: string) => void
  className?: string
}

const ROLE_PERMISSIONS = {
  owner: ['read', 'write', 'delete', 'share', 'manage', 'viewHistory'],
  admin: ['read', 'write', 'delete', 'share', 'manage', 'viewHistory'],
  editor: ['read', 'write', 'share', 'viewHistory'],
  viewer: ['read', 'viewHistory'],
  guest: ['read']
}

const ROLE_COLORS = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
  editor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  viewer: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  guest: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
}

export default function WorkspaceSharing({
  workspaceId,
  workspaceName,
  workspaceOwner,
  currentUserId,
  members,
  teams,
  shareSettings,
  onMemberAdd,
  onMemberRemove,
  onMemberRoleChange,
  onSettingsUpdate,
  onTeamCreate,
  onTeamUpdate,
  onTeamDelete,
  className = ''
}: WorkspaceSharingProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'teams' | 'settings'>('members')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceMember['role']>('viewer')
  const [shareLink, setShareLink] = useState('')
  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(null)
  const [newTeam, setNewTeam] = useState({
    teamName: '',
    description: '',
    members: [] as string[]
  })

  /**
   * Generate workspace share link
   */
  const generateShareLink = useCallback(() => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/workspace/${workspaceId}/join`
    setShareLink(link)
    return link
  }, [workspaceId])

  /**
   * Copy share link to clipboard
   */
  const copyShareLink = useCallback(async () => {
    if (!shareLink) return

    try {
      await navigator.clipboard.writeText(shareLink)
      // TODO: Show success toast
    } catch (error) {
      console.error('Failed to copy share link:', error)
      // TODO: Show error toast
    }
  }, [shareLink])

  /**
   * Check if current user can manage workspace
   */
  const canManageWorkspace = useMemo(() => {
    const currentMember = members.find(m => m.userId === currentUserId)
    return currentMember?.role === 'owner' || currentMember?.role === 'admin'
  }, [members, currentUserId])

  /**
   * Get member statistics
   */
  const getMemberStats = useCallback(() => {
    const activeMembers = members.filter(m => m.status === 'active').length
    const pendingMembers = members.filter(m => m.status === 'pending').length
    const totalCollaborationTime = members.reduce((sum, m) => sum + m.statistics.collaborationTime, 0)

    return {
      total: members.length,
      active: activeMembers,
      pending: pendingMembers,
      totalCollaborationTime
    }
  }, [members])

  /**
   * Format time duration
   */
  const formatDuration = useCallback((ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }, [])

  /**
   * Format relative time
   */
  const formatRelativeTime = useCallback((timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    return 'Just now'
  }, [])

  /**
   * Render member item
   */
  const renderMemberItem = useCallback((member: WorkspaceMember) => {
    const isCurrentUser = member.userId === currentUserId
    const isOwner = member.role === 'owner'

    return (
      <motion.div
        key={member.userId}
        layout
        className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
              {member.userAvatar ? (
                <img
                  src={member.userAvatar}
                  alt={member.userName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                member.userName.charAt(0).toUpperCase()
              )}
            </div>

            {/* Status indicator */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
              member.status === 'active' ? 'bg-green-500' :
              member.status === 'pending' ? 'bg-yellow-500' :
              'bg-red-500'
            }`} />

            {/* Owner crown */}
            {isOwner && (
              <div className="absolute -top-1 -right-1">
                <Crown className="w-4 h-4 text-yellow-500" />
              </div>
            )}
          </div>

          {/* Member info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {member.userName}
                {isCurrentUser && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">(You)</span>
                )}
              </h3>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${ROLE_COLORS[member.role]}`}>
                {member.role}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {member.userEmail}
            </p>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Joined {formatRelativeTime(member.joinedAt)}</span>
              <span>•</span>
              <span>Last active {formatRelativeTime(member.lastActive)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Statistics */}
          <div className="text-right text-xs text-gray-500 dark:text-gray-400 mr-3">
            <div>{member.statistics.filesEdited} files edited</div>
            <div>{formatDuration(member.statistics.collaborationTime)} collaborated</div>
          </div>

          {/* Role selector */}
          {canManageWorkspace && !isOwner && (
            <select
              value={member.role}
              onChange={(e) => onMemberRoleChange(member.userId, e.target.value as WorkspaceMember['role'])}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
              <option value="guest">Guest</option>
            </select>
          )}

          {/* Remove member */}
          {canManageWorkspace && !isOwner && !isCurrentUser && (
            <button
              onClick={() => onMemberRemove(member.userId)}
              className="p-1 text-red-500 hover:text-red-700 transition-colors"
              title="Remove member"
            >
              <UserMinus className="w-4 h-4" />
            </button>
          )}

          {/* Member details */}
          <button
            onClick={() => setSelectedMember(member)}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    )
  }, [currentUserId, canManageWorkspace, onMemberRoleChange, onMemberRemove, formatRelativeTime, formatDuration])

  /**
   * Render team item
   */
  const renderTeamItem = useCallback((team: WorkspaceTeam) => {
    const teamMembers = members.filter(m => team.members.includes(m.userId))

    return (
      <motion.div
        key={team.teamId}
        layout
        className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {team.teamName}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {team.description}
            </p>
          </div>

          {canManageWorkspace && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setNewTeam({
                    teamName: team.teamName,
                    description: team.description,
                    members: team.members
                  })
                  setShowTeamModal(true)
                }}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onTeamDelete(team.teamId)}
                className="p-1 text-red-500 hover:text-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex -space-x-2">
            {teamMembers.slice(0, 3).map(member => (
              <div
                key={member.userId}
                className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-medium"
                title={member.userName}
              >
                {member.userAvatar ? (
                  <img
                    src={member.userAvatar}
                    alt={member.userName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  member.userName.charAt(0).toUpperCase()
                )}
              </div>
            ))}
            {teamMembers.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-medium">
                +{teamMembers.length - 3}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }, [members, canManageWorkspace, onTeamDelete])

  /**
   * Render invite modal
   */
  const renderInviteModal = useCallback(() => (
    <AnimatePresence>
      {showInviteModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowInviteModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Invite to Workspace
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as WorkspaceMember['role'])}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                    <option value="guest">Guest</option>
                  </select>
                </div>

                {shareSettings.isPublic && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                        Public Workspace
                      </span>
                    </div>
                    <div className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                      Anyone with the link can join this workspace
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareLink || generateShareLink()}
                        readOnly
                        className="flex-1 px-2 py-1 text-xs border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        onClick={copyShareLink}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowInviteModal(false)
                    setInviteEmail('')
                    setInviteRole('viewer')
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (inviteEmail) {
                      onMemberAdd(inviteEmail, inviteRole)
                      setShowInviteModal(false)
                      setInviteEmail('')
                      setInviteRole('viewer')
                    }
                  }}
                  disabled={!inviteEmail}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Send Invite
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  ), [showInviteModal, inviteEmail, inviteRole, shareSettings.isPublic, shareLink, generateShareLink, copyShareLink, onMemberAdd])

  /**
   * Initialize share link
   */
  useEffect(() => {
    if (shareSettings.isPublic) {
      generateShareLink()
    }
  }, [shareSettings.isPublic, generateShareLink])

  const memberStats = getMemberStats()

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Workspace Sharing
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage members and teams for &quot;{workspaceName}&quot;
          </p>
        </div>

        <div className="flex items-center gap-3">
          {shareSettings.isPublic && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-full text-sm">
              <Globe className="w-4 h-4" />
              Public
            </div>
          )}

          {canManageWorkspace && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Invite Members
            </button>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {memberStats.total}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Members
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {memberStats.active}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Active Members
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {memberStats.pending}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Pending Invites
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatDuration(memberStats.totalCollaborationTime)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Collaboration
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { key: 'members', label: 'Members', icon: Users },
            { key: 'teams', label: 'Teams', icon: Shield },
            { key: 'settings', label: 'Settings', icon: Settings }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'members' && (
          <div className="space-y-4">
            {members.length > 0 ? (
              members.map(member => renderMemberItem(member))
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No members yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Invite people to start collaborating on this workspace
                </p>
                {canManageWorkspace && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Invite Your First Member
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="space-y-4">
            {canManageWorkspace && (
              <button
                onClick={() => setShowTeamModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Create Team
              </button>
            )}

            {teams.length > 0 ? (
              teams.map(team => renderTeamItem(team))
            ) : (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No teams yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create teams to organize members and manage permissions
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Sharing settings would go here */}
            <div className="text-center py-12">
              <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Sharing Settings
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Configure workspace sharing and permissions
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {renderInviteModal()}
    </div>
  )
}
