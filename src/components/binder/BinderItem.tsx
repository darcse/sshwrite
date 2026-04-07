'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DocRow, LabelRow } from '@/components/binder/BinderTree'
import { useBinderContext } from '@/components/binder/BinderTree'
import { createClient } from '@/lib/supabase/client'
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type BinderItemProps = {
  doc: DocRow
  depth: number
  renderNested?: (folderId: string) => ReactNode
}

export function BinderItem({ doc, depth, renderNested }: BinderItemProps) {
  const {
    selectedDocId,
    navigateToDoc,
    deleteDocument,
    getLabel,
    refresh,
  } = useBinderContext()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(doc.title)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!editing) setDraft(doc.title)
  }, [doc.title, doc.id, editing])

  useEffect(() => {
    return () => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    paddingLeft: depth * 12,
  }

  const selected = selectedDocId === doc.id
  const label = getLabel(doc.label)

  function cancelEdit() {
    setDraft(doc.title)
    setEditing(false)
  }

  async function commitOrRestore() {
    if (saving) return
    const trimmed = draft.trim()
    if (!trimmed) {
      setDraft(doc.title)
      setEditing(false)
      return
    }
    if (trimmed === doc.title) {
      setEditing(false)
      return
    }
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id
    if (!userId) {
      setDraft(doc.title)
      setEditing(false)
      setSaving(false)
      return
    }
    const { error } = await supabase
      .from('write_documents')
      .update({ title: trimmed })
      .eq('id', doc.id)
      .eq('user_id', userId)
    setSaving(false)
    if (error) {
      setDraft(doc.title)
      setEditing(false)
      return
    }
    await refresh()
    setEditing(false)
  }

  function scheduleNavigate() {
    if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
    navigateTimerRef.current = setTimeout(() => {
      navigateTimerRef.current = null
      if (!editing) navigateToDoc(doc.id)
    }, 250)
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="group flex min-w-0 items-center gap-1 rounded border px-1 py-1"
        style={{
          borderColor: selected ? 'var(--accent-color)' : 'transparent',
          backgroundColor: selected
            ? 'color-mix(in srgb, var(--accent-color) 12%, transparent)'
            : 'transparent',
        }}
      >
        <button
          type="button"
          className="cursor-grab touch-none px-0.5 text-xs leading-none"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="순서 변경"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        {doc.type === 'folder' ? (
          <span className="shrink-0 text-xs" aria-hidden>
            📁
          </span>
        ) : (
          <LabelDot label={label} status={doc.status} />
        )}
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            className="min-w-0 flex-1 rounded border px-1 py-0.5 text-sm"
            style={{
              borderColor: 'var(--border-color)',
              backgroundColor: 'var(--surface-color)',
              color: 'var(--text-primary)',
            }}
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commitOrRestore()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void commitOrRestore()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                cancelEdit()
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-sm"
            style={{ color: 'var(--text-primary)' }}
            onClick={scheduleNavigate}
            onDoubleClick={(e) => {
              e.preventDefault()
              if (navigateTimerRef.current) {
                clearTimeout(navigateTimerRef.current)
                navigateTimerRef.current = null
              }
              setDraft(doc.title)
              setEditing(true)
            }}
          >
            {doc.title}
          </button>
        )}
        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-xs"
            style={{
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: 'var(--border-color)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--surface-color)',
            }}
            onClick={(e) => {
              e.stopPropagation()
              deleteDocument(doc.id)
            }}
          >
            삭제
          </button>
        </div>
      </div>
      {doc.type === 'folder' && renderNested ? (
        <div className="mt-0.5 border-l pl-1" style={{ borderColor: 'var(--border-color)' }}>
          {renderNested(doc.id)}
        </div>
      ) : null}
    </div>
  )
}

function LabelDot({
  label,
  status,
}: {
  label: LabelRow | undefined
  status: string
}) {
  const bg = label?.color ?? 'var(--border-color)'
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border"
      style={{
        backgroundColor: bg,
        borderColor: 'var(--border-color)',
        boxShadow:
          status === 'done'
            ? '0 0 0 1px var(--accent-color)'
            : status === 'writing'
              ? '0 0 0 1px #f59e0b'
              : undefined,
      }}
      title={label?.name ?? '라벨 없음'}
      aria-hidden
    />
  )
}
