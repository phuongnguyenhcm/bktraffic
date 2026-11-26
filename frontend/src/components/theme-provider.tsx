import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { isTheme, ThemeContext, THEME_STORAGE_KEY, type Theme } from '@/hooks/use-theme'

function getPreference(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(value) ? value : 'light'
  } catch {
    return 'light'
  }
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setPreference] = useState(getPreference)

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    const syncPreference = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setPreference(getPreference())
    }
    window.addEventListener('storage', syncPreference)
    return () => window.removeEventListener('storage', syncPreference)
  }, [])

  const setTheme = useCallback((value: Theme) => {
    setPreference(value)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value)
    } catch {
      // Theme switching still works for this session when storage is unavailable.
    }
  }, [])

  return <ThemeContext value={{ theme, resolvedTheme: theme, setTheme }}>{children}</ThemeContext>
}
