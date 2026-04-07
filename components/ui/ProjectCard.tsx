'use client'

import Link from 'next/link'
import type { ProjectModalProject } from '@/components/ui/ProjectModal'

type ProjectCardProps = {
  project: ProjectModalProject
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
}

export function ProjectCard({ project, deleting, onEdit, onDelete }: ProjectCardProps) {
  return (
    <article
      className="card flex flex-col gap-3"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <div className="min-w-0 flex-1">
        <Link
          href={`/projects/${project.id}`}
          className="block font-medium hover:underline"
          style={{ color: 'var(--accent-color)' }}
        >
          {project.title}
        </Link>
        {project.description ? (
          <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {project.description}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEdit}
          disabled={deleting}
          className="rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          style={{
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--surface-color)',
          }}
        >
          수정
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          style={{
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border-color)',
            color: '#b91c1c',
            backgroundColor: 'var(--surface-color)',
          }}
        >
          {deleting ? '삭제 중…' : '삭제'}
        </button>
      </div>
    </article>
  )
}
