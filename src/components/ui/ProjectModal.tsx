'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, type FormEvent } from 'react'

export type ProjectModalProject = {
  id: string
  title: string
  description: string | null
}

type ProjectModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  project: ProjectModalProject | null
  onClose: () => void
  onSaved: () => void
}

export function ProjectModal({ open, mode, project, onClose, onSaved }: ProjectModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && project) {
      setTitle(project.title)
      setDescription(project.description ?? '')
    } else {
      setTitle('')
      setDescription('')
    }
    setError(null)
  }, [open, mode, project])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('제목을 입력해 주세요.')
      return
    }
    setError(null)
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setError('로그인이 필요합니다.')
      return
    }

    if (mode === 'create') {
      const { error: insertError } = await supabase.from('write_projects').insert({
        title: trimmed,
        description: description.trim() || null,
        user_id: user.id,
      })
      setSaving(false)
      if (insertError) {
        setError(insertError.message)
        return
      }
    } else if (project) {
      const { error: updateError } = await supabase
        .from('write_projects')
        .update({
          title: trimmed,
          description: description.trim() || null,
        })
        .eq('id', project.id)
        .eq('user_id', user.id)
      setSaving(false)
      if (updateError) {
        setError(updateError.message)
        return
      }
    }

    onSaved()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-lg border p-6 shadow-lg"
        style={{
          backgroundColor: 'var(--surface-color)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-md)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="project-modal-title"
          className="mb-4 text-lg font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {mode === 'create' ? '새 프로젝트' : '프로젝트 수정'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>제목</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              className="rounded border px-3 py-2"
              style={{
                borderColor: 'var(--border-color)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
              }}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>설명 (선택)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={4}
              className="resize-y rounded border px-3 py-2"
              style={{
                borderColor: 'var(--border-color)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
              }}
            />
          </label>
          {error ? (
            <p className="text-sm" style={{ color: '#b91c1c' }} role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => !saving && onClose()}
              disabled={saving}
              className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: 'var(--border-color)',
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--surface-color)',
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
