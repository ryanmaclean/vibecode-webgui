import { prisma } from '@/lib/prisma'
import {
  UserPreferences,
  UserPreferencesInput,
  defaultUserPreferences,
  mergeWithDefaultPreferences,
  storedUserPreferencesSchema,
} from '@/lib/user-preferences'

export async function loadUserPreferences(userId: number): Promise<UserPreferences> {
  const record = await prisma.userPreference.findUnique({
    where: { user_id: userId },
  })

  if (!record) {
    return { ...defaultUserPreferences }
  }

  const parsed = storedUserPreferencesSchema.safeParse({
    theme: record.theme,
    cliEditor: record.cli_editor,
    preferredIde: record.preferred_ide,
    extensions: record.extensions,
    integrations: record.integrations,
    aiProviders: record.ai_providers,
    onboardingCompleted: record.onboarding_completed,
  })

  if (!parsed.success) {
    return { ...defaultUserPreferences }
  }

  return mergeWithDefaultPreferences(parsed.data)
}

export async function saveUserPreferences(userId: number, data: UserPreferencesInput): Promise<UserPreferences> {
  const parsed = storedUserPreferencesSchema.parse({
    ...data,
    onboardingCompleted: true,
  })

  const record = await prisma.userPreference.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      theme: parsed.theme,
      cli_editor: parsed.cliEditor,
      preferred_ide: parsed.preferredIde,
      extensions: parsed.extensions,
      integrations: parsed.integrations,
      ai_providers: parsed.aiProviders,
      onboarding_completed: parsed.onboardingCompleted,
    },
    update: {
      theme: parsed.theme,
      cli_editor: parsed.cliEditor,
      preferred_ide: parsed.preferredIde,
      extensions: parsed.extensions,
      integrations: parsed.integrations,
      ai_providers: parsed.aiProviders,
      onboarding_completed: parsed.onboardingCompleted,
    },
  })

  return mergeWithDefaultPreferences({
    theme: record.theme as UserPreferences['theme'],
    cliEditor: record.cli_editor as UserPreferences['cliEditor'],
    preferredIde: record.preferred_ide as UserPreferences['preferredIde'],
    extensions: (record.extensions as string[]) ?? defaultUserPreferences.extensions,
    integrations: (record.integrations as Record<string, boolean>) ?? defaultUserPreferences.integrations,
    aiProviders: (record.ai_providers as UserPreferences['aiProviders']) ?? defaultUserPreferences.aiProviders,
    onboardingCompleted: record.onboarding_completed,
  })
}
