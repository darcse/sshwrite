'use client'

import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setLoginLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoginLoading(false)
    if (signInError) {
      setPasswordError('이메일 또는 패스워드가 올바르지 않습니다.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-[calc(100dvh-3rem)] flex-col items-center bg-[var(--background)] px-4 py-24">
      <div className="card-apple w-full max-w-[400px] -translate-y-6 p-10 sm:-translate-y-8">
        <div className="mb-8 text-center">
          <p className="text-base font-bold text-[var(--foreground)]">My Works</p>
          <h1 className="mt-2 text-sm font-medium text-[var(--muted)]">로그인</h1>
        </div>
        <form className="flex flex-col gap-5" onSubmit={handleLogin}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-sm text-[var(--muted)]">
              이메일
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loginLoading}
              className="input-apple w-full px-3 py-2.5"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-sm text-[var(--muted)]">
              패스워드
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordError) setPasswordError(null)
                }}
                required
                disabled={loginLoading}
                className="input-apple w-full px-3 py-2.5 pr-11"
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={passwordError ? 'login-password-error' : undefined}
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--muted)] transition-opacity hover:opacity-90"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loginLoading}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={2} aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={2} aria-hidden />
                )}
              </button>
            </div>
            {passwordError ? (
              <p id="login-password-error" className="text-xs text-[#ff3b30]" role="alert">
                {passwordError}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={loginLoading}
            className="btn-apple btn-apple-primary mt-1 w-full py-3 text-sm font-semibold disabled:opacity-50"
          >
            {loginLoading ? '처리 중…' : '로그인'}
          </button>
        </form>
        <p className="mt-8 text-center text-sm">
          <Link
            href="/signup"
            className="font-semibold text-[var(--link)] underline-offset-2 hover:underline"
          >
            회원가입
          </Link>
        </p>
      </div>
    </main>
  )
}
