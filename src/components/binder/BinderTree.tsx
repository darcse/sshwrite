'use client'

import {
  DndContext,
  DragOverlay,
  type DragCancelEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
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
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { File, Folder } from 'lucide-react'

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

export type DragOverInfo = {
  id: string
  position: 'before' | 'after' | 'into'
} | null

type BinderContextValue = {
  projectId: string
  documents: DocRow[]
  labels: LabelRow[]
  loading: boolean
  selectedDocId: string | null
  activeId: string | null
  dragOverInfo: DragOverInfo
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

function DragPreview({ doc }: { doc: DocRow }) {
  return (
    <div
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        paddingInline: 8,
        borderRadius: 6,
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border)',
        fontSize: 14,
        color: 'var(--foreground)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        cursor: 'grabbing',
        userSelect: 'none',
        minWidth: 120,
        maxWidth: 240,
      }}
    >
      {doc.type === 'folder' ? (
        <Folder
          style={{ width: 16, height: 16, color: '#F5A623', flexShrink: 0 }}
          strokeWidth={2}
        />
      ) : (
        <File
          style={{ width: 16, height: 16, color: 'var(--muted)', flexShrink: 0 }}
          strokeWidth={2}
        />
      )}
      <span
        style={{
          flexShrink: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {doc.title}
      </span>
    </div>
  )
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
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragOverInfo, setDragOverInfo] = useState<DragOverInfo>(null)
  const dragOverInfoRef = useRef<DragOverInfo>(null)

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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const updateDragOverInfo = useCallback(
    (active: { rect: { current: { translated: { top: number; height: number } | null } } }, over: { id: string | number; rect: { top: number; height: number } } | null) => {
      if (!over) {
        if (dragOverInfoRef.current !== null) {
          dragOverInfoRef.current = null
          setDragOverInfo(null)
        }
        return
      }

      const oid = String(over.id)
      const overDoc = byId(documents, oid)
      if (!overDoc) {
        if (dragOverInfoRef.current !== null) {
          dragOverInfoRef.current = null
          setDragOverInfo(null)
        }
        return
      }

      const activeRect = active.rect.current.translated
      if (!activeRect) return

      const activeCenterY = activeRect.top + activeRect.height / 2
      const overRect = over.rect

      let position: 'before' | 'after' | 'into'
      if (overDoc.type === 'folder') {
        if (activeCenterY < overRect.top + overRect.height * 0.3) {
          position = 'before'
        } else if (activeCenterY > overRect.top + overRect.height * 0.7) {
          position = 'after'
        } else {
          position = 'into'
        }
      } else {
        position = activeCenterY < overRect.top + overRect.height / 2 ? 'before' : 'after'
      }

      const prev = dragOverInfoRef.current
      if (prev?.id !== oid || prev?.position !== position) {
        const info: DragOverInfo = { id: oid, position }
        dragOverInfoRef.current = info
        setDragOverInfo(info)
      }
    },
    [documents]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      updateDragOverInfo(event.active, event.over)
    },
    [updateDragOverInfo]
  )

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      updateDragOverInfo(event.active, event.over)
    },
    [updateDragOverInfo]
  )

  const clearDragState = useCallback(() => {
    setActiveId(null)
    dragOverInfoRef.current = null
    setDragOverInfo(null)
  }, [])

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    clearDragState()
  }, [clearDragState])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active } = event
      const aid = String(active.id)

      const info = dragOverInfoRef.current
      clearDragState()

      if (!info) return
      const { id: oid, position } = info
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

      if (position === 'into' && overDoc.type === 'folder') {
        const children = getChildren(documents, oid)
        const nextOrder =
          children.length === 0
            ? 0
            : Math.max(...children.map((c) => c.order_index)) + 1
        await supabase
          .from('write_documents')
          .update({ parent_id: oid, order_index: nextOrder })
          .eq('id', aid)
          .eq('user_id', user.id)
        await refresh()
        return
      }

      const targetParent = overDoc.parent_id
      const siblings = sortByOrder(
        getChildren(documents, targetParent).filter((d) => d.id !== aid)
      )
      const overIndex = siblings.findIndex((d) => d.id === oid)
      const insertIndex =
        position === 'before'
          ? overIndex < 0
            ? 0
            : overIndex
          : overIndex < 0
            ? siblings.length
            : overIndex + 1

      const withActive: DocRow[] = [
        ...siblings.slice(0, insertIndex),
        { ...activeDoc, parent_id: targetParent },
        ...siblings.slice(insertIndex),
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
    [clearDragState, documents, refresh]
  )

  const value: BinderContextValue = {
    projectId,
    documents,
    labels,
    loading,
    selectedDocId,
    activeId,
    dragOverInfo,
    refresh,
    createDocument,
    createFolder,
    deleteDocument,
    updateDocument,
    navigateToDoc,
    getLabel,
  }

  const activeDoc = activeId ? byId(documents, activeId) : null

  return (
    <BinderContext.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          const pw = pointerWithin(args)
          if (pw.length > 0) return pw
          return closestCenter(args)
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeDoc ? <DragPreview doc={activeDoc} /> : null}
        </DragOverlay>
      </DndContext>
    </BinderContext.Provider>
  )
}

export function BinderTree() {
  const { loading, documents } = useBinderContext()
  const hasAny = documents.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto p-2 text-sm">
        {loading ? (
          <p className="text-[var(--muted)]">불러오는 중…</p>
        ) : !hasAny ? (
          <p className="text-[var(--muted)]">
            문서가 없습니다. 바인더 헤더에서 문서나 폴더를 추가해 보세요.
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
  const children = documents
    .filter((d) => d.parent_id === parentId)
    .sort((a, b) => a.order_index - b.order_index)
  const ids = children.map((c) => c.id)
  if (children.length === 0) return null
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <ul className="flex list-none flex-col gap-0 p-0" role="list">
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
