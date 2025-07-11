/**
 * Collaborative Editing Sessions Component
 * 
 * Advanced session management for multi-user collaborative editing
 * with conflict resolution, session persistence, and real-time synchronization
 * 
 * Staff Engineer Implementation - Enterprise-grade collaborative sessions
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, 
  Share, 
  Lock, 
  Unlock, 
  Clock, 
  Settings, 
  Copy, 
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'
import { useCollaboration } from '../../hooks/useCollaboration'

export interface CollaborativeSession {
  sessionId: string
  sessionName: string
  documentId: string
  documentName: string
  createdBy: string
  createdAt: number
  lastActivity: number
  participants: SessionParticipant[]
  permissions: SessionPermissions
  settings: SessionSettings
  status: 'active' | 'paused' | 'ended'
  metadata?: {
    documentType: string
    documentSize: number
    totalEdits: number
    conflictCount: number
    lastSaved: number
  }
}

export interface SessionParticipant {
  userId: string
  userName: string
  userAvatar?: string
  role: 'owner' | 'editor' | 'viewer'
  joinedAt: number
  lastActive: number
  isOnline: boolean
  permissions: {
    canEdit: boolean
    canComment: boolean
    canShare: boolean
    canManage: boolean
  }
  statistics: {
    editsCount: number
    timeSpent: number
    charactersAdded: number
    charactersDeleted: number
  }
}

export interface SessionPermissions {
  isPublic: boolean
  allowAnonymous: boolean
  requireApproval: boolean
  maxParticipants: number
  editMode: 'collaborative' | 'turn-based' | 'locked'
  commentMode: 'enabled' | 'disabled' | 'review-only'
}

export interface SessionSettings {
  autoSave: boolean
  autoSaveInterval: number
  conflictResolution: 'manual' | 'automatic' | 'last-write-wins'
  versionHistory: boolean
  realTimeUpdates: boolean
  showCursors: boolean
  showPresence: boolean
  notificationsEnabled: boolean
}

export interface CollaborativeEditingSessionsProps {
  currentSession?: CollaborativeSession
  availableSessions: CollaborativeSession[]
  currentUserId: string
  onSessionCreate: (config: Partial<CollaborativeSession>) => void
  onSessionJoin: (sessionId: string) => void
  onSessionLeave: (sessionId: string) => void
  onSessionUpdate: (sessionId: string, updates: Partial<CollaborativeSession>) => void
  onSessionEnd: (sessionId: string) => void
  onInviteUsers: (sessionId: string, userIds: string[]) => void
  className?: string
}

export default function CollaborativeEditingSessions({
  currentSession,
  availableSessions,
  currentUserId,
  onSessionCreate,
  onSessionJoin,
  onSessionLeave,
  onSessionUpdate,
  onSessionEnd,
  onInviteUsers,
  className = ''
}: CollaborativeEditingSessionsProps) {
  const { collaborationManager, isConnected } = useCollaboration()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<CollaborativeSession | null>(null)
  const [inviteLink, setInviteLink] = useState('')
  const [newSessionConfig, setNewSessionConfig] = useState<Partial<CollaborativeSession>>({
    sessionName: '',
    permissions: {
      isPublic: false,
      allowAnonymous: false,
      requireApproval: true,
      maxParticipants: 10,
      editMode: 'collaborative',
      commentMode: 'enabled'
    },
    settings: {
      autoSave: true,
      autoSaveInterval: 30000,
      conflictResolution: 'manual',
      versionHistory: true,
      realTimeUpdates: true,
      showCursors: true,
      showPresence: true,
      notificationsEnabled: true
    }
  })

  /**
   * Generate session invite link
   */
  const generateInviteLink = useCallback((sessionId: string) => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/collaborate/${sessionId}`
    setInviteLink(link)
    return link
  }, [])

  /**
   * Copy invite link to clipboard
   */
  const copyInviteLink = useCallback(async () => {
    if (!inviteLink) return
    
    try {
      await navigator.clipboard.writeText(inviteLink)
      // TODO: Show success toast
    } catch (error) {
      console.error('Failed to copy invite link:', error)
      // TODO: Show error toast
    }
  }, [inviteLink])

  /**
   * Get session statistics
   */
  const getSessionStats = useCallback((session: CollaborativeSession) => {
    const activeParticipants = session.participants.filter(p => p.isOnline).length
    const totalEdits = session.participants.reduce((sum, p) => sum + p.statistics.editsCount, 0)
    const avgTimeSpent = session.participants.length > 0 
      ? session.participants.reduce((sum, p) => sum + p.statistics.timeSpent, 0) / session.participants.length
      : 0

    return {
      activeParticipants,
      totalParticipants: session.participants.length,
      totalEdits,
      avgTimeSpent,
      sessionDuration: Date.now() - session.createdAt,
      lastActivity: session.lastActivity
    }
  }, [])

  /**
   * Format duration for display
   */
  const formatDuration = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }, [])

  /**
   * Get user role in session
   */
  const getUserRole = useCallback((session: CollaborativeSession, userId: string): SessionParticipant['role'] | null => {
    const participant = session.participants.find(p => p.userId === userId)
    return participant?.role || null
  }, [])

  /**
   * Check if user can manage session
   */
  const canManageSession = useCallback((session: CollaborativeSession, userId: string): boolean => {
    const role = getUserRole(session, userId)
    return role === 'owner' || (role === 'editor' && session.participants.find(p => p.userId === userId)?.permissions.canManage)
  }, [getUserRole])

  /**
   * Render session card
   */
  const renderSessionCard = useCallback((session: CollaborativeSession) => {
    const stats = getSessionStats(session)
    const userRole = getUserRole(session, currentUserId)
    const isCurrentSession = currentSession?.sessionId === session.sessionId
    const canManage = canManageSession(session, currentUserId)

    return (
      <motion.div
        key={session.sessionId}
        layout
        className={`p-4 rounded-lg border-2 transition-all ${
          isCurrentSession 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {session.sessionName}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {session.documentName}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Status indicator */}
            <div className={`w-2 h-2 rounded-full ${
              session.status === 'active' ? 'bg-green-500' :
              session.status === 'paused' ? 'bg-yellow-500' :
              'bg-red-500'
            }`} />
            
            {/* Role badge */}
            {userRole && (
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                userRole === 'owner' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300' :
                userRole === 'editor' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {userRole}
              </span>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600 dark:text-gray-400">
              {stats.activeParticipants}/{stats.totalParticipants} active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600 dark:text-gray-400">
              {formatDuration(stats.sessionDuration)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600 dark:text-gray-400">
              {stats.totalEdits} edits
            </span>
          </div>
          <div className="flex items-center gap-2">
            {session.permissions.isPublic ? (
              <Unlock className="w-4 h-4 text-green-500" />
            ) : (
              <Lock className="w-4 h-4 text-orange-500" />
            )}
            <span className="text-gray-600 dark:text-gray-400">
              {session.permissions.isPublic ? 'Public' : 'Private'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isCurrentSession ? (
              <button
                onClick={() => onSessionJoin(session.sessionId)}
                className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                Join Session
              </button>
            ) : (
              <button
                onClick={() => onSessionLeave(session.sessionId)}
                className="px-3 py-1 text-sm font-medium text-red-600 border border-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Leave Session
              </button>
            )}

            {canManage && (
              <button
                onClick={() => {
                  setSelectedSession(session)
                  setShowSettingsModal(true)
                }}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedSession(session)
                generateInviteLink(session.sessionId)
                setShowInviteModal(true)
              }}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Share session"
            >
              <Share className="w-4 h-4" />
            </button>

            {canManage && (
              <button
                onClick={() => onSessionEnd(session.sessionId)}
                className="p-1 text-red-500 hover:text-red-700 transition-colors"
                title="End session"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    )
  }, [getSessionStats, getUserRole, canManageSession, currentUserId, currentSession, onSessionJoin, onSessionLeave, onSessionEnd, formatDuration, generateInviteLink])

  /**
   * Render create session modal
   */
  const renderCreateModal = useCallback(() => (
    <AnimatePresence>
      {showCreateModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Create Collaborative Session
              </h2>

              <div className="space-y-4">
                {/* Session name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Session Name
                  </label>
                  <input
                    type="text"
                    value={newSessionConfig.sessionName || ''}
                    onChange={(e) => setNewSessionConfig(prev => ({
                      ...prev,
                      sessionName: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="My Collaborative Session"
                  />
                </div>

                {/* Privacy settings */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Privacy
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newSessionConfig.permissions?.isPublic || false}
                        onChange={(e) => setNewSessionConfig(prev => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions!,
                            isPublic: e.target.checked
                          }
                        }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Make session public
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newSessionConfig.permissions?.allowAnonymous || false}
                        onChange={(e) => setNewSessionConfig(prev => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions!,
                            allowAnonymous: e.target.checked
                          }
                        }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Allow anonymous users
                      </span>
                    </label>
                  </div>
                </div>

                {/* Edit mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Edit Mode
                  </label>
                  <select
                    value={newSessionConfig.permissions?.editMode || 'collaborative'}
                    onChange={(e) => setNewSessionConfig(prev => ({
                      ...prev,
                      permissions: {
                        ...prev.permissions!,
                        editMode: e.target.value as any
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="collaborative">Collaborative</option>
                    <option value="turn-based">Turn-based</option>
                    <option value="locked">View only</option>
                  </select>
                </div>

                {/* Max participants */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Participants
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newSessionConfig.permissions?.maxParticipants || 10}
                    onChange={(e) => setNewSessionConfig(prev => ({
                      ...prev,
                      permissions: {
                        ...prev.permissions!,
                        maxParticipants: parseInt(e.target.value) || 10
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onSessionCreate(newSessionConfig)
                    setShowCreateModal(false)
                    setNewSessionConfig({
                      sessionName: '',
                      permissions: {
                        isPublic: false,
                        allowAnonymous: false,
                        requireApproval: true,
                        maxParticipants: 10,
                        editMode: 'collaborative',
                        commentMode: 'enabled'
                      },
                      settings: {
                        autoSave: true,
                        autoSaveInterval: 30000,
                        conflictResolution: 'manual',
                        versionHistory: true,
                        realTimeUpdates: true,
                        showCursors: true,
                        showPresence: true,
                        notificationsEnabled: true
                      }
                    })
                  }}
                  disabled={!newSessionConfig.sessionName}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Session
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  ), [showCreateModal, newSessionConfig, onSessionCreate])

  /**
   * Render invite modal
   */
  const renderInviteModal = useCallback(() => (
    <AnimatePresence>
      {showInviteModal && selectedSession && (
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
                Share Session
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Invite Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={copyInviteLink}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Share this link with others to invite them to collaborate on "{selectedSession.sessionName}".
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => window.open(inviteLink, '_blank')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Link
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  ), [showInviteModal, selectedSession, inviteLink, copyInviteLink])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Collaborative Sessions
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage and join collaborative editing sessions
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Users className="w-4 h-4" />
          New Session
        </button>
      </div>

      {/* Connection status */}
      {!isConnected && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <span className="text-yellow-800 dark:text-yellow-200">
            Not connected to collaboration server. Some features may be limited.
          </span>
        </div>
      )}

      {/* Current session */}
      {currentSession && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Current Session
          </h3>
          {renderSessionCard(currentSession)}
        </div>
      )}

      {/* Available sessions */}
      {availableSessions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Available Sessions
          </h3>
          <div className="space-y-3">
            {availableSessions
              .filter(session => session.sessionId !== currentSession?.sessionId)
              .map(session => renderSessionCard(session))
            }
          </div>
        </div>
      )}

      {/* Empty state */}
      {availableSessions.length === 0 && !currentSession && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No collaborative sessions
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create a new session to start collaborating with others
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First Session
          </button>
        </div>
      )}

      {/* Modals */}
      {renderCreateModal()}
      {renderInviteModal()}
    </div>
  )
}