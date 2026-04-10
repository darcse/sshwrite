'use client'

import { createClient } from '@/lib/supabase/client'
import { Geist, Geist_Mono } from 'next/font/google'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogIn, Monitor, Moon, Sun } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const THEME_STORAGE_KEY = 'sshwrite:theme'

type ThemeMode = 'light' | 'dark' | 'auto'

function applyTheme(mode: ThemeMode) {
  const el = document.documentElement
  el.classList.remove('theme-light', 'theme-dark')
  if (mode === 'light') el.classList.add('theme-light')
  if (mode === 'dark') el.classList.add('theme-dark')
}

function HeaderBar() {
  const router = useRouter()
  const [userPresent, setUserPresent] = useState(false)
  const [ready, setReady] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserPresent(!!user)
      setReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserPresent(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY)
      const m: ThemeMode =
        raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'auto'
      setThemeMode(m)
      applyTheme(m)
    } catch {
      setThemeMode('auto')
      applyTheme('auto')
    }
  }, [])

  const selectTheme = useCallback((next: ThemeMode) => {
    setThemeMode(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {}
    applyTheme(next)
  }, [])

  async function handleLogout() {
    setLogoutLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
    setLogoutLoading(false)
  }

  return (
    <header className="border-b border-[var(--border)] bg-[var(--background)]">
      <div className="relative flex h-12 w-full items-center justify-end pr-4">
        <Link
          href="/"
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left: 16,
            fontWeight: 700,
            fontSize: '16px',
            color: 'var(--foreground)',
          }}
        >
          My Works
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5" role="group" aria-label="테마">
            <button
              type="button"
              onClick={() => selectTheme('light')}
              className="rounded-md p-1.5 transition-opacity hover:opacity-90"
              style={{
                color: themeMode === 'light' ? 'var(--foreground)' : 'var(--muted)',
              }}
              aria-label="라이트"
            >
              <Sun className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => selectTheme('dark')}
              className="rounded-md p-1.5 transition-opacity hover:opacity-90"
              style={{
                color: themeMode === 'dark' ? 'var(--foreground)' : 'var(--muted)',
              }}
              aria-label="다크"
            >
              <Moon className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => selectTheme('auto')}
              className="rounded-md p-1.5 transition-opacity hover:opacity-90"
              style={{
                color: themeMode === 'auto' ? 'var(--foreground)' : 'var(--muted)',
              }}
              aria-label="시스템"
            >
              <Monitor className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
          {ready && userPresent ? (
            <button
              type="button"
              disabled={logoutLoading}
              onClick={handleLogout}
              className="btn-apple btn-apple-secondary px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {logoutLoading ? '처리 중…' : '로그아웃'}
            </button>
          ) : ready && !userPresent ? (
            <Link
              href="/login"
              className="rounded-md p-1.5 transition-opacity hover:opacity-90"
              style={{ color: 'var(--foreground)' }}
              aria-label="로그인"
            >
              <LogIn className="h-4 w-4" strokeWidth={2} aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var k='sshwrite:theme';var v=localStorage.getItem(k);var h=document.documentElement;h.classList.remove('theme-light','theme-dark');if(v==='light')h.classList.add('theme-light');else if(v==='dark')h.classList.add('theme-dark');}catch(e){}})();",
          }}
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        <title>sshwrite</title>
      </head>
      <body className="flex min-h-[100dvh] flex-col" suppressHydrationWarning>
        <HeaderBar />
        {children}
      </body>
    </html>
  )
}
