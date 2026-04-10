'use client'

import { createClient } from '@/lib/supabase/client'
import { BookOpen, Music, Upload, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

export type ProjectModalProject = {
  id: string
  title: string
  description: string | null
  type?: 'novel' | 'lyrics' | null
  cover_color?: string | null
  cover_image_url?: string | null
  updated_at?: string | null
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
  const [projectType, setProjectType] = useState<'novel' | 'lyrics'>('novel')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && project) {
      setTitle(project.title)
      setDescription(project.description ?? '')
      setProjectType(project.type === 'lyrics' ? 'lyrics' : 'novel')
      setCoverImageUrl(project.cover_image_url ?? '')
    } else {
      setTitle('')
      setDescription('')
      setProjectType('novel')
      setCoverImageUrl('')
    }
    setError(null)
  }, [open, mode, project])

  if (!open) return null

  async function handleUploadCover(file: File) {
    setUploading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setUploading(false)
      setError('로그인이 필요합니다.')
      return
    }
    const parts = file.name.split('.')
    const last = parts[parts.length - 1]
    const ext = parts.length > 1 && last && /^[a-zA-Z0-9]+$/.test(last) ? last : 'jpg'
    const path = `projects/${user.id}/covers/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('write-assets').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (uploadError) {
      setUploading(false)
      setError(uploadError.message)
      return
    }
    const { data } = supabase.storage.from('write-assets').getPublicUrl(path)
    setCoverImageUrl(data.publicUrl)
    setUploading(false)
  }

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
        type: projectType,
        cover_image_url: coverImageUrl.trim() || null,
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
          type: projectType,
          cover_image_url: coverImageUrl.trim() || null,
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
      className="modal-overlay-apple fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        className="modal-panel-apple w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="project-modal-title" className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          {mode === 'create' ? '새 프로젝트' : '프로젝트 수정'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">제목</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              className="input-apple w-full px-3 py-2"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">설명 (선택)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={4}
              className="input-apple w-full resize-y px-3 py-2"
            />
          </label>
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-[var(--muted)]">타입</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setProjectType('novel')}
                className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs"
                style={{
                  backgroundColor: projectType === 'novel' ? 'var(--badge-bg)' : 'transparent',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                소설
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setProjectType('lyrics')}
                className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs"
                style={{
                  backgroundColor: projectType === 'lyrics' ? 'var(--badge-bg)' : 'transparent',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                <Music className="h-3.5 w-3.5" aria-hidden />
                가사
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-[var(--muted)]">배경 이미지 (선택)</span>
            {coverImageUrl ? (
              <div className="relative h-28 overflow-hidden rounded border border-[var(--border)]">
                <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  disabled={saving || uploading}
                  onClick={() => setCoverImageUrl('')}
                  className="absolute right-1 top-1 rounded bg-black/45 p-1 text-white"
                  aria-label="이미지 제거"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)]">
                <Upload className="h-3.5 w-3.5" aria-hidden />
                {uploading ? '업로드 중…' : '파일 업로드'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={saving || uploading}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleUploadCover(file)
                    e.currentTarget.value = ''
                  }}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[var(--muted)]">또는 URL 입력</span>
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                disabled={saving || uploading}
                placeholder="https://..."
                className="input-apple w-full px-3 py-2"
              />
            </label>
          </div>
          {error ? (
            <p className="text-sm text-[#ff3b30]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => !saving && onClose()}
              disabled={saving}
              className="btn-apple btn-apple-secondary px-4 py-2 text-sm disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-apple btn-apple-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
