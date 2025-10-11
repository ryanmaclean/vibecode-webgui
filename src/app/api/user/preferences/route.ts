import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { logger } from '../../../../lib/logger';


import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { loadUserPreferences, saveUserPreferences } from '@/lib/server/user-preferences'
import { userPreferencesInputSchema } from '@/lib/user-preferences'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawPreferences = await request.json()
    const preferences = userPreferencesInputSchema.parse(rawPreferences)

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const saved = await saveUserPreferences(user.id, preferences)

    return NextResponse.json({
      success: true,
      message: 'Preferences saved successfully',
      preferences: saved,
    })
  } catch (error) {
    logger.error('Error saving preferences:', { error: error })
    return NextResponse.json(
      { error: 'Failed to save preferences' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const preferences = await loadUserPreferences(user.id)
    return NextResponse.json(preferences)
  } catch (error) {
    logger.error('Error fetching preferences:', { error: error })
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 },
    )
  }
}
