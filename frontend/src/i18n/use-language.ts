import { createContext, useContext } from 'react'
import type { Messages } from './vi'

export type Language = 'vi' | 'en'
export type Locale = 'vi-VN' | 'en-US'

interface LanguageValue {
  language: Language
  locale: Locale
  messages: Messages
  setLanguage: (language: Language) => void
}

export const LanguageContext = createContext<LanguageValue | null>(null)

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage requires a LanguageProvider')
  return value
}
