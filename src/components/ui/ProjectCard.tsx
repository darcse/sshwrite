'use client'

import Link from 'next/link'
import type { ProjectModalProject } from '@/components/ui/ProjectModal'
import { Pencil, Trash2 } from 'lucide-react'

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
  const coverImage = (project as ProjectModalProject & { place_image_url?: string | null }).place_image_url
  const updatedLabel = formatUpdatedAt(project.updated_at)
  const onCover = Boolean(coverColor || coverImage)

  return (
    <article className="group card-apple relative overflow-hidden">
      <div className="relative">
        <Link href={`/projects/${project.id}`} className="block">
          <div className="relative min-h-[132px] overflow-hidden px-4 pb-12 pt-5">
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
