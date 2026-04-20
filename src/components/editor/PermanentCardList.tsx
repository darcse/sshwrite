'use client'

import type { PermanentCardRow, PermanentCardType, TreeNode } from '@/components/editor/ideaBoardShared'
import { buildZettelkastenTree, sortSegmentKeys, typeLabel } from '@/components/editor/ideaBoardShared'
import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'

function PermTreeNodes({
  nodes,
  depth,
  onPick,
  selectedId,
}: {
  nodes: Map<string, TreeNode>
  depth: number
  onPick: (c: PermanentCardRow) => void
  selectedId: string | null
}) {
  const keys = sortSegmentKeys([...nodes.keys()])
  return (
    <ul
      className={
        depth === 0
          ? 'space-y-1.5'
          : 'ms-4 space-y-1.5 border-l-2 border-[var(--border)] pl-4'
      }
    >
      {keys.map((k) => {
        const n = nodes.get(k)!
        const rowPad = depth === 0 ? 'px-2' : 'pe-2'
        return (
          <li key={n.notePath} className="text-sm">
            {n.card ? (
              <button
                type="button"
                onClick={() => onPick(n.card!)}
                className={
                  selectedId === n.card!.id
                    ? `w-full rounded px-1 py-1 text-left text-[var(--foreground)] transition-colors ${rowPad}`
                    : `w-full rounded px-1 py-1 text-left text-[var(--foreground)] transition-colors hover:bg-[var(--badge-bg)] ${rowPad}`
                }
              >
                <span className="me-1 inline-flex rounded bg-[var(--badge-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                  {n.card.note_number}
                </span>{' '}
                <span className="text-xs text-[var(--muted)]">
                  [{typeLabel(n.card.type)}]
                </span>{' '}
                <span className="font-medium">{n.card.title}</span>
              </button>
            ) : (
              <div className="py-0.5 text-xs text-[var(--muted)]">{n.notePath}</div>
            )}
            {n.children.size > 0 ? (
              <PermTreeNodes
                nodes={n.children}
                depth={depth + 1}
                onPick={onPick}
                selectedId={selectedId}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function PermanentCardList({
  permanent,
  typeFilter,
  setTypeFilter,
  selectedCard,
  onSelectCard,
}: {
  permanent: PermanentCardRow[]
  typeFilter: PermanentCardType | 'all'
  setTypeFilter: Dispatch<SetStateAction<PermanentCardType | 'all'>>
  selectedCard: PermanentCardRow | null
  onSelectCard: (c: PermanentCardRow) => void
}) {
  const displayPermanent = useMemo(() => {
    const arr =
      typeFilter === 'all' ? [...permanent] : permanent.filter((c) => c.type === typeFilter)
    arr.sort((a, b) =>
      a.note_number.localeCompare(b.note_number, undefined, { numeric: true })
    )
    return arr
  }, [permanent, typeFilter])

  const treeRoot = useMemo(() => buildZettelkastenTree(displayPermanent), [displayPermanent])

  return (
    <section className="flex h-full min-h-0 w-full min-w-0 flex-col border-r border-[var(--border)]">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] p-3">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['all', '전체'] as const,
              ['event', '사건'] as const,
              ['character', '캐릭터'] as const,
              ['worldview', '세계관'] as const,
              ['place', '장소'] as const,
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setTypeFilter(val)}
              className={
                typeFilter === val
                  ? 'rounded-full bg-[var(--badge-bg)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]'
                  : 'rounded-full border border-transparent px-2.5 py-1 text-xs text-[var(--muted)] hover:border-[var(--border)]'
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {displayPermanent.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">생성된 카드가 없습니다</p>
        ) : (
          <PermTreeNodes
            nodes={treeRoot}
            depth={0}
            onPick={onSelectCard}
            selectedId={selectedCard?.id ?? null}
          />
        )}
      </div>
    </section>
  )
}
