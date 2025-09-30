import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const onboardingPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  cliEditor: z.enum(['vim', 'neovim', 'emacs', 'nano', 'none']).default('none'),
  preferredIde: z.enum(['vs-code', 'windsurf', 'code-server', 'browser-only']).default('vs-code'),
  extensions: z.array(z.string()).default([]),
  integrations: z
    .object({
      github: z.boolean().optional(),
      gitlab: z.boolean().optional(),
      jira: z.boolean().optional(),
      linear: z.boolean().optional(),
      datadog: z.boolean().optional(),
      sentry: z.boolean().optional(),
    })
    .partial()
    .default({}),
  aiProviders: z.array(z.enum(['openai', 'anthropic', 'gemini', 'claude', 'groq'])).default(['openai']),
})

const defaultPreferences = {
  theme: 'auto',
  cliEditor: 'none',
  preferredIde: 'vs-code',
  extensions: [] as string[],
  integrations: {} as Record<string, boolean>,
  aiProviders: ['openai'] as string[],
  onboardingCompleted: false,
}

const jsonArray = (value: unknown, fallback: string[]) => (Array.isArray(value) ? (value as string[]) : fallback)
const jsonObject = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, boolean>) : {})

function serializePreferences(record: {
  theme: string
  cli_editor: string
  preferred_ide: string
  extensions: unknown
  integrations: unknown
  ai_providers: unknown
  onboarding_completed: boolean
}) {
  return {
    theme: (record.theme as typeof defaultPreferences.theme) ?? defaultPreferences.theme,
    cliEditor: (record.cli_editor as typeof defaultPreferences.cliEditor) ?? defaultPreferences.cliEditor,
    preferredIde: (record.preferred_ide as typeof defaultPreferences.preferredIde) ?? defaultPreferences.preferredIde,
    extensions: jsonArray(record.extensions, []),
    integrations: jsonObject(record.integrations),
    aiProviders: jsonArray(record.ai_providers, ['openai']),
    onboardingCompleted: record.onboarding_completed,
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawPreferences = await request.json()
    const preferences = onboardingPreferencesSchema.parse(rawPreferences)

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const record = await prisma.userPreference.upsert({
      where: { user_id: user.id },
      create: {
        user_id: user.id,
        theme: preferences.theme,
        cli_editor: preferences.cliEditor,
        preferred_ide: preferences.preferredIde,
        extensions: preferences.extensions,
        integrations: preferences.integrations,
        ai_providers: preferences.aiProviders,
        onboarding_completed: true,
      },
      update: {
        theme: preferences.theme,
        cli_editor: preferences.cliEditor,
        preferred_ide: preferences.preferredIde,
        extensions: preferences.extensions,
        integrations: preferences.integrations,
        ai_providers: preferences.aiProviders,
        onboarding_completed: true,
      },
      select: {
        theme: true,
        cli_editor: true,
        preferred_ide: true,
        extensions: true,
        integrations: true,
        ai_providers: true,
        onboarding_completed: true,
      },
    })

    const response = serializePreferences(record)

    return NextResponse.json({
      success: true,
      message: 'Preferences saved successfully',
      preferences: response,
    })
  } catch (error) {
    console.error('Error saving preferences:', error)
    return NextResponse.json(
      { error: 'Failed to save preferences' },
      { status: 500 }
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

    const record = await prisma.userPreference.findUnique({
      where: { user_id: user.id },
      select: {
        theme: true,
        cli_editor: true,
        preferred_ide: true,
        extensions: true,
        integrations: true,
        ai_providers: true,
        onboarding_completed: true,
      },
    })

    if (!record) {
      return NextResponse.json(defaultPreferences)
    }

    const preferences = serializePreferences(record)

    return NextResponse.json(preferences)
  } catch (error) {
    console.error('Error fetching preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}
