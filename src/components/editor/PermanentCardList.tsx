'use client'

import type { PermanentCardRow, PermanentCardType, TreeNode } from '@/components/editor/ideaBoardShared'
import { buildTree, sortSegmentKeys, typeLabel } from '@/components/editor/ideaBoardShared'
import { GitBranch, LayoutGrid } from 'lucide-react'
import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'

function PermTreeNodes({
  nodes,
  depth,
  onPick,
}: {
  nodes: Map<string, TreeNode>
  depth: number
  onPick: (c: PermanentCardRow) => void
}) {
  const keys = sortSegmentKeys([...nodes.keys()])
  return (
    <ul className="space-y-1" style={{ paddingLeft: depth ? 12 : 0 }}>
      {keys.map((k) => {
        const n = nodes.get(k)!
        return (
          <li key={n.notePath} className="text-sm">
            {n.card ? (
              <button
                type="button"
                onClick={() => onPick(n.card!)}
                className="w-full rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1.5 text-left text-[var(--foreground)] transition-colors hover:bg-[var(--badge-bg)]"
              >
                <span className="text-xs text-[var(--muted)]">{n.card.note_number}</span>{' '}
                <span className="text-xs text-[var(--muted)]">
                  [{typeLabel(n.card.type)}]
                </span>{' '}
                <span className="font-medium">{n.card.title}</span>
              </button>
            ) : (
              <div className="py-0.5 text-xs text-[var(--muted)]">{n.notePath}</div>
            )}
            {n.children.size > 0 ? (
              <PermTreeNodes nodes={n.children} depth={depth + 1} onPick={onPick} />
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
  rightView,
  setRightView,
  onPickCard,
}: {
  permanent: PermanentCardRow[]
  typeFilter: PermanentCardType | 'all'
  setTypeFilter: Dispatch<SetStateAction<PermanentCardType | 'all'>>
  rightView: 'card' | 'tree'
  setRightView: Dispatch<SetStateAction<'card' | 'tree'>>
  onPickCard: (c: PermanentCardRow) => void
}) {
  const displayPermanent = useMemo(() => {
    const arr =
      typeFilter === 'all' ? [...permanent] : permanent.filter((c) => c.type === typeFilter)
    arr.sort((a, b) =>
      a.note_number.localeCompare(b.note_number, undefined, { numeric: true })
    )
    return arr
  }, [permanent, typeFilter])

  const treeRoot = useMemo(() => buildTree(displayPermanent), [displayPermanent])

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] p-3">
        <div
          className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-0.5"
          role="group"
          aria-label="보기 전환"
        >
          <button
            type="button"
            onClick={() => setRightView('card')}
            title="카드 보기"
            aria-label="카드 보기"
            aria-pressed={rightView === 'card'}
            className={
              rightView === 'card'
                ? 'inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--badge-bg)] text-[var(--foreground)]'
                : 'inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)]'
            }
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setRightView('tree')}
            title="트리 보기"
            aria-label="트리 보기"
            aria-pressed={rightView === 'tree'}
            className={
              rightView === 'tree'
                ? 'inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--badge-bg)] text-[var(--foreground)]'
                : 'inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)]'
            }
          >
            <GitBranch className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
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
        ) : rightView === 'card' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
            {displayPermanent.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPickCard(c)}
                className="min-h-[8.5rem] rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 text-left transition-colors hover:bg-[var(--badge-bg)]"
              >
                <div className="text-sm text-[var(--muted)]">{c.note_number}</div>
                <div className="text-sm text-[var(--muted)]">[{typeLabel(c.type)}]</div>
                <div className="mt-2 line-clamp-4 text-base font-medium leading-snug text-[var(--foreground)]">
                  {c.title}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <PermTreeNodes nodes={treeRoot} depth={0} onPick={onPickCard} />
        )}
      </div>
    </section>
  )
}
