import { useCallback, useEffect, useState } from 'react'

/**
 * Stores and retrieves state from localStorage with automatic synchronization across tabs
 *
 * Use cases:
 * - User preferences (theme, language, layout settings)
 * - Form data persistence (auto-save drafts)
 * - Shopping cart state
 * - Authentication tokens
 * - Recently viewed items
 *
 * Performance Impact:
 * - Minimal overhead for small values (<1KB)
 * - Automatic JSON serialization/deserialization
 * - Synchronizes across browser tabs via storage events
 * - SSR-safe with graceful fallback
 *
 * @param key - localStorage key to store value under
 * @param initialValue - Default value if key doesn't exist
 * @returns Tuple of [storedValue, setValue, removeValue]
 *
 * @example
 * const [theme, setTheme, removeTheme] = useLocalStorage('theme', 'light')
 *
 * // Update theme
 * setTheme('dark')
 *
 * // Remove from localStorage
 * removeTheme()
 *
 * @example
 * // Complex object storage
 * interface UserPreferences {
 *   fontSize: number
 *   notifications: boolean
 * }
 *
 * const [prefs, setPrefs] = useLocalStorage<UserPreferences>('user-prefs', {
 *   fontSize: 14,
 *   notifications: true
 * })
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // SSR safety check
  const isClient = typeof window !== 'undefined'

  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (!isClient) {
      return initialValue
    }

    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Allow value to be a function (same API as useState)
        const valueToStore =
          value instanceof Function ? value(storedValue) : value

        setStoredValue(valueToStore)

        if (isClient) {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error)
      }
    },
    [key, storedValue, isClient]
  )

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      if (isClient) {
        window.localStorage.removeItem(key)
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue, isClient])

  // Listen for changes in other tabs/windows
  useEffect(() => {
    if (!isClient) {
      return
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue))
        } catch (error) {
          console.warn(
            `Error parsing localStorage value for key "${key}":`,
            error
          )
        }
      } else if (e.key === key && e.newValue === null) {
        // Key was removed in another tab
        setStoredValue(initialValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [key, initialValue, isClient])

  return [storedValue, setValue, removeValue]
}

/**
 * Stores and retrieves state from localStorage with custom serialization
 *
 * Use cases:
 * - Storing non-JSON-serializable data (Dates, Maps, Sets)
 * - Custom compression for large objects
 * - Encrypted storage
 * - Binary data storage
 *
 * @param key - localStorage key to store value under
 * @param initialValue - Default value if key doesn't exist
 * @param serializer - Custom serialize function
 * @param deserializer - Custom deserialize function
 * @returns Tuple of [storedValue, setValue, removeValue]
 *
 * @example
 * // Store Date objects
 * const [lastVisit, setLastVisit] = useLocalStorageCustom(
 *   'last-visit',
 *   new Date(),
 *   (date) => date.toISOString(),
 *   (str) => new Date(str)
 * )
 *
 * @example
 * // Store Map objects
 * const [cache, setCache] = useLocalStorageCustom(
 *   'cache',
 *   new Map(),
 *   (map) => JSON.stringify([...map]),
 *   (str) => new Map(JSON.parse(str))
 * )
 */
export function useLocalStorageCustom<T>(
  key: string,
  initialValue: T,
  serializer: (value: T) => string,
  deserializer: (value: string) => T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const isClient = typeof window !== 'undefined'

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (!isClient) {
      return initialValue
    }

    try {
      const item = window.localStorage.getItem(key)
      return item ? deserializer(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value

        setStoredValue(valueToStore)

        if (isClient) {
          window.localStorage.setItem(key, serializer(valueToStore))
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error)
      }
    },
    [key, storedValue, serializer, isClient]
  )

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      if (isClient) {
        window.localStorage.removeItem(key)
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue, isClient])

  useEffect(() => {
    if (!isClient) {
      return
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(deserializer(e.newValue))
        } catch (error) {
          console.warn(
            `Error parsing localStorage value for key "${key}":`,
            error
          )
        }
      } else if (e.key === key && e.newValue === null) {
        setStoredValue(initialValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [key, initialValue, deserializer, isClient])

  return [storedValue, setValue, removeValue]
}
