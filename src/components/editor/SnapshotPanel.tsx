'use client'

import { createClient } from '@/lib/supabase/client'
import { tiptapToPlainText } from '@/lib/doc-utils'
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core'
import { Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

let snapshotEditor: TiptapEditor | null = null
let snapshotFlushSave: (() => Promise<void>) | null = null

export function registerSnapshotBridge(
  editor: TiptapEditor | null,
  flushSave: (() => Promise<void>) | null
) {
  snapshotEditor = editor
  snapshotFlushSave = flushSave
}

type SnapshotRow = {
  id: string
  name: string
  content: unknown
  created_at: string
}

export function SnapshotPanel({ documentId }: { documentId: string }) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [nameOpen, setNameOpen] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [savingSnap, setSavingSnap] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<SnapshotRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSnapshots([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('write_snapshots')
      .select('id,name,content,created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
    if (error) {
      setSnapshots([])
    } else {
      setSnapshots((data ?? []) as SnapshotRow[])
    }
    setLoading(false)
  }, [documentId])

  useEffect(() => {
    setSelected(null)
    void load()
  }, [load])

  useEffect(() => {
    if (!nameOpen) return
    setNameValue('')
  }, [nameOpen])

  async function saveSnapshot() {
    const name = nameValue.trim()
    if (!name) return
    const ed = snapshotEditor
    if (!ed) {
      window.alert('에디터를 불러올 수 없습니다.')
      return
    }
    if (!ed.getText().trim()) {
      window.alert('내용이 비어 있는 문서는 스냅샷으로 저장할 수 없습니다.')
      return
    }
    const json = ed.getJSON()
    setSavingSnap(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        window.alert('로그인이 필요합니다.')
        return
      }
      const { error } = await supabase.from('write_snapshots').insert({
        document_id: documentId,
        user_id: user.id,
        name,
        content: json,
      })
      if (error) {
        window.alert('스냅샷 저장에 실패했습니다.')
        return
      }
      setNameOpen(false)
      setNameValue('')
      await load()
    } finally {
      setSavingSnap(false)
    }
  }

  async function restore() {
    if (!selected) return
    if (!window.confirm('현재 문서 내용을 이 스냅샷으로 바꿉니다. 계속할까요?')) return
    const ed = snapshotEditor
    const flush = snapshotFlushSave
    if (!ed || !flush) {
      window.alert('에디터를 불러올 수 없습니다.')
      return
    }
    ed.commands.setContent(selected.content as JSONContent)
    await flush()
  }

  async function removeSnapshot(s: SnapshotRow) {
    if (!window.confirm(`「${s.name}」 스냅샷을 삭제할까요?`)) return
    setDeletingId(s.id)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        window.alert('로그인이 필요합니다.')
        return
      }
      const { error } = await supabase
        .from('write_snapshots')
        .delete()
        .eq('id', s.id)
        .eq('user_id', user.id)
      if (error) {
        window.alert('스냅샷 삭제에 실패했습니다.')
        return
      }
      if (selected?.id === s.id) setSelected(null)
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  function formatWhen(iso: string) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const previewText = selected ? tiptapToPlainText(selected.content) : ''

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setNameOpen(true)}
        className="rounded px-2 py-1.5 text-xs font-semibold text-[var(--foreground)] disabled:opacity-50"
        style={{ backgroundColor: 'var(--badge-bg)' }}
        disabled={savingSnap}
      >
        스냅샷 저장
      </button>
      {loading ? (
        <p className="text-xs text-[var(--muted)]">불러오는 중…</p>
      ) : snapshots.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">저장된 스냅샷이 없습니다.</p>
      ) : (
        <ul className="max-h-40 overflow-y-auto rounded border border-[var(--border)]">
          {snapshots.map((s) => (
            <li
              key={s.id}
              className="flex border-b border-[var(--border)] last:border-b-0"
            >
              <button
                type="button"
                onClick={() => setSelected(s)}
                className="min-w-0 flex-1 px-2 py-1.5 text-left text-xs transition-colors"
                style={{
                  backgroundColor:
                    selected?.id === s.id ? 'var(--badge-bg)' : 'transparent',
                  color: 'var(--foreground)',
                }}
              >
                <span className="block font-medium">{s.name}</span>
                <span className="text-[var(--muted)]">{formatWhen(s.created_at)}</span>
              </button>
              <button
                type="button"
                onClick={() => void removeSnapshot(s)}
                disabled={deletingId !== null}
                className="shrink-0 px-2 text-[var(--muted)] transition-colors hover:text-[#ff3b30] disabled:opacity-50"
                aria-label="스냅샷 삭제"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-[var(--muted)]">미리보기</span>
          <pre
            className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1.5 text-xs text-[var(--foreground)]"
            style={{ fontFamily: 'inherit' }}
          >
            {previewText || '(빈 내용)'}
          </pre>
          <button
            type="button"
            onClick={() => void restore()}
            className="rounded px-2 py-1.5 text-xs font-semibold text-[var(--foreground)]"
            style={{ backgroundColor: 'var(--badge-bg)' }}
          >
            복원
          </button>
        </div>
      ) : null}
      {nameOpen ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNameOpen(false)
          }}
        >
          <div
            className="w-full max-w-sm rounded-lg border p-4 shadow-lg"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--card-bg)',
            }}
            role="dialog"
            aria-modal
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-sm font-medium text-[var(--foreground)]">스냅샷 이름</p>
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              placeholder="이름을 입력하세요"
              className="input-apple mb-3 w-full px-2 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void saveSnapshot()
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNameOpen(false)}
                className="rounded px-3 py-1.5 text-xs text-[var(--muted)]"
                disabled={savingSnap}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void saveSnapshot()}
                disabled={savingSnap || !nameValue.trim()}
                className="rounded px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] disabled:opacity-50"
                style={{ backgroundColor: 'var(--badge-bg)' }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
