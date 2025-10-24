import { z } from 'zod'

export const themeOptionSchema = z.enum(['light', 'dark', 'auto'])
export type ThemeOption = z.infer<typeof themeOptionSchema>

export const cliEditorOptionSchema = z.enum(['vim', 'neovim', 'nano', 'none'])
export type CliEditorOption = z.infer<typeof cliEditorOptionSchema>

export const ideOptionSchema = z.enum(['vs-code', 'windsurf', 'code-server', 'browser-only'])
export type IdeOption = z.infer<typeof ideOptionSchema>

export const aiProviderSchema = z.enum(['openai', 'anthropic', 'gemini', 'claude', 'groq'])
export type AiProvider = z.infer<typeof aiProviderSchema>

export const userPreferencesInputSchema = z.object({
  theme: themeOptionSchema.default('auto'),
  cliEditor: cliEditorOptionSchema.default('none'),
  preferredIde: ideOptionSchema.default('vs-code'),
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
  aiProviders: z.array(aiProviderSchema).default(['openai']),
})

export const storedUserPreferencesSchema = userPreferencesInputSchema.extend({
  onboardingCompleted: z.boolean().default(false),
})

export type UserPreferencesInput = z.infer<typeof userPreferencesInputSchema>
export type UserPreferences = z.infer<typeof storedUserPreferencesSchema>

export const defaultUserPreferences: UserPreferences = {
  theme: 'auto',
  cliEditor: 'none',
  preferredIde: 'vs-code',
  extensions: [],
  integrations: {},
  aiProviders: ['openai'],
  onboardingCompleted: false,
}

export function mergeWithDefaultPreferences(overrides: Partial<UserPreferences> | null | undefined): UserPreferences {
  if (!overrides) {
    return { ...defaultUserPreferences }
  }

  return {
    ...defaultUserPreferences,
    ...overrides,
    extensions: overrides.extensions ?? defaultUserPreferences.extensions,
    integrations: overrides.integrations ?? defaultUserPreferences.integrations,
    aiProviders: overrides.aiProviders ?? defaultUserPreferences.aiProviders,
    onboardingCompleted: overrides.onboardingCompleted ?? defaultUserPreferences.onboardingCompleted,
  }
}
