'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'sshwrite:theme'

type ThemeMode = 'light' | 'dark' | 'auto'

function applyTheme(mode: ThemeMode) {
  const el = document.documentElement
  el.classList.remove('theme-light', 'theme-dark')
  if (mode === 'light') el.classList.add('theme-light')
  if (mode === 'dark') el.classList.add('theme-dark')
}

export function ThemeSwitch() {
  const [mode, setMode] = useState<ThemeMode>('auto')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const m: ThemeMode =
        raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'auto'
      setMode(m)
      applyTheme(m)
    } catch {
      setMode('auto')
      applyTheme('auto')
    }
  }, [])

  const select = useCallback((next: ThemeMode) => {
    setMode(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
    applyTheme(next)
  }, [])

  if (!mounted) return null

  return (
    <div
      className="flex items-center gap-0.5 rounded-[10px] border p-0.5"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--card-bg)',
      }}
      role="group"
      aria-label="테마"
      suppressHydrationWarning
    >
      {(['light', 'dark', 'auto'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => select(m)}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-opacity"
          style={{
            color: mode === m ? 'var(--foreground)' : 'var(--muted)',
            backgroundColor: mode === m ? 'var(--badge-bg)' : 'transparent',
          }}
        >
          {m === 'light' ? 'Light' : m === 'dark' ? 'Dark' : 'Auto'}
        </button>
      ))}
    </div>
  )
}
