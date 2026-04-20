'use client'

import { StoryBiblePanel } from '@/components/editor/StoryBiblePanel'
import { CommandPalette } from '@/components/editor/CommandPalette'
import { KanbanBoard } from '@/components/editor/KanbanBoard'
import { StatsModal } from '@/components/editor/StatsModal'
import { useBinderContext } from '@/components/binder/BinderTree'
import { ChartColumn, LayoutGrid, Lightbulb, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ProjectHeader({
  projectId,
  onOpenIdeaBoard,
}: {
  projectId: string
  onOpenIdeaBoard?: () => void
}) {
  const { projectTitle, projectType } = useBinderContext()
  const [statsOpen, setStatsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [kanbanOpen, setKanbanOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <>
      <div className="flex h-12 w-full shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--card-bg)] px-4">
        <span className="min-w-0 flex-1 truncate text-lg font-semibold leading-tight text-[var(--foreground)]">
          {projectTitle || '프로젝트'}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="shrink-0 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            aria-label="문서 검색"
            title="문서 검색 (⌘K)"
          >
            <Search className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          {projectType === 'novel' ? (
            <button
              type="button"
              onClick={() => setKanbanOpen(true)}
              className="shrink-0 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              aria-label="플롯 칸반"
              title="플롯 칸반"
            >
              <LayoutGrid className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            className="shrink-0 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            aria-label="집필 통계"
            title="집필 통계"
          >
            <ChartColumn className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <StoryBiblePanel projectId={projectId} />
          {projectType === 'novel' && onOpenIdeaBoard ? (
            <button
              type="button"
              onClick={onOpenIdeaBoard}
              className="shrink-0 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              aria-label="아이디어 보드"
              title="아이디어 보드"
            >
              <Lightbulb className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <StatsModal projectId={projectId} open={statsOpen} onClose={() => setStatsOpen(false)} />
      <CommandPalette projectId={projectId} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {projectType === 'novel' ? (
        <KanbanBoard projectId={projectId} open={kanbanOpen} onClose={() => setKanbanOpen(false)} />
      ) : null}
    </>
  )
}
