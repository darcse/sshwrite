'use client'

import type { CharacterRow } from '@/components/binder/CharacterPanel'

type CharacterCardProps = {
  row: CharacterRow
  onClick: () => void
}

function normalizeTags(tags: unknown): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.filter((t): t is string => typeof t === 'string')
  return []
}

export function CharacterCard({ row, onClick }: CharacterCardProps) {
  const tags = normalizeTags(row.tags)
  const firstTag = tags.length > 0 ? tags[0] : null
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-8 min-w-0 w-full items-center gap-1 rounded-[6px] py-0 pl-7 pr-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--badge-bg)_50%,transparent)]"
    >
      {row.image_url ? (
        <img
          src={row.image_url}
          alt=""
          className="h-6 w-6 shrink-0 rounded object-cover"
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--foreground)]">{row.name}</span>
      {firstTag ? (
        <span className="hidden min-w-0 max-w-[40%] shrink truncate text-xs text-[var(--muted)] sm:inline">
          {firstTag}
        </span>
      ) : null}
    </button>
  )
}
