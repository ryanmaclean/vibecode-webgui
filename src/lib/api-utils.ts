import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './auth'

type SessionUser = {
  id: string
  email: string
  name: string
  role: string
}

export async function requireAuth(request: Request): Promise<{ session: { user: SessionUser } } | NextResponse> {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  return { session: { user: session.user } }
}

export async function requireRole(role: string, request: Request): Promise<{ session: { user: SessionUser } } | NextResponse> {
  const authResult = await requireAuth(request)
  
  if (authResult instanceof NextResponse) {
    return authResult
  }

  if (authResult.session.user.role !== role) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  return authResult
}
