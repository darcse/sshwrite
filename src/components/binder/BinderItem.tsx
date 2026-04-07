'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DocRow } from '@/components/binder/BinderTree'
import { useBinderContext } from '@/components/binder/BinderTree'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  Trash2,
} from 'lucide-react'
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

const DROP_LINE_STYLE: React.CSSProperties = {
  height: 2,
  borderRadius: 1,
  backgroundColor: '#007AFF',
  marginInline: 8,
}

export function BinderItem({ doc, depth, renderNested }: BinderItemProps) {
  const {
    selectedDocId,
    navigateToDoc,
    deleteDocument,
    getLabel,
    refresh,
    dragOverInfo,
  } = useBinderContext()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(doc.title)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(true)
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    paddingLeft: depth * 12,
  }

  const isDropTarget = dragOverInfo?.id === doc.id
  const dropPosition = isDropTarget ? dragOverInfo!.position : null
  const isDropBefore = dropPosition === 'before'
  const isDropAfter = dropPosition === 'after'
  const isFolderOver = dropPosition === 'into' && doc.type === 'folder'

  const selected = selectedDocId === doc.id
  const labelId = ((doc as unknown as { label_id?: string | null }).label_id ?? doc.label) ?? null
  const label = getLabel(labelId)
  const documentFileColor =
    doc.type === 'document'
      ? (doc.status === 'writing'
        ? '#007AFF'
        : doc.status === 'done'
          ? '#34C759'
          : 'var(--muted)')
      : undefined

  const folderIconColor = isFolderOver ? '#007AFF' : '#F5A623'

  const rowStyle: React.CSSProperties = isFolderOver
    ? { backgroundColor: 'rgba(0, 122, 255, 0.1)' }
    : selected
      ? { backgroundColor: 'var(--badge-bg)' }
      : {}

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
      {isDropBefore && <div style={DROP_LINE_STYLE} />}
      <div
        className={`group flex h-8 min-w-0 items-center gap-1 rounded-[6px] px-2 transition-colors ${
          selected && !isFolderOver
            ? ''
            : 'hover:bg-[color-mix(in_srgb,var(--badge-bg)_50%,transparent)]'
        }`}
        style={rowStyle}
      >
        {doc.type === 'folder' ? (
          <button
            type="button"
            className="flex h-8 w-4 shrink-0 items-center justify-center text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            aria-expanded={expanded}
            aria-label={expanded ? '폴더 접기' : '폴더 펼치기'}
          >
            {expanded ? (
              <ChevronDown className="h-2 w-2" strokeWidth={2} aria-hidden />
            ) : (
              <ChevronRight className="h-2 w-2" strokeWidth={2} aria-hidden />
            )}
          </button>
        ) : (
          <span className="inline-block w-4 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          className="cursor-grab touch-none shrink-0 px-0.5 text-xs leading-none opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: 'var(--muted)' }}
          aria-label="순서 변경"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        {doc.type === 'folder' ? (
          <Folder
            className="h-4 w-4 shrink-0"
            style={{ color: folderIconColor, transition: 'color 0.15s' }}
            strokeWidth={2}
            aria-hidden
          />
        ) : (
          <>
            {label ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: label.color }}
                aria-hidden
              />
            ) : null}
            <File
              className="h-4 w-4 shrink-0"
              style={{ color: documentFileColor }}
              strokeWidth={2}
              aria-hidden
            />
          </>
        )}
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            className="min-h-0 min-w-0 flex-1 rounded border px-1 py-0 text-sm leading-none"
            style={{
              height: 24,
              borderColor: 'var(--border)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--foreground)',
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
            className="min-w-0 flex-1 truncate text-left text-sm text-[var(--foreground)]"
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
        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="rounded p-0.5 text-[var(--muted)] transition-colors hover:text-[#ff3b30]"
            aria-label="삭제"
            onClick={(e) => {
              e.stopPropagation()
              deleteDocument(doc.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
      {isDropAfter && <div style={DROP_LINE_STYLE} />}
      {doc.type === 'folder' && renderNested && expanded ? (
        <div className="mt-0.5">{renderNested(doc.id)}</div>
      ) : null}
    </div>
  )
}
