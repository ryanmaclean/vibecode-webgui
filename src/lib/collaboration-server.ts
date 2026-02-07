/**
 * Collaboration WebSocket Server
 *
 * Handles real-time synchronization for collaborative editing
 * Integrates with existing Socket.IO infrastructure
 *
 * Staff Engineer Implementation - Production-ready collaboration server
 */

import { Server as SocketIOServer } from 'socket.io'
import * as Y from 'yjs'
import { setPersistence } from 'y-websocket/bin/utils'
import { LeveldbPersistence } from 'y-leveldb'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface CollaborationDocument {
  id: string
  projectId: string
  filePath: string
  doc: Y.Doc
  persistence?: LeveldbPersistence
  users: Set<string>
  lastActivity: Date
}

export interface CollaborationMessage {
  type: 'sync' | 'awareness' | 'auth' | 'error'
  payload: any
  documentId: string
  userId?: string
}

export class CollaborationServer {
  private documents = new Map<string, CollaborationDocument>()
  private userSessions = new Map<string, Set<string>>() // userId -> Set<documentIds>
  private io: SocketIOServer
  private persistenceDir: string
  private pendingSaves = new Map<string, NodeJS.Timeout>()
  private lastSaveTimestamps = new Map<string, number>()
  private fileBaseDir: string
  private static readonly SAVE_DEBOUNCE_MS = 2000

  constructor(io: SocketIOServer, persistenceDir: string = './data/collaboration') {
    this.io = io
    this.persistenceDir = persistenceDir
    this.fileBaseDir = process.env.VIBECODE_DATA_DIR || '/tmp/vibecode-collab'
    this.setupSocketHandlers()
    this.setupCleanupRoutine()
  }

  /**
   * Set up Socket.IO event handlers for collaboration
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      // Debug log removed

      // Handle document join
      socket.on('collab:join', async (data: {
        documentId: string
        projectId: string
        filePath: string
        userId: string
        userInfo: {
          name: string
          email: string
          color: string
        }
      }) => {
        try {
          await this.joinDocument(socket, data)
        } catch (error) {
          socket.emit('collab:error', {
            message: `Failed to join document: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
        }
      })

      // Handle document leave
      socket.on('collab:leave', (data: { documentId: string, userId: string }) => {
        this.leaveDocument(socket, data.documentId, data.userId)
      })

      // Handle Yjs sync messages
      socket.on('collab:sync', (data: {
        documentId: string
        message: Uint8Array
        userId: string
      }) => {
        this.handleSyncMessage(socket, data)
      })

      // Handle awareness updates (cursor positions, user presence)
      socket.on('collab:awareness', (data: {
        documentId: string
        awareness: any
        userId: string
      }) => {
        this.handleAwarenessUpdate(socket, data)
      })

      // Handle file save requests
      socket.on('collab:save', async (data: {
        documentId: string
        content: string
        userId: string
      }) => {
        try {
          await this.saveDocument(data.documentId, data.content, data.userId)
          socket.emit('collab:saved', { documentId: data.documentId })
        } catch (error) {
          socket.emit('collab:error', {
            message: `Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
        }
      })

      // Handle disconnect
      socket.on('disconnect', () => {
        // Debug log removed
        this.handleDisconnect(socket)
      })
    })
  }

  /**
   * Handle user joining a document
   */
  private async joinDocument(socket: any, data: {
    documentId: string
    projectId: string
    filePath: string
    userId: string
    userInfo: {
      name: string
      email: string
      color: string
    }
  }): Promise<void> {
    const { documentId, projectId, filePath, userId, userInfo } = data

    // Get or create document
    let doc = this.documents.get(documentId)
    if (!doc) {
      const ydoc = new Y.Doc()

      // Set up persistence
      const persistence = new LeveldbPersistence(
        `${this.persistenceDir}/${documentId}`,
        ydoc
      )

      doc = {
        id: documentId,
        projectId,
        filePath,
        doc: ydoc,
        persistence,
        users: new Set(),
        lastActivity: new Date()
      }

      this.documents.set(documentId, doc)

      // Load persisted content
      await persistence.whenSynced
    }

    // Add user to document
    doc.users.add(userId)
    doc.lastActivity = new Date()

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set())
    }
    this.userSessions.get(userId)!.add(documentId)

    // Join socket room
    socket.join(`collab:${documentId}`)

    // Store user info on socket
    socket.userId = userId
    socket.documentIds = socket.documentIds || new Set()
    socket.documentIds.add(documentId)

    // Send initial sync data
    const syncMessage = Y.encodeStateAsUpdate(doc.doc)
    socket.emit('collab:sync', {
      documentId,
      message: syncMessage
    })

    // Notify other users of join
    socket.to(`collab:${documentId}`).emit('collab:user-joined', {
      documentId,
      user: {
        id: userId,
        ...userInfo
      }
    })

    // Send current users list
    const currentUsers = Array.from(doc.users).map(uid => ({
      id: uid,
      // Add user info lookup if available
    }))

    socket.emit('collab:users', {
      documentId,
      users: currentUsers
    })

    // Debug log removed
  }

  /**
   * Handle user leaving a document
   */
  private leaveDocument(socket: any, documentId: string, userId: string): void {
    const doc = this.documents.get(documentId)
    if (!doc) return

    // Remove user from document
    doc.users.delete(userId)

    // Update user sessions
    const userDocs = this.userSessions.get(userId)
    if (userDocs) {
      userDocs.delete(documentId)
      if (userDocs.size === 0) {
        this.userSessions.delete(userId)
      }
    }

    // Leave socket room
    socket.leave(`collab:${documentId}`)

    // Remove from socket tracking
    if (socket.documentIds) {
      socket.documentIds.delete(documentId)
    }

    // Notify other users of leave
    socket.to(`collab:${documentId}`).emit('collab:user-left', {
      documentId,
      userId
    })

    // Clean up document if no users
    if (doc.users.size === 0) {
      this.scheduleDocumentCleanup(documentId)
    }

    // Debug log removed
  }

  /**
   * Handle Yjs synchronization messages
   */
  private handleSyncMessage(socket: any, data: {
    documentId: string
    message: Uint8Array
    userId: string
  }): void {
    const doc = this.documents.get(data.documentId)
    if (!doc) return

    // Apply update to document
    Y.applyUpdate(doc.doc, data.message)
    doc.lastActivity = new Date()

    // Schedule debounced save to persist changes
    this.scheduleDebouncedSave(data.documentId)

    // Broadcast to other users in the document
    socket.to(`collab:${data.documentId}`).emit('collab:sync', {
      documentId: data.documentId,
      message: data.message
    })
  }

  /**
   * Handle awareness updates (cursors, selections)
   */
  private handleAwarenessUpdate(socket: any, data: {
    documentId: string
    awareness: any
    userId: string
  }): void {
    const doc = this.documents.get(data.documentId)
    if (!doc) return

    doc.lastActivity = new Date()

    // Broadcast awareness update to other users
    socket.to(`collab:${data.documentId}`).emit('collab:awareness', {
      documentId: data.documentId,
      awareness: data.awareness,
      userId: data.userId
    })
  }

  /**
   * Save document content to file system
   */
  private async saveDocument(documentId: string, content: string, userId: string): Promise<void> {
    const doc = this.documents.get(documentId)
    if (!doc) {
      throw new Error('Document not found')
    }

    // Update document metadata
    const metadata = doc.doc.getMap('metadata')
    metadata.set('lastSaved', Date.now())
    metadata.set('lastSavedBy', userId)
    metadata.set('content', content)

    // Persist to file system
    await this.writeToFileSystem(doc, content)
  }

  /**
   * Write document content to the file system
   */
  private async writeToFileSystem(doc: CollaborationDocument, content: string): Promise<void> {
    try {
      const targetPath = path.join(this.fileBaseDir, doc.projectId, doc.filePath)
      const targetDir = path.dirname(targetPath)

      await fs.mkdir(targetDir, { recursive: true })
      await fs.writeFile(targetPath, content, 'utf-8')

      this.lastSaveTimestamps.set(doc.id, Date.now())
    } catch (error) {
      console.error(
        `[CollaborationServer] Failed to persist document ${doc.id} (${doc.filePath}):`,
        error instanceof Error ? error.message : error
      )
    }
  }

  /**
   * Schedule a debounced save for a document after a sync update
   */
  private scheduleDebouncedSave(documentId: string): void {
    // Clear any existing pending save for this document
    const existing = this.pendingSaves.get(documentId)
    if (existing) {
      clearTimeout(existing)
    }

    const timeout = setTimeout(async () => {
      this.pendingSaves.delete(documentId)
      const doc = this.documents.get(documentId)
      if (!doc) return

      const content = doc.doc.getText('content').toString()
      await this.writeToFileSystem(doc, content)
    }, CollaborationServer.SAVE_DEBOUNCE_MS)

    this.pendingSaves.set(documentId, timeout)
  }

  /**
   * Flush all pending debounced saves immediately
   * Useful during shutdown to ensure no data is lost
   */
  async flushPendingSaves(): Promise<void> {
    const flushPromises: Promise<void>[] = []

    for (const [documentId, timeout] of this.pendingSaves.entries()) {
      clearTimeout(timeout)
      const doc = this.documents.get(documentId)
      if (doc) {
        const content = doc.doc.getText('content').toString()
        flushPromises.push(this.writeToFileSystem(doc, content))
      }
    }

    this.pendingSaves.clear()
    await Promise.all(flushPromises)
  }

  /**
   * Get the last successful save timestamp for a document
   */
  getLastSaveTimestamp(documentId: string): number | null {
    return this.lastSaveTimestamps.get(documentId) ?? null
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(socket: any): void {
    if (socket.userId && socket.documentIds) {
      for (const documentId of socket.documentIds) {
        this.leaveDocument(socket, documentId, socket.userId)
      }
    }
  }

  /**
   * Schedule document cleanup for inactive documents
   */
  private scheduleDocumentCleanup(documentId: string): void {
    // Clean up after 5 minutes of inactivity
    setTimeout(() => {
      const doc = this.documents.get(documentId)
      if (doc && doc.users.size === 0) {
        // Debug log removed
        doc.persistence?.destroy()
        this.documents.delete(documentId)
      }
    }, 5 * 60 * 1000) // 5 minutes
  }

  /**
   * Set up periodic cleanup routine
   */
  private setupCleanupRoutine(): void {
    // Run cleanup every hour
    setInterval(() => {
      const now = new Date()
      const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago

      for (const [documentId, doc] of this.documents.entries()) {
        if (doc.users.size === 0 && doc.lastActivity < cutoff) {
          // Debug log removed
          doc.persistence?.destroy()
          this.documents.delete(documentId)
        }
      }
    }, 60 * 60 * 1000) // 1 hour
  }

  /**
   * Get collaboration statistics
   */
  getStats(): {
    activeDocuments: number
    totalUsers: number
    documentsPerProject: Record<string, number>
  } {
    const documentsPerProject: Record<string, number> = {}
    let totalUsers = 0

    for (const doc of this.documents.values()) {
      documentsPerProject[doc.projectId] = (documentsPerProject[doc.projectId] || 0) + 1
      totalUsers += doc.users.size
    }

    return {
      activeDocuments: this.documents.size,
      totalUsers,
      documentsPerProject
    }
  }

  /**
   * Get document information
   */
  getDocument(documentId: string): CollaborationDocument | null {
    return this.documents.get(documentId) || null
  }

  /**
   * Force save all documents
   */
  async saveAllDocuments(): Promise<void> {
    const savePromises = Array.from(this.documents.entries()).map(([id, doc]) => {
      const content = doc.doc.getText('content').toString()
      return this.saveDocument(id, content, 'system')
    })

    await Promise.all(savePromises)
  }

  /**
   * Cleanup all resources
   */
  async destroy(): Promise<void> {
    await this.flushPendingSaves()
    await this.saveAllDocuments()

    for (const doc of this.documents.values()) {
      doc.persistence?.destroy()
    }

    this.documents.clear()
    this.userSessions.clear()
    this.lastSaveTimestamps.clear()
  }
}

export default CollaborationServer
