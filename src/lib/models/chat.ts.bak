import { ObjectId } from 'mongodb'

export interface Message {
  id: string
  from: 'user' | 'assistant'
  content: string
  files?: string[]
  createdAt: Date
  updatedAt?: Date
}

export interface Conversation {
  _id?: ObjectId
  id: string
  title: string
  sessionId: string
  model: string
  userId: string
  workspaceId: string
  createdAt: Date
  updatedAt: Date
  messages: Message[]
}

export interface ChatSession {
  _id?: ObjectId
  sessionId: string
  userId: string
  userAgent?: string
  ip?: string
  createdAt: Date
  expiresAt: Date
}

export interface Assistant {
  _id?: ObjectId
  id: string
  name: string
  description: string
  instructions: string
  model: string
  tools?: string[]
  files?: string[]
  createdBy: string
  createdAt: Date
  updatedAt: Date
}