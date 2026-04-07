'use client'

import type { DocRow, LabelRow } from '@/components/binder/BinderTree'
import { CorkboardCard } from '@/components/corkboard/CorkboardCard'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useMemo, useState } from 'react'

type CorkboardProps = {
  folderId: string
  documents: DocRow[]
  labels: LabelRow[]
  onOpenDocument: (id: string) => void
  onSaveSynopsis: (id: string, synopsis: string) => Promise<void> | void
}

export function Corkboard({
  folderId,
  documents,
  labels,
  onOpenDocument,
  onSaveSynopsis,
}: CorkboardProps) {
  const [loadedLabels, setLoadedLabels] = useState<LabelRow[]>(labels)
  const projectId = useMemo(
    () => documents.find((doc) => doc.id === folderId)?.project_id ?? null,
    [documents, folderId]
  )

  useEffect(() => {
    setLoadedLabels(labels)
  }, [labels])

  useEffect(() => {
    if (!projectId) return
    let alive = true
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('write_document_labels')
        .select('id, project_id, name, color')
        .eq('project_id', projectId)
        .order('name', { ascending: true })
      if (alive && data) setLoadedLabels(data as LabelRow[])
    })()
    return () => {
      alive = false
    }
  }, [projectId, documents])

  const labelMap = new Map(loadedLabels.map((label) => [label.id, label.color]))
  const children = documents
    .filter((doc) => doc.parent_id === folderId && doc.type === 'document')
    .sort((a, b) => a.order_index - b.order_index)

  if (children.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[var(--border)] p-8 text-sm text-[var(--muted)]">
        하위 문서가 없습니다. 문서를 추가해 주세요.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {children.map((doc) => {
        const labelId = ((doc as unknown as { label_id?: string | null }).label_id ?? doc.label) ?? null
        return (
        <CorkboardCard
          key={doc.id}
          id={doc.id}
          title={doc.title}
          synopsis={doc.synopsis}
          status={doc.status}
          labelColor={labelId ? labelMap.get(labelId) : undefined}
          onOpen={onOpenDocument}
          onSaveSynopsis={onSaveSynopsis}
        />
        )
      })}
    </div>
  )
}
