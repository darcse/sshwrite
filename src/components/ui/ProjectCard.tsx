'use client'

import Link from 'next/link'
import type { ProjectModalProject } from '@/components/ui/ProjectModal'
import { Pencil, Trash2 } from 'lucide-react'

type ProjectStats = {
  document_total: number
  todo: number
  writing: number
  done: number
  character_count: number
  place_count: number
}

type ProjectCardProps = {
  project: ProjectModalProject & { place_image_url?: string | null; stats?: ProjectStats }
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
}

function formatUpdatedAt(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ProjectCard({ project, deleting, onEdit, onDelete }: ProjectCardProps) {
  const coverColor = project.cover_color?.trim()
  const coverImage = project.place_image_url
  const updatedLabel = formatUpdatedAt(project.updated_at)
  const onCover = Boolean(coverColor || coverImage)
  const stats = project.stats ?? {
    document_total: 0,
    todo: 0,
    writing: 0,
    done: 0,
    character_count: 0,
    place_count: 0,
  }
  const total = stats.document_total
  const todoPct = total > 0 ? (stats.todo / total) * 100 : 0
  const writingPct = total > 0 ? (stats.writing / total) * 100 : 0
  const donePct = total > 0 ? (stats.done / total) * 100 : 0

  return (
    <article className="group card-apple relative overflow-hidden">
      <div className="relative">
        <Link href={`/projects/${project.id}`} className="block">
          <div className="relative min-h-[172px] overflow-hidden px-4 pb-12 pt-5">
            {coverImage ? (
              <div className="absolute inset-0 z-0">
                <img src={coverImage} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div
                className={
                  onCover
                    ? 'absolute inset-0 z-0'
                    : 'absolute inset-0 z-0 bg-gradient-to-b from-[var(--badge-bg)] to-[var(--card-bg)]'
                }
                style={
                  onCover
                    ? {
                        background: `linear-gradient(165deg, ${coverColor} 0%, ${coverColor} 52%, rgba(0,0,0,0.18) 100%)`,
                      }
                    : undefined
                }
              />
            )}
            {coverImage ? (
              <div
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/60 via-black/20 to-transparent"
                aria-hidden
              />
            ) : null}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-14 bg-gradient-to-t from-[var(--card-bg)] via-[var(--card-bg)]/70 to-transparent"
              aria-hidden
            />
            <h2
              className={`relative z-[3] line-clamp-4 text-[20px] font-bold leading-snug ${
                onCover ? 'text-white drop-shadow-sm' : 'text-[var(--foreground)]'
              }`}
            >
              {project.title}
            </h2>
          </div>
          <div className="space-y-2 p-4 pt-1">
            <p className="truncate text-base font-bold text-[var(--foreground)]">{project.title}</p>
            <p className="line-clamp-1 text-sm text-[var(--muted)]">{project.description || ' '}</p>
            <p className="text-[13px] text-[var(--muted)]">
              📄 {stats.document_total}개&nbsp;&nbsp;&nbsp;👤 {stats.character_count}명&nbsp;&nbsp;&nbsp;📍{' '}
              {stats.place_count}곳
            </p>
            {total > 0 ? (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--badge-bg)]">
                <div className="flex h-full w-full">
                  <div style={{ width: `${todoPct}%`, backgroundColor: 'var(--badge-bg)' }} />
                  <div style={{ width: `${writingPct}%`, backgroundColor: 'var(--accent)' }} />
                  <div style={{ width: `${donePct}%`, backgroundColor: '#34C759' }} />
                </div>
              </div>
            ) : null}
            {updatedLabel ? (
              <p className="text-[12px] text-[var(--muted)]">최근 수정 {updatedLabel}</p>
            ) : null}
          </div>
        </Link>
        <div className="absolute right-2 top-2 z-20 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEdit()
            }}
            disabled={deleting}
            className="rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
            aria-label="수정"
          >
            <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete()
            }}
            disabled={deleting}
            className="rounded p-1 text-[var(--muted)] transition-colors hover:text-[#ff3b30] disabled:opacity-50"
            aria-label={deleting ? '삭제 중' : '삭제'}
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </article>
  )
}
