'use client'

import { useEffect } from 'react'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply saved theme on mount
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'light') {
      document.body.classList.add('light')
    } else {
      document.body.classList.remove('light')
    }
  }, [])

  return <>{children}</>
}
