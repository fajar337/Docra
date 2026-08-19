import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'docra-theme'

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function ThemeToggle() {
  const [storedPreference] = useState<Theme | null>(storedTheme)
  const manualTheme = useRef<Theme | null>(storedPreference)
  const [theme, setTheme] = useState<Theme>(
    () => storedPreference ?? systemTheme(),
  )

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const followSystemTheme = (event: MediaQueryListEvent) => {
      if (!manualTheme.current) {
        setTheme(event.matches ? 'dark' : 'light')
      }
    }

    media.addEventListener('change', followSystemTheme)
    return () => media.removeEventListener('change', followSystemTheme)
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    manualTheme.current = nextTheme
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    } catch {
      // The selected theme still applies for this session if storage is blocked.
    }
    setTheme(nextTheme)
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-label="Dark mode"
      aria-checked={isDark}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      onClick={toggleTheme}
    >
      <Sun
        className="theme-toggle__icon"
        data-active={!isDark}
        aria-hidden="true"
      />
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
      </span>
      <Moon
        className="theme-toggle__icon"
        data-active={isDark}
        aria-hidden="true"
      />
    </button>
  )
}
