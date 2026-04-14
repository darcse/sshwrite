'use client'

import { createClient } from '@/lib/supabase/client'
import { ScrollText, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function StoryBiblePanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const hydratedRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    hydratedRef.current = false
    let alive = true
    void (async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('write_projects')
        .select('worldview_context')
        .eq('id', projectId)
        .maybeSingle()
      if (!alive) return
      if (error) {
        console.error(error)
        return
      }
      const row = data as { worldview_context?: string | null } | null
      setDraft(
        typeof row?.worldview_context === 'string' ? row.worldview_context : ''
      )
      hydratedRef.current = true
    })()
    return () => {
      alive = false
    }
  }, [projectId])

  useEffect(() => {
    if (!hydratedRef.current) return
    const t = window.setTimeout(() => {
      void (async () => {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return
        const { error } = await supabase
          .from('write_projects')
          .update({ worldview_context: draft })
          .eq('id', projectId)
          .eq('user_id', user.id)
        if (error) console.error(error)
      })()
    }, 1000)
    return () => window.clearTimeout(t)
  }, [draft, projectId])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        aria-label="스토리 바이블"
        title="스토리 바이블"
      >
        <ScrollText className="h-5 w-5" strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          className="fixed z-[400] flex w-[min(100vw-2rem,30rem)] flex-col gap-3 rounded-xl border p-4 shadow-xl"
          style={{
            top: 'calc(3rem + 3rem + 0.5rem + env(safe-area-inset-top, 0px))',
            right: 'max(1rem, env(safe-area-inset-right, 0px))',
            borderColor: 'var(--border)',
            backgroundColor: 'var(--card-bg)',
            maxHeight: 'min(68vh, 38rem)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              스토리 바이블
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)]"
              aria-label="닫기"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="세계관·설정 메모…"
            className="input-apple min-h-[16rem] w-full flex-1 resize-y px-3 py-2.5 text-sm leading-relaxed"
            autoFocus
          />
        </div>
      ) : null}
    </div>
  )
}
