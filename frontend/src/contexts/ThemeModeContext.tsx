import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark'

interface ThemeModeCtx {
  mode: ThemeMode
  toggleMode: () => void
}

const ThemeModeContext = createContext<ThemeModeCtx | undefined>(undefined)
const STORAGE_KEY = 'ic-theme-mode'

function getInitialMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* localStorage unavailable — ignore */ }

  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* ignore */ }
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  const value = useMemo<ThemeModeCtx>(() => ({
    mode,
    toggleMode: () => setMode(m => (m === 'light' ? 'dark' : 'light')),
  }), [mode])

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
}

export function useThemeMode(): ThemeModeCtx {
  const ctx = useContext(ThemeModeContext)
  if (!ctx) throw new Error('useThemeMode must be used within a ThemeModeProvider')
  return ctx
}
