import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { loadUserPreferences, saveUserPreferences } from '@/lib/server/user-preferences'
import { userPreferencesInputSchema } from '@/lib/user-preferences'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      logger.warn('Unauthorized preferences save attempt', {
        hasSession: !!session
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawPreferences = await request.json()
    const preferences = userPreferencesInputSchema.parse(rawPreferences)

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      logger.warn('User not found for preferences save', {
        email: session.user.email
      })
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const saved = await saveUserPreferences(user.id, preferences)

    logger.info('User preferences saved successfully', {
      userId: user.id,
      preferencesKeys: Object.keys(preferences)
    })

    return NextResponse.json({
      success: true,
      message: 'Preferences saved successfully',
      preferences: saved,
    })
  } catch (error) {
    logger.error('Error saving preferences', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
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
      logger.warn('Unauthorized preferences fetch attempt', {
        hasSession: !!session
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      logger.warn('User not found for preferences fetch', {
        email: session.user.email
      })
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const preferences = await loadUserPreferences(user.id)

    logger.debug('User preferences fetched', {
      userId: user.id
    })

    return NextResponse.json(preferences)
  } catch (error) {
    logger.error('Error fetching preferences', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 },
    )
  }
}
