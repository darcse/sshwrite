'use client'

import type { CharacterRow } from '@/components/binder/CharacterPanel'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

type CharacterModalProps = {
  projectId: string
  uploadCharacterImage: (file: File) => Promise<string | null>
  kind: 'character' | 'place'
  initialRow: CharacterRow | null
  onClose: () => void
  onSaved: () => void
}

function normalizeTags(tags: unknown): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.filter((t): t is string => typeof t === 'string')
  return []
}

export function CharacterModal({
  projectId,
  uploadCharacterImage,
  kind,
  initialRow,
  onClose,
  onSaved,
}: CharacterModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [memo, setMemo] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialRow) {
      setName(initialRow.name)
      setDescription(initialRow.description ?? '')
      setMemo(initialRow.memo ?? '')
      setTags(normalizeTags(initialRow.tags))
      setImageUrl(initialRow.image_url)
      setImageUrlInput(initialRow.image_url ?? '')
    } else {
      setName('')
      setDescription('')
      setMemo('')
      setTags([])
      setImageUrl(null)
      setImageUrlInput('')
    }
    setTagInput('')
  }, [initialRow, kind])

  const title = useMemo(
    () =>
      kind === 'character'
        ? initialRow
          ? '등장인물'
          : '새 등장인물'
        : initialRow
          ? '장소'
          : '새 장소',
    [kind, initialRow]
  )

  const onTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      const t = tagInput.trim()
      if (!t) return
      if (!tags.includes(t)) setTags((prev) => [...prev, t])
      setTagInput('')
    },
    [tagInput, tags]
  )

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadCharacterImage) return
    const url = await uploadCharacterImage(file)
    if (url) {
      setImageUrl(url)
      setImageUrlInput(url)
    }
    e.target.value = ''
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    const payload = {
      project_id: projectId,
      user_id: user.id,
      type: kind,
      name: trimmed,
      description: description.trim() || null,
      memo: memo.trim() || null,
      tags,
      image_url: imageUrl,
    }
    if (initialRow?.id) {
      await supabase
        .from('write_characters')
        .update(payload)
        .eq('id', initialRow.id)
        .eq('user_id', user.id)
    } else {
      const { data: maxRows } = await supabase
        .from('write_characters')
        .select('order_index')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('type', kind)
        .order('order_index', { ascending: false })
        .limit(1)
      const nextOrder =
        maxRows && maxRows.length > 0 && typeof maxRows[0].order_index === 'number'
          ? maxRows[0].order_index + 1
          : 0
      await supabase.from('write_characters').insert({
        ...payload,
        order_index: nextOrder,
      })
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!initialRow?.id) return
    if (!window.confirm('삭제할까요?')) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    await supabase
      .from('write_characters')
      .delete()
      .eq('id', initialRow.id)
      .eq('user_id', user.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4 modal-overlay-apple"
      role="dialog"
      aria-modal
      aria-labelledby="character-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal-panel-apple w-full max-w-md overflow-auto p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 id="character-modal-title" className="text-lg font-semibold text-[var(--foreground)]">
            {title}
          </h2>
          <button
            type="button"
            className="rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={onClose}
            aria-label="닫기"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">이름</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input-apple px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">설명</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-apple px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">메모</span>
            <textarea
              rows={4}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="input-apple resize-none px-2 py-1.5"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">태그</span>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKeyDown}
              placeholder="입력 후 Enter"
              className="input-apple px-2 py-1.5"
            />
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="badge-apple inline-flex items-center gap-1 px-2 py-0.5"
                >
                  {t}
                  <button
                    type="button"
                    className="text-[var(--muted)] hover:text-[var(--foreground)]"
                    onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                    aria-label={`${t} 제거`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[var(--muted)]">이미지</span>
            {imageUrl ? (
              <div className="flex items-center gap-2">
                <img src={imageUrl} alt="" className="h-16 w-16 rounded object-cover" />
                <button
                  type="button"
                  className="btn-apple btn-apple-secondary px-2 py-1 text-xs"
                  onClick={() => {
                    setImageUrl(null)
                    setImageUrlInput('')
                  }}
                >
                  제거
                </button>
              </div>
            ) : null}
            <input type="file" accept="image/*" onChange={(e) => void onFileChange(e)} />
            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="h-px flex-1 bg-[var(--border)]" />
              <span>또는 이미지 URL 입력</span>
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <input
              type="url"
              value={imageUrlInput}
              onChange={(e) => {
                const next = e.target.value
                setImageUrlInput(next)
                setImageUrl(next.trim() || null)
              }}
              placeholder="https://..."
              className="input-apple px-2 py-1.5"
            />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          {initialRow?.id ? (
            <button
              type="button"
              className="btn-apple btn-apple-danger mr-auto px-3 py-2 text-sm"
              disabled={saving}
              onClick={() => void handleDelete()}
            >
              삭제
            </button>
          ) : null}
          <button
            type="button"
            className="btn-apple btn-apple-secondary px-3 py-2 text-sm"
            onClick={onClose}
            disabled={saving}
          >
            취소
          </button>
          <button
            type="button"
            className="btn-apple btn-apple-primary px-3 py-2 text-sm"
            disabled={saving || !name.trim()}
            onClick={() => void handleSave()}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
