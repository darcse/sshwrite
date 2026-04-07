'use client'

import { CharacterCard } from '@/components/binder/CharacterCard'
import { CharacterModal } from '@/components/binder/CharacterModal'
import { createClient } from '@/lib/supabase/client'
import { useBinderContext } from '@/components/binder/BinderTree'
import { ChevronDown, ChevronRight, MapPin, Plus, User } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

export type CharacterRow = {
  id: string
  project_id: string
  user_id: string
  type?: 'character' | 'place'
  kind?: 'character' | 'place'
  name: string
  description: string | null
  memo: string | null
  tags: unknown
  image_url: string | null
  order_index: number
}

export function CharacterPanel() {
  const { projectId, uploadCharacterImage } = useBinderContext()
  const [rows, setRows] = useState<CharacterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openChar, setOpenChar] = useState(false)
  const [openPlace, setOpenPlace] = useState(false)
  const [modal, setModal] = useState<{
    kind: 'character' | 'place'
    row: CharacterRow | null
  } | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('write_characters')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })
    setLoading(false)
    setRows((data as CharacterRow[]) ?? [])
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const getRowType = useCallback(
    (row: CharacterRow) => (row.type ?? row.kind ?? 'character'),
    []
  )

  const characters = useMemo(
    () => rows.filter((r) => getRowType(r) === 'character'),
    [rows, getRowType]
  )
  const places = useMemo(() => rows.filter((r) => getRowType(r) === 'place'), [rows, getRowType])

  return (
    <div className="mb-2 flex flex-col gap-1 border-b border-[var(--border)] pb-2">
      <div>
        <div className="flex h-8 items-center gap-1 px-2">
          <button
            type="button"
            className="flex h-8 w-4 shrink-0 items-center justify-center text-[var(--muted)]"
            onClick={() => setOpenChar((v) => !v)}
            aria-expanded={openChar}
          >
            {openChar ? (
              <ChevronDown className="h-2 w-2" strokeWidth={2} aria-hidden />
            ) : (
              <ChevronRight className="h-2 w-2" strokeWidth={2} aria-hidden />
            )}
          </button>
          <User className="h-4 w-4 shrink-0 text-[var(--muted)]" strokeWidth={2} aria-hidden />
          <span className="min-w-0 flex-1 text-sm font-medium text-[var(--foreground)]">
            Characters
          </span>
          <button
            type="button"
            className="rounded p-0.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            aria-label="등장인물 추가"
            onClick={() => setModal({ kind: 'character', row: null })}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        {openChar ? (
          <div className="mt-0.5 flex flex-col gap-0">
            {loading ? (
              <p className="px-2 text-xs text-[var(--muted)]">불러오는 중…</p>
            ) : characters.length === 0 ? (
              <p className="px-2 text-xs text-[var(--muted)]">등장인물이 없습니다.</p>
            ) : (
              characters.map((row) => (
                <CharacterCard
                  key={row.id}
                  row={row}
                  onClick={() => setModal({ kind: 'character', row })}
                />
              ))
            )}
          </div>
        ) : null}
      </div>

      <div>
        <div className="flex h-8 items-center gap-1 px-2">
          <button
            type="button"
            className="flex h-8 w-4 shrink-0 items-center justify-center text-[var(--muted)]"
            onClick={() => setOpenPlace((v) => !v)}
            aria-expanded={openPlace}
          >
            {openPlace ? (
              <ChevronDown className="h-2 w-2" strokeWidth={2} aria-hidden />
            ) : (
              <ChevronRight className="h-2 w-2" strokeWidth={2} aria-hidden />
            )}
          </button>
          <MapPin className="h-4 w-4 shrink-0 text-[var(--muted)]" strokeWidth={2} aria-hidden />
          <span className="min-w-0 flex-1 text-sm font-medium text-[var(--foreground)]">
            Places
          </span>
          <button
            type="button"
            className="rounded p-0.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            aria-label="장소 추가"
            onClick={() => setModal({ kind: 'place', row: null })}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        {openPlace ? (
          <div className="mt-0.5 flex flex-col gap-0">
            {loading ? (
              <p className="px-2 text-xs text-[var(--muted)]">불러오는 중…</p>
            ) : places.length === 0 ? (
              <p className="px-2 text-xs text-[var(--muted)]">장소가 없습니다.</p>
            ) : (
              places.map((row) => (
                <CharacterCard
                  key={row.id}
                  row={row}
                  onClick={() => setModal({ kind: 'place', row })}
                />
              ))
            )}
          </div>
        ) : null}
      </div>

      {modal ? (
        <CharacterModal
          projectId={projectId}
          uploadCharacterImage={uploadCharacterImage}
          kind={modal.kind}
          initialRow={modal.row}
          onClose={() => setModal(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  )
}
