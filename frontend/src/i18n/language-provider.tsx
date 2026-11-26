import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react'
import { LanguageContext, type Language } from './use-language'
import { vi } from './vi'
import { en } from './en'

const STORAGE_KEY = 'app-language'

function readLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'vi'
  } catch {
    return 'vi'
  }
}

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setPreference] = useState(readLanguage)

  useLayoutEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    setPreference(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // The language can still change for the current session.
    }
  }, [])

  return (
    <LanguageContext value={{ language, setLanguage, locale: language === 'en' ? 'en-US' : 'vi-VN', messages: language === 'en' ? en : vi }}>
      {children}
    </LanguageContext>
  )
}
