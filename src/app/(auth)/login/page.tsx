'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoginLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoginLoading(false)
    if (signInError) {
      setError('이메일 또는 패스워드가 올바르지 않습니다.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 px-4 py-12">
      <h1 className="text-2xl font-semibold">로그인</h1>
      <form className="flex flex-col gap-4" onSubmit={handleLogin}>
        <label className="flex flex-col gap-1 text-sm">
          <span>이메일</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loginLoading}
            className="rounded border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>패스워드</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loginLoading}
            className="rounded border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-600"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loginLoading}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loginLoading ? '처리 중…' : '로그인'}
        </button>
      </form>
    </main>
  )
}
