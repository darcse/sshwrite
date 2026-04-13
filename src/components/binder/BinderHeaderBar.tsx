'use client'

import { useBinderContext } from '@/components/binder/BinderTree'
import { FilePlus, FolderPlus } from 'lucide-react'
import { useState } from 'react'

export function BinderPanelToggleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="4" height="12" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="8" y="2" width="6" height="12" rx="1" fill="currentColor" />
    </svg>
  )
}

export function BinderHeaderBar({ onCollapse }: { onCollapse: () => void }) {
  const { createDocument, createFolder, loading } = useBinderContext()
  const [pending, setPending] = useState(false)
  const busy = loading || pending

  async function run(fn: () => Promise<void>) {
    setPending(true)
    try {
      await fn()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--card-bg)] px-4">
      <span className="text-sm font-medium text-[var(--foreground)]">Binder</span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => run(createDocument)}
          disabled={busy}
          className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
          title="새 문서"
        >
          <FilePlus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => run(createFolder)}
          disabled={busy}
          className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
          title="새 폴더"
        >
          <FolderPlus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onCollapse}
          className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          aria-expanded
          aria-controls="binder-panel"
          title="바인더 접기"
        >
          <BinderPanelToggleIcon />
        </button>
      </div>
    </div>
  )
}
