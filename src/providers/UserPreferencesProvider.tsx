'use client'

import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'

import type {
  UserPreferences,
  UserPreferencesInput,
} from '@/lib/user-preferences'
import {
  defaultUserPreferences,
  mergeWithDefaultPreferences,
  storedUserPreferencesSchema,
  userPreferencesInputSchema,
} from '@/lib/user-preferences'

interface UserPreferencesContextValue {
  preferences: UserPreferences
  isLoading: boolean
  error?: string
  refresh: () => Promise<void>
  save: (updates: Partial<UserPreferencesInput>) => Promise<void>
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | undefined>(undefined)

async function fetchPreferences(): Promise<UserPreferences | null> {
  const response = await fetch('/api/user/preferences', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    if (response.status === 401) {
      return mergeWithDefaultPreferences(defaultUserPreferences)
    }
    throw new Error(`Failed to load preferences (status ${response.status})`)
  }

  const json = await response.json()
  const parsed = storedUserPreferencesSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('Invalid preferences payload received from API')
  }

  return mergeWithDefaultPreferences(parsed.data)
}

async function persistPreferences(payload: UserPreferencesInput): Promise<UserPreferences> {
  const response = await fetch('/api/user/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Failed to save preferences (status ${response.status})`)
  }

  const json = await response.json()
  const parsed = storedUserPreferencesSchema.safeParse(json.preferences ?? json)
  if (!parsed.success) {
    throw new Error('Invalid response while saving preferences')
  }

  return mergeWithDefaultPreferences(parsed.data)
}

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultUserPreferences)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const { setTheme } = useTheme()

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true)
      const loaded = await fetchPreferences()
      if (loaded) {
        setPreferences(loaded)
        setError(undefined)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const save = useCallback(
    async (updates: Partial<UserPreferencesInput>) => {
      try {
        const merged = mergeWithDefaultPreferences({ ...preferences, ...updates })
        const payload = userPreferencesInputSchema.parse({
          theme: merged.theme,
          cliEditor: merged.cliEditor,
          preferredIde: merged.preferredIde,
          extensions: merged.extensions,
          integrations: merged.integrations,
          aiProviders: merged.aiProviders,
        })

        const saved = await persistPreferences(payload)
        setPreferences(saved)
        setError(undefined)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        throw err
      }
    },
    [preferences],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const theme = preferences.theme === 'auto' ? 'system' : preferences.theme
    setTheme(theme)
  }, [preferences.theme, setTheme])

  const value = useMemo<UserPreferencesContextValue>(
    () => ({
      preferences,
      isLoading,
      error,
      refresh,
      save,
    }),
    [preferences, isLoading, error, refresh, save],
  )

  return <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>
}

export function useUserPreferences(): UserPreferencesContextValue {
  const context = useContext(UserPreferencesContext)
  if (!context) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider')
  }
  return context
}
