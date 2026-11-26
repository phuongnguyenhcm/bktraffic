import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'traffic-ui-theme'

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

interface ThemeValue {
  theme: Theme
  resolvedTheme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeValue | null>(null)

export function useTheme(): ThemeValue {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('useTheme requires a ThemeProvider')
  return theme
}
