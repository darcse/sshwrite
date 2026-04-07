'use client'

import { createClient } from '@/lib/supabase/client'
import { Geist, Geist_Mono } from 'next/font/google'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

function HeaderBar() {
  const router = useRouter()
  const [userPresent, setUserPresent] = useState(false)
  const [ready, setReady] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)

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

  async function handleLogout() {
    setLogoutLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
    setLogoutLoading(false)
  }

  return (
    <header className="flex items-center justify-end border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      {ready && userPresent ? (
        <button
          type="button"
          disabled={logoutLoading}
          onClick={handleLogout}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-600"
        >
          {logoutLoading ? '처리 중…' : '로그아웃'}
        </button>
      ) : null}
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
    >
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        <title>sshwrite</title>
      </head>
      <body className="min-h-full flex flex-col">
        <HeaderBar />
        {children}
      </body>
    </html>
  )
}
