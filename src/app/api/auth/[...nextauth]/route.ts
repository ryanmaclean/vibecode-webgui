/**
 * NextAuth API route handler for VibeCode WebGUI
 * Handles all authentication endpoints
 */

import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }