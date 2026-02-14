import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
// import { logger } from '../../../../lib/logger';


import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import { loadUserPreferences, saveUserPreferences } from '@/lib/server/user-preferences'
import { userPreferencesInputSchema } from '@/lib/user-preferences'
import { cacheGet, cacheSet, cacheDelete, CacheKeyGenerators, TTLPresets } from '@/lib/cache/cache-utils'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(60) // 60 requests per minute - user settings

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    )
  }

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

    // Invalidate cached preferences and update cache with new value
    const cacheKey = CacheKeyGenerators.userPreferences(user.id)
    await cacheDelete(cacheKey)
    await cacheSet(cacheKey, saved, { ttl: TTLPresets.USER_PREFERENCES })

    return NextResponse.json({
      success: true,
      message: 'Preferences saved successfully',
      preferences: saved,
    })
  } catch (error) {
    console.error('Error saving preferences:', { error: error })
    return NextResponse.json(
      { error: 'Failed to save preferences' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    )
  }

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

    // Try cache first for user preferences
    const cacheKey = CacheKeyGenerators.userPreferences(user.id)
    const cached = await cacheGet(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Cache miss - load from database
    const preferences = await loadUserPreferences(user.id)

    // Cache the result (15 minute TTL)
    await cacheSet(cacheKey, preferences, { ttl: TTLPresets.USER_PREFERENCES })

    return NextResponse.json(preferences)
  } catch (error) {
    console.error('Error fetching preferences:', { error: error })
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 },
    )
  }
}
