'use client'

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { createClient } from '@/lib/supabase/client'
import { BinderItem } from '@/components/binder/BinderItem'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export type DocRow = {
  id: string
  project_id: string
  user_id: string
  parent_id: string | null
  title: string
  content: unknown
  synopsis: string | null
  label: string | null
  status: string
  order_index: number
  type: 'folder' | 'document'
}

export type LabelRow = {
  id: string
  project_id: string
  name: string
  color: string
}

type BinderContextValue = {
  projectId: string
  documents: DocRow[]
  labels: LabelRow[]
  loading: boolean
  selectedDocId: string | null
  refresh: () => Promise<void>
  createDocument: () => Promise<void>
  createFolder: () => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  updateDocument: (id: string, patch: Partial<DocRow>) => Promise<void>
  navigateToDoc: (id: string | null) => void
  getLabel: (labelId: string | null) => LabelRow | undefined
}

const BinderContext = createContext<BinderContextValue | null>(null)

export function useBinderContext() {
  const c = useContext(BinderContext)
  if (!c) throw new Error('useBinderContext')
  return c
}

const EMPTY_DOC: unknown = { type: 'doc', content: [] }

function sortByOrder(docs: DocRow[]) {
  return [...docs].sort((a, b) => a.order_index - b.order_index)
}

function getChildren(docs: DocRow[], parentId: string | null) {
  return sortByOrder(docs.filter((d) => d.parent_id === parentId))
}

function nextOrderIndexForSiblings(siblings: DocRow[]): number {
  if (siblings.length === 0) return 0
  let max = -1
  for (const s of siblings) {
    const n = Number(s.order_index)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}

function byId(docs: DocRow[], id: string) {
  return docs.find((d) => d.id === id)
}

function isDescendant(docs: DocRow[], ancestorId: string, nodeId: string) {
  let cur = byId(docs, nodeId)
  while (cur) {
    if (cur.id === ancestorId) return true
    if (!cur.parent_id) return false
    cur = byId(docs, cur.parent_id)
  }
  return false
}

export function BinderProvider({
  projectId,
  children,
}: {
  projectId: string
  children: ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedDocId = searchParams.get('doc')

  const [documents, setDocuments] = useState<DocRow[]>([])
  const [labels, setLabels] = useState<LabelRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setDocuments([])
      setLabels([])
      setLoading(false)
      return
    }
    const [docRes, labelRes] = await Promise.all([
      supabase
        .from('write_documents')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('order_index', { ascending: true }),
      supabase
        .from('write_document_labels')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true }),
    ])
    setLoading(false)
    if (docRes.data) setDocuments(docRes.data as DocRow[])
    else setDocuments([])
    if (labelRes.data) setLabels(labelRes.data as LabelRow[])
    else setLabels([])
  }, [projectId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const navigateToDoc = useCallback(
    (id: string | null) => {
      const path = `/projects/${projectId}`
      if (id) router.replace(`${path}?doc=${encodeURIComponent(id)}`)
      else router.replace(path)
    },
    [projectId, router]
  )

  const creationParentId = useMemo(() => {
    if (!selectedDocId) return null
    const sel = byId(documents, selectedDocId)
    if (!sel) return null
    if (sel.type === 'folder') return sel.id
    return sel.parent_id
  }, [documents, selectedDocId])

  const createDocument = useCallback(async () => {
    if (!projectId) return
    const supabase = createClient()
    const authResult = await supabase.auth.getUser()
    const userId = authResult.data.user?.id
    if (!userId) return
    const parentId = creationParentId
    const siblings = getChildren(documents, parentId)
    const orderIndex = nextOrderIndexForSiblings(siblings)
    const insertPayload = {
      user_id: userId,
      project_id: projectId,
      title: '새 문서',
      type: 'document' as const,
      order_index: orderIndex,
      parent_id: parentId,
      content: EMPTY_DOC,
      synopsis: null,
      status: 'todo',
    }
    console.log('[BinderTree] write_documents insert (document)', {
      insert: insertPayload,
      getUser: authResult,
    })
    const { data, error } = await supabase
      .from('write_documents')
      .insert(insertPayload)
      .select('id')
      .single()
    console.log('[BinderTree] insert error', error)
    if (!error && data?.id) {
      await refresh()
      navigateToDoc(data.id)
    }
  }, [creationParentId, documents, navigateToDoc, projectId, refresh])

  const createFolder = useCallback(async () => {
    if (!projectId) return
    const supabase = createClient()
    const authResult = await supabase.auth.getUser()
    const userId = authResult.data.user?.id
    if (!userId) return
    const parentId = creationParentId
    const siblings = getChildren(documents, parentId)
    const orderIndex = nextOrderIndexForSiblings(siblings)
    const insertPayload = {
      user_id: userId,
      project_id: projectId,
      title: '새 폴더',
      type: 'folder' as const,
      order_index: orderIndex,
      parent_id: parentId,
      content: EMPTY_DOC,
      synopsis: null,
      status: 'todo',
    }
    console.log('[BinderTree] write_documents insert (folder)', {
      insert: insertPayload,
      getUser: authResult,
    })
    const { error } = await supabase.from('write_documents').insert(insertPayload)
    console.log('[BinderTree] insert error', error)
    if (!error) await refresh()
  }, [creationParentId, documents, projectId, refresh])

  const deleteDocument = useCallback(
    async (id: string) => {
      if (!window.confirm('이 항목을 삭제할까요? 폴더인 경우 하위 항목도 삭제됩니다.')) return
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const wasOpen = selectedDocId === id
      const { error } = await supabase
        .from('write_documents')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (!error) {
        if (wasOpen) navigateToDoc(null)
        await refresh()
      }
    },
    [navigateToDoc, refresh, selectedDocId]
  )

  const updateDocument = useCallback(
    async (id: string, patch: Partial<DocRow>) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('write_documents')
        .update(patch)
        .eq('id', id)
        .eq('user_id', user.id)
      if (!error) await refresh()
    },
    [refresh]
  )

  const getLabel = useCallback(
    (labelId: string | null) => {
      if (!labelId) return undefined
      return labels.find((l) => l.id === labelId)
    },
    [labels]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return
      const aid = String(active.id)
      const oid = String(over.id)
      if (aid === oid) return

      const activeDoc = byId(documents, aid)
      const overDoc = byId(documents, oid)
      if (!activeDoc || !overDoc) return
      if (isDescendant(documents, aid, oid)) return

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const sameParent = activeDoc.parent_id === overDoc.parent_id

      if (sameParent) {
        const siblings = getChildren(documents, activeDoc.parent_id)
        const oldIndex = siblings.findIndex((d) => d.id === aid)
        const newIndex = siblings.findIndex((d) => d.id === oid)
        if (oldIndex < 0 || newIndex < 0) return
        const reordered = arrayMove(siblings, oldIndex, newIndex)
        for (let i = 0; i < reordered.length; i++) {
          await supabase
            .from('write_documents')
            .update({ order_index: i })
            .eq('id', reordered[i].id)
            .eq('user_id', user.id)
        }
        await refresh()
        return
      }

      if (overDoc.type === 'folder' && !isDescendant(documents, oid, aid)) {
        const childrenInFolder = getChildren(documents, oid)
        const nextOrder =
          childrenInFolder.length === 0
            ? 0
            : Math.max(...childrenInFolder.map((c) => c.order_index)) + 1
        await supabase
          .from('write_documents')
          .update({ parent_id: oid, order_index: nextOrder })
          .eq('id', aid)
          .eq('user_id', user.id)
        await refresh()
        return
      }

      const targetParent = overDoc.parent_id
      const newSiblings = sortByOrder(
        getChildren(documents, targetParent).filter((d) => d.id !== aid)
      )
      const overIndex = newSiblings.findIndex((d) => d.id === oid)
      const insertIndex = overIndex < 0 ? newSiblings.length : overIndex
      const withActive: DocRow[] = [
        ...newSiblings.slice(0, insertIndex),
        { ...activeDoc, parent_id: targetParent },
        ...newSiblings.slice(insertIndex),
      ]
      for (let i = 0; i < withActive.length; i++) {
        await supabase
          .from('write_documents')
          .update({ parent_id: targetParent, order_index: i })
          .eq('id', withActive[i].id)
          .eq('user_id', user.id)
      }
      await refresh()
    },
    [documents, refresh]
  )

  const value: BinderContextValue = {
    projectId,
    documents,
    labels,
    loading,
    selectedDocId,
    refresh,
    createDocument,
    createFolder,
    deleteDocument,
    updateDocument,
    navigateToDoc,
    getLabel,
  }

  return (
    <BinderContext.Provider value={value}>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {children}
      </DndContext>
    </BinderContext.Provider>
  )
}

export function BinderTree() {
  const { loading, documents, createDocument, createFolder } = useBinderContext()
  const [pending, setPending] = useState(false)
  const hasAny = documents.length > 0
  const busy = loading || pending

  async function run(fn: () => Promise<void>) {
    setPending(true)
    try {
      await fn()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="flex shrink-0 flex-wrap gap-2 border-b px-2 py-2"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <button
          type="button"
          onClick={() => run(createDocument)}
          className="btn-primary rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
          disabled={busy}
        >
          {busy ? '처리 중…' : '+ 문서'}
        </button>
        <button
          type="button"
          onClick={() => run(createFolder)}
          className="rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
          style={{
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--surface-color)',
          }}
          disabled={busy}
        >
          {busy ? '처리 중…' : '+ 폴더'}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2 text-sm">
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>불러오는 중…</p>
        ) : !hasAny ? (
          <p style={{ color: 'var(--text-secondary)' }}>
            문서가 없습니다. 상단에서 문서나 폴더를 추가해 보세요.
          </p>
        ) : (
          <SortableBranch parentId={null} depth={0} />
        )}
      </div>
    </div>
  )
}

function SortableBranch({
  parentId,
  depth,
}: {
  parentId: string | null
  depth: number
}) {
  const { documents } = useBinderContext()
  const children = getChildren(documents, parentId)
  const ids = children.map((c) => c.id)
  if (children.length === 0) return null
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <ul className="flex list-none flex-col gap-0.5 p-0" role="list">
        {children.map((doc) => (
          <li key={doc.id} className="min-w-0">
            <BinderItem
              doc={doc}
              depth={depth}
              renderNested={(folderId) => (
                <SortableBranch parentId={folderId} depth={depth + 1} />
              )}
            />
          </li>
        ))}
      </ul>
    </SortableContext>
  )
}
