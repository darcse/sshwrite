'use client'

import Link from 'next/link'
import type { ProjectModalProject } from '@/components/ui/ProjectModal'

type ProjectCardProps = {
  project: ProjectModalProject
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
  const updatedLabel = formatUpdatedAt(project.updated_at)
  const onCover = Boolean(coverColor)

  return (
    <article className="group card-apple relative overflow-hidden">
      <div className="relative">
        <Link href={`/projects/${project.id}`} className="block">
          <div className="relative min-h-[132px] overflow-hidden px-4 pb-12 pt-5">
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
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-14 bg-gradient-to-t from-[var(--card-bg)] via-[var(--card-bg)]/70 to-transparent"
              aria-hidden
            />
            <h2
              className={`relative z-[2] line-clamp-4 text-[20px] font-bold leading-snug ${
                onCover ? 'text-white drop-shadow-sm' : 'text-[var(--foreground)]'
              }`}
            >
              {project.title}
            </h2>
          </div>
          <div className="space-y-2 p-4 pt-1">
            {project.description ? (
              <p className="line-clamp-2 text-sm text-[var(--muted)]">{project.description}</p>
            ) : null}
            {updatedLabel ? (
              <p className="text-xs text-[var(--muted)]">최근 수정 {updatedLabel}</p>
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
            className="btn-apple btn-apple-secondary px-2 py-1 text-xs font-semibold disabled:opacity-50"
          >
            수정
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete()
            }}
            disabled={deleting}
            className="btn-apple btn-apple-danger px-2 py-1 text-xs font-semibold disabled:opacity-50"
          >
            {deleting ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>
    </article>
  )
}
