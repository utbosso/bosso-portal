'use client'

import { useEffect } from 'react'
import { applyPortalTheme, getStoredTheme, THEME_STORAGE_KEY } from '@/lib/theme'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyPortalTheme(getStoredTheme())

    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) applyPortalTheme(event.newValue === 'dark' ? 'dark' : 'light')
    }
    window.addEventListener('storage', syncAcrossTabs)
    return () => window.removeEventListener('storage', syncAcrossTabs)
  }, [])

  return <>{children}</>
}
