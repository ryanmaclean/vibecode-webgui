/**
 * Authentication types and interfaces for VibeCode WebGUI
 */

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  github_id?: string
  google_id?: string
  role: 'admin' | 'user'
  created_at: Date
  updated_at: Date
  last_login_at?: Date
  login_count: number
  is_active: boolean
}

export interface Project {
  id: string
  name: string
  description?: string
  owner_id: string
  visibility: 'public' | 'private' | 'internal'
  template?: string
  language?: string
  framework?: string
  created_at: Date
  updated_at: Date
  last_accessed_at: Date
  star_count: number
  fork_count: number
  is_archived: boolean
}

export interface Session {
  id: string
  project_id: string
  user_id: string
  container_id?: string
  code_server_url?: string
  websocket_url?: string
  status: 'active' | 'inactive' | 'terminated'
  last_activity_at: Date
  cpu_usage: number
  memory_usage: number
  storage_usage: number
  created_at: Date
  terminated_at?: Date
}

export interface Collaborator {
  id: string
  project_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  permissions: {
    read: boolean
    write: boolean
    admin: boolean
  }
  can_invite: boolean
  can_delete: boolean
  can_deploy: boolean
  created_at: Date
  invited_at?: Date
  accepted_at?: Date
  invited_by?: string
  invitation_token?: string
  invitation_expires_at?: Date
}

export interface AuthState {
  isLoading: boolean
  isAuthenticated: boolean
  user: User | null
  session: Session | null
  error: string | null
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignupCredentials extends LoginCredentials {
  name: string
  confirmPassword: string
}

export interface OAuthProvider {
  id: 'github' | 'google'
  name: string
  icon: string
  color: string
}

export interface AuthError {
  code: string
  message: string
  details?: unknown
}

export type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; session: Session } }
  | { type: 'LOGIN_ERROR'; payload: AuthError }
  | { type: 'LOGOUT' }
  | { type: 'SESSION_UPDATE'; payload: Session }
  | { type: 'CLEAR_ERROR' }
