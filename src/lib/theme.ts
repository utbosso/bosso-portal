export type PortalTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme'
export const THEME_CHANGE_EVENT = 'portal-theme-change'

export function getStoredTheme(): PortalTheme {
  if (typeof window === 'undefined') return 'light'
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function applyPortalTheme(theme: PortalTheme, persist = false) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.classList.toggle('light', theme === 'light')
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme

  if (persist) window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  window.dispatchEvent(new CustomEvent<PortalTheme>(THEME_CHANGE_EVENT, { detail: theme }))
}
