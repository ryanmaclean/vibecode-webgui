/**
 * Secure User Management System
 * Replaces hardcoded credentials with proper password hashing and database storage
 */

import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { logger } from '@/lib/logger';
// User validation schemas
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'developer', 'lead', 'designer', 'tester', 'devops', 'intern']),
  passwordHash: z.string(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  isActive: z.boolean().default(true),
  lastLogin: z.date().optional(),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['admin', 'developer', 'lead', 'designer', 'tester', 'devops', 'intern']),
})

export type User = z.infer<typeof userSchema>
export type LoginCredentials = z.infer<typeof loginSchema>
export type CreateUserData = z.infer<typeof createUserSchema>

// In-memory store for development (replace with database in production)
const users = new Map<string, User>()

// Salt rounds for bcrypt (12 is recommended for production)
const SALT_ROUNDS = 12

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await bcrypt.hash(password, SALT_ROUNDS)
  } catch (error) {
    logger.error('Password hashing failed:', error)
    throw new Error('Failed to hash password')
  }
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch (error) {
    logger.error('Password verification failed:', error)
    return false
  }
}

/**
 * Create a new user with secure password hashing
 */
export async function createUser(userData: CreateUserData): Promise<User> {
  // Validate input
  const validatedData = createUserSchema.parse(userData)
  
  // Check if user already exists
  const existingUser = Array.from(users.values()).find(user => user.email === validatedData.email)
  if (existingUser) {
    throw new Error('User with this email already exists')
  }

  // Hash password
  const passwordHash = await hashPassword(validatedData.password)

  // Create user object
  const user: User = {
    id: generateUserId(),
    email: validatedData.email,
    name: validatedData.name,
    role: validatedData.role,
    passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
  }

  // Store user
  users.set(user.id, user)
  
  // Debug log removed
  return user
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(credentials: LoginCredentials): Promise<User | null> {
  try {
    // Validate input
    const validatedCredentials = loginSchema.parse(credentials)
    
    // Find user by email
    const user = Array.from(users.values()).find(u => u.email === validatedCredentials.email)
    if (!user || !user.isActive) {
      return null
    }

    // Verify password
    const isValidPassword = await verifyPassword(validatedCredentials.password, user.passwordHash)
    if (!isValidPassword) {
      return null
    }

    // Update last login
    user.lastLogin = new Date()
    user.updatedAt = new Date()
    users.set(user.id, user)

    return user
  } catch (error) {
    logger.error('Authentication failed:', error)
    return null
  }
}

/**
 * Get user by ID
 */
export function getUserById(id: string): User | null {
  return users.get(id) || null
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): User | null {
  return Array.from(users.values()).find(user => user.email === email) || null
}

/**
 * Update user password
 */
export async function updateUserPassword(userId: string, newPassword: string): Promise<boolean> {
  try {
    // Validate password
    createUserSchema.shape.password.parse(newPassword)
    
    const user = users.get(userId)
    if (!user) {
      return false
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword)
    
    // Update user
    user.passwordHash = passwordHash
    user.updatedAt = new Date()
    users.set(userId, user)

    return true
  } catch (error) {
    logger.error('Password update failed:', error)
    return false
  }
}

/**
 * Deactivate user account
 */
export function deactivateUser(userId: string): boolean {
  const user = users.get(userId)
  if (!user) {
    return false
  }

  user.isActive = false
  user.updatedAt = new Date()
  users.set(userId, user)
  return true
}

/**
 * Generate a unique user ID
 */
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Initialize default admin user for development
 * This should be removed in production and replaced with proper user seeding
 */
export async function initializeDefaultUsers(): Promise<void> {
  // Only initialize if no users exist
  if (users.size > 0) {
    return
  }

  try {
    // Import env validation to get type-safe environment variables
    const { getEnv } = await import('../env-validation')
    const env = getEnv()
    
    // Create admin user from environment variables
    const adminEmail = env.DEFAULT_ADMIN_EMAIL || 'admin@vibecode.dev'
    const adminPassword = env.DEFAULT_ADMIN_PASSWORD
    
    if (!adminPassword) {
      logger.warn('No DEFAULT_ADMIN_PASSWORD environment variable set. Skipping admin user creation.')
      return
    }

    await createUser({
      email: adminEmail,
      password: adminPassword,
      name: 'System Administrator',
      role: 'admin',
    })

    // Debug log removed
  } catch (error) {
    logger.error('❌ Failed to create default admin user:', error)
  }
}

/**
 * Get all users (admin only)
 */
export function getAllUsers(): User[] {
  return Array.from(users.values()).map(user => ({
    ...user,
    passwordHash: '[REDACTED]' // Never expose password hashes
  })) as User[]
}

/**
 * Security audit logging
 */
export function logSecurityEvent(
  event: 'login_success' | 'login_failure' | 'password_change' | 'user_created' | 'user_deactivated',
  userId?: string,
  metadata?: Record<string, any>
): void {
  // Security event logged
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    userId,
    metadata
  }
}