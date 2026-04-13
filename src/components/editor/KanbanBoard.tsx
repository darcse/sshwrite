'use client'

import { createClient } from '@/lib/supabase/client'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'

const columnCollision: CollisionDetection = (args) => {
  const activeId = String(args.active.id)
  if (activeId.startsWith('col:')) {
    return closestCorners({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) =>
        String(c.id).startsWith('col:')
      ),
    })
  }
  return closestCorners(args)
}

const LABEL_COLORS = [
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#007aff',
  '#5856d6',
  '#ff2d55',
] as const

const DEFAULT_COLOR_DOT = '#d1d5db'

function dotFill(hex: string | null | undefined) {
  return hex && /^#[0-9A-Fa-f]{6}$/i.test(hex) ? hex : DEFAULT_COLOR_DOT
}

type KCard = {
  id: string
  column_id: string
  user_id: string
  title: string
  body: string | null
  order_index: number
  color: string | null
}

type KColumn = {
  id: string
  project_id: string
  user_id: string
  title: string
  order_index: number
  color: string | null
  cards: KCard[]
}

type ColorMenuState = {
  kind: 'column' | 'card'
  id: string
  top: number
  left: number
}

type KanbanBoardProps = {
  projectId: string
  open: boolean
  onClose: () => void
}

type ActiveOverlay =
  | { kind: 'column'; column: KColumn }
  | { kind: 'card'; card: KCard }
  | null

async function persistColumnOrder(cols: KColumn[]) {
  const supabase = createClient()
  await Promise.all(
    cols.map((c, i) =>
      supabase.from('write_kanban_columns').update({ order_index: i }).eq('id', c.id).then()
    )
  )
}

async function persistAllCards(cols: KColumn[]) {
  const supabase = createClient()
  await Promise.all(
    cols.flatMap((col) =>
      col.cards.map((card, i) =>
        supabase
          .from('write_kanban_cards')
          .update({ column_id: col.id, order_index: i })
          .eq('id', card.id)
          .then()
      )
    )
  )
}

function CardOverlay({ card }: { card: KCard }) {
  return (
    <div
      className="w-64 max-w-[min(16rem,calc(100vw-2rem))] rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3 shadow-lg"
      style={{ color: 'var(--foreground)' }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full border border-[var(--border)]"
          style={{ backgroundColor: dotFill(card.color) }}
          aria-hidden
        />
        <div className="min-w-0 text-sm font-semibold">{card.title || '제목 없음'}</div>
      </div>
      {card.body ? (
        <div className="mt-1 line-clamp-4 text-xs text-[var(--muted)]">{card.body}</div>
      ) : null}
    </div>
  )
}

function ColumnOverlay({ column }: { column: KColumn }) {
  return (
    <div
      className="flex w-72 shrink-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--card-bg)] shadow-lg"
      style={{
        color: 'var(--foreground)',
        ...(column.color
          ? { borderTopWidth: 3, borderTopColor: column.color, borderTopStyle: 'solid' }
          : {}),
      }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-2 py-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full border border-[var(--border)]"
          style={{ backgroundColor: dotFill(column.color) }}
          aria-hidden
        />
        <GripVertical className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{column.title}</span>
      </div>
      <div className="p-2 text-xs text-[var(--muted)]">{column.cards.length}개 카드</div>
    </div>
  )
}

function SortableCard({
  card,
  onOpenEdit,
  onDelete,
  onOpenColorMenu,
}: {
  card: KCard
  onOpenEdit: (c: KCard) => void
  onDelete: (c: KCard) => void
  onOpenColorMenu: (e: MouseEvent, cardId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card:${card.id}`,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-[var(--border)] bg-[var(--background)]"
    >
      <div className="flex gap-1 p-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] active:cursor-grabbing"
          aria-label="카드 이동"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          <button
            type="button"
            data-kanban-color-trigger
            className="mt-1 h-2 w-2 shrink-0 rounded-full border border-[var(--border)]"
            style={{ backgroundColor: dotFill(card.color) }}
            aria-label="카드 색상"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onOpenColorMenu(e, card.id)
            }}
          />
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onOpenEdit(card)}
          >
            <div className="text-sm font-medium text-[var(--foreground)]">{card.title || '제목 없음'}</div>
            {card.body ? (
              <div className="mt-1 line-clamp-4 text-xs text-[var(--muted)]">{card.body}</div>
            ) : null}
          </button>
        </div>
        <button
          type="button"
          className="shrink-0 rounded p-1 text-[var(--muted)] hover:text-red-600"
          aria-label="카드 삭제"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(card)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function SortableColumnWrap({
  column,
  onTitleChange,
  onColumnTitleBlur,
  onAddCard,
  onDeleteColumn,
  onOpenEdit,
  onDeleteCard,
  onOpenColumnColorMenu,
  onOpenCardColorMenu,
}: {
  column: KColumn
  onTitleChange: (columnId: string, title: string) => void
  onColumnTitleBlur: (columnId: string, title: string) => void
  onAddCard: (columnId: string) => void
  onDeleteColumn: (columnId: string) => void
  onOpenEdit: (c: KCard) => void
  onDeleteCard: (c: KCard) => void
  onOpenColumnColorMenu: (e: MouseEvent, columnId: string) => void
  onOpenCardColorMenu: (e: MouseEvent, cardId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `col:${column.id}` })
  const { setNodeRef: setDropRef } = useDroppable({
    id: `drop:${column.id}`,
    data: { columnId: column.id },
  })
  const setColRef = useCallback(
    (node: HTMLDivElement | null) => {
      setSortableRef(node)
    },
    [setSortableRef]
  )
  const cardIds = column.cards.map((c) => `card:${c.id}`)
  const colStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    ...(column.color
      ? { borderTopWidth: 3, borderTopColor: column.color, borderTopStyle: 'solid' as const }
      : {}),
  }
  return (
    <div
      ref={setColRef}
      style={colStyle}
      className="flex w-72 shrink-0 flex-col self-start rounded-xl border border-[var(--border)] bg-[var(--card-bg)]"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] px-2 py-2">
        <button
          type="button"
          data-kanban-color-trigger
          className="mt-0.5 h-2 w-2 shrink-0 rounded-full border border-[var(--border)]"
          style={{ backgroundColor: dotFill(column.color) }}
          aria-label="컬럼 색상"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => onOpenColumnColorMenu(e, column.id)}
        />
        <button
          type="button"
          className="shrink-0 cursor-grab touch-none rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)] active:cursor-grabbing"
          aria-label="컬럼 이동"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <input
          type="text"
          value={column.title}
          onChange={(e) => onTitleChange(column.id, e.target.value)}
          onBlur={(e) => onColumnTitleBlur(column.id, e.target.value)}
          className="input-apple min-w-0 flex-1 rounded-md px-2 py-1.5 text-sm"
          aria-label="컬럼 제목"
        />
        <button
          type="button"
          className="shrink-0 rounded p-1 text-[var(--muted)] hover:text-red-600"
          aria-label="컬럼 삭제"
          onClick={() => onDeleteColumn(column.id)}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <SortableContext id={column.id} items={cardIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setDropRef}
          className="flex min-h-[100px] flex-col gap-2 p-2"
        >
          {column.cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              onOpenEdit={onOpenEdit}
              onDelete={onDeleteCard}
              onOpenColorMenu={onOpenCardColorMenu}
            />
          ))}
        </div>
      </SortableContext>
      <div className="shrink-0 border-t border-[var(--border)] p-2">
        <button
          type="button"
          onClick={() => onAddCard(column.id)}
          className="btn-apple btn-apple-secondary flex w-full items-center justify-center gap-1.5 py-2 text-xs font-medium"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          카드 추가
        </button>
      </div>
    </div>
  )
}

function KanbanColorPalette({
  menu,
  currentColor,
  onPick,
  onDismiss,
}: {
  menu: ColorMenuState
  currentColor: string | null
  onPick: (hex: string | null) => void
  onDismiss: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDown(ev: globalThis.MouseEvent) {
      const el = ev.target as Node
      if (panelRef.current?.contains(el)) return
      const html = ev.target as HTMLElement
      if (html.closest?.('[data-kanban-color-trigger]')) return
      onDismiss()
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [onDismiss])
  return (
    <div
      ref={panelRef}
      data-kanban-popover
      className="fixed z-[550] flex max-w-[220px] flex-wrap gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-2 shadow-lg"
      style={{ top: menu.top, left: menu.left }}
      role="listbox"
    >
      <button
        type="button"
        title="기본"
        aria-label="색 없음"
        onClick={() => onPick(null)}
        className="h-7 w-7 shrink-0 rounded-full border-2"
        style={{
          backgroundColor: DEFAULT_COLOR_DOT,
          borderColor:
            currentColor == null
              ? 'var(--foreground)'
              : 'color-mix(in srgb, var(--foreground) 25%, transparent)',
        }}
      />
      {LABEL_COLORS.map((hex) => (
        <button
          key={hex}
          type="button"
          aria-label={`색상 ${hex}`}
          onClick={() => onPick(hex)}
          className="h-7 w-7 shrink-0 rounded-full border-2"
          style={{
            backgroundColor: hex,
            borderColor:
              currentColor === hex
                ? 'var(--foreground)'
                : 'color-mix(in srgb, var(--foreground) 20%, transparent)',
          }}
        />
      ))}
    </div>
  )
}

export function KanbanBoard({ projectId, open, onClose }: KanbanBoardProps) {
  const [columns, setColumns] = useState<KColumn[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [colorMenu, setColorMenu] = useState<ColorMenuState | null>(null)
  const [overlay, setOverlay] = useState<ActiveOverlay>(null)
  const [editing, setEditing] = useState<KCard | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const pendingNewCardIdRef = useRef<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const load = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setColumns([])
        setLoading(false)
        return
      }
      const { data: colRows, error: colErr } = await supabase
        .from('write_kanban_columns')
        .select('id, project_id, user_id, title, order_index, color')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true })
      if (colErr) throw colErr
      const cols = (colRows ?? []).map((raw) => ({
        ...(raw as Omit<KColumn, 'cards'>),
        color: (raw as { color?: string | null }).color ?? null,
      })) as Omit<KColumn, 'cards'>[]
      if (cols.length === 0) {
        setColumns([])
        setLoading(false)
        return
      }
      const colIds = cols.map((c) => c.id)
      const { data: cardRows, error: cardErr } = await supabase
        .from('write_kanban_cards')
        .select('id, column_id, user_id, title, body, order_index, color')
        .in('column_id', colIds)
        .order('order_index', { ascending: true })
      if (cardErr) throw cardErr
      const cards = (cardRows ?? []).map((raw) => ({
        ...(raw as KCard),
        color: (raw as { color?: string | null }).color ?? null,
      })) as KCard[]
      const merged: KColumn[] = cols.map((c) => ({
        ...c,
        cards: cards.filter((k) => k.column_id === c.id).sort((a, b) => a.order_index - b.order_index),
      }))
      setColumns(merged)
    } catch (e) {
      console.error(e)
      setLoadError('칸반을 불러오지 못했습니다. DB 마이그레이션을 적용했는지 확인하세요.')
      setColumns([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  useEffect(() => {
    if (!open) setColorMenu(null)
  }, [open])

  const dismissEditModal = useCallback(async () => {
    const card = editing
    const shouldDelete = Boolean(card && pendingNewCardIdRef.current === card.id)
    if (shouldDelete) pendingNewCardIdRef.current = null
    setColorMenu(null)
    setEditing(null)
    setEditTitle('')
    setEditBody('')
    if (shouldDelete && card) {
      const supabase = createClient()
      await supabase.from('write_kanban_cards').delete().eq('id', card.id)
      setColumns((prev) =>
        prev.map((c) => ({
          ...c,
          cards: c.cards.filter((k) => k.id !== card.id),
        }))
      )
    }
  }, [editing])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (colorMenu) {
        setColorMenu(null)
        return
      }
      if (editing) {
        void dismissEditModal()
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose, editing, dismissEditModal, colorMenu])

  const handleTitleBlur = useCallback(async (columnId: string, title: string) => {
    const supabase = createClient()
    await supabase.from('write_kanban_columns').update({ title }).eq('id', columnId)
  }, [])

  const onTitleChange = useCallback((columnId: string, title: string) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, title } : c))
    )
  }, [])

  const addColumn = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const nextOrder = columns.length === 0 ? 0 : Math.max(...columns.map((c) => c.order_index)) + 1
    const { data, error } = await supabase
      .from('write_kanban_columns')
      .insert({
        project_id: projectId,
        user_id: user.id,
        title: '새 챕터',
        order_index: nextOrder,
        color: null,
      })
      .select('id, project_id, user_id, title, order_index, color')
      .single()
    if (error || !data) return
    const row = {
      ...(data as Omit<KColumn, 'cards'>),
      color: (data as { color?: string | null }).color ?? null,
    }
    setColumns((prev) => [...prev, { ...row, cards: [] }])
  }, [columns, projectId])

  const addCard = useCallback(
    async (columnId: string) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const col = columns.find((c) => c.id === columnId)
      const nextOrder =
        !col || col.cards.length === 0 ? 0 : Math.max(...col.cards.map((k) => k.order_index)) + 1
      const { data, error } = await supabase
        .from('write_kanban_cards')
        .insert({
          column_id: columnId,
          user_id: user.id,
          title: '새 사건',
          body: null,
          order_index: nextOrder,
          color: null,
        })
        .select('id, column_id, user_id, title, body, order_index, color')
        .single()
      if (error || !data) return
      const card = {
        ...(data as KCard),
        color: (data as { color?: string | null }).color ?? null,
      }
      setColumns((prev) =>
        prev.map((c) => (c.id === columnId ? { ...c, cards: [...c.cards, card] } : c))
      )
      setEditing(card)
      setEditTitle(card.title)
      setEditBody(card.body ?? '')
      pendingNewCardIdRef.current = card.id
    },
    [columns]
  )

  const deleteColumn = useCallback(
    async (columnId: string) => {
      if (!window.confirm('이 컬럼과 포함된 카드를 모두 삭제할까요?')) return
      const supabase = createClient()
      await supabase.from('write_kanban_columns').delete().eq('id', columnId)
      setColumns((prev) => prev.filter((c) => c.id !== columnId))
    },
    []
  )

  const deleteCard = useCallback(async (card: KCard) => {
    if (!window.confirm('이 카드를 삭제할까요?')) return
    const supabase = createClient()
    await supabase.from('write_kanban_cards').delete().eq('id', card.id)
    setColumns((prev) =>
      prev.map((c) =>
        c.id === card.column_id
          ? { ...c, cards: c.cards.filter((k) => k.id !== card.id) }
          : c
      )
    )
  }, [])

  const openEdit = useCallback((card: KCard) => {
    pendingNewCardIdRef.current = null
    setColorMenu(null)
    setEditing(card)
    setEditTitle(card.title)
    setEditBody(card.body ?? '')
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editing) return
    setSavingEdit(true)
    try {
      const supabase = createClient()
      await supabase
        .from('write_kanban_cards')
        .update({ title: editTitle, body: editBody || null })
        .eq('id', editing.id)
      setColumns((prev) =>
        prev.map((c) => ({
          ...c,
          cards: c.cards.map((k) =>
            k.id === editing.id ? { ...k, title: editTitle, body: editBody || null } : k
          ),
        }))
      )
      pendingNewCardIdRef.current = null
      setEditing(null)
    } finally {
      setSavingEdit(false)
    }
  }, [editing, editTitle, editBody])

  const openColumnColorMenu = useCallback((e: MouseEvent, columnId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setColorMenu({ kind: 'column', id: columnId, top: r.bottom + 6, left: r.left })
  }, [])

  const openCardColorMenu = useCallback((e: MouseEvent, cardId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setColorMenu({ kind: 'card', id: cardId, top: r.bottom + 6, left: r.left })
  }, [])

  const colorMenuCurrent =
    colorMenu == null
      ? null
      : colorMenu.kind === 'column'
        ? columns.find((c) => c.id === colorMenu.id)?.color ?? null
        : columns.flatMap((c) => c.cards).find((k) => k.id === colorMenu.id)?.color ?? null

  const pickColor = useCallback(
    async (hex: string | null) => {
      if (!colorMenu) return
      const target = colorMenu
      const supabase = createClient()
      if (target.kind === 'column') {
        await supabase.from('write_kanban_columns').update({ color: hex }).eq('id', target.id)
        setColumns((prev) =>
          prev.map((c) => (c.id === target.id ? { ...c, color: hex } : c))
        )
      } else {
        await supabase.from('write_kanban_cards').update({ color: hex }).eq('id', target.id)
        setColumns((prev) =>
          prev.map((c) => ({
            ...c,
            cards: c.cards.map((k) =>
              k.id === target.id ? { ...k, color: hex } : k
            ),
          }))
        )
      }
      setColorMenu(null)
    },
    [colorMenu]
  )

  const handleDragStart = useCallback(
    (e: DragStartEvent) => {
      const id = String(e.active.id)
      if (id.startsWith('col:')) {
        const colId = id.slice(4)
        const col = columns.find((c) => c.id === colId)
        if (col) setOverlay({ kind: 'column', column: col })
        return
      }
      if (id.startsWith('card:')) {
        const cardId = id.slice(5)
        for (const col of columns) {
          const card = col.cards.find((k) => k.id === cardId)
          if (card) {
            setOverlay({ kind: 'card', card })
            return
          }
        }
      }
    },
    [columns]
  )

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const { active, over } = e
      setOverlay(null)
      if (!over) return

      const aid = String(active.id)
      const oid = String(over.id)

      if (aid.startsWith('col:')) {
        if (aid === oid) return
        const from = columns.findIndex((c) => `col:${c.id}` === aid)
        const to = columns.findIndex((c) => `col:${c.id}` === oid)
        if (from < 0 || to < 0) return
        const reordered = arrayMove(columns, from, to).map((c, i) => ({
          ...c,
          order_index: i,
        }))
        setColumns(reordered)
        await persistColumnOrder(reordered)
        return
      }

      if (!aid.startsWith('card:')) return
      const cardId = aid.slice(5)
      const activeContainer = active.data.current?.sortable?.containerId as string | undefined
      if (!activeContainer) return

      let overContainer: string | undefined
      let insertIndex = 0

      if (oid.startsWith('card:')) {
        const overCardId = oid.slice(5)
        for (const col of columns) {
          const idx = col.cards.findIndex((k) => k.id === overCardId)
          if (idx >= 0) {
            overContainer = col.id
            insertIndex = idx
            break
          }
        }
      } else if (oid.startsWith('drop:')) {
        overContainer = oid.slice(5)
        const c = columns.find((x) => x.id === overContainer)
        insertIndex = c ? c.cards.length : 0
      } else if (oid.startsWith('col:')) {
        overContainer = oid.slice(4)
        const c = columns.find((x) => x.id === overContainer)
        insertIndex = c ? c.cards.length : 0
      }

      if (!overContainer) return

      if (activeContainer === overContainer) {
        const col = columns.find((c) => c.id === activeContainer)
        if (!col) return
        const fromIdx = col.cards.findIndex((k) => k.id === cardId)
        if (fromIdx < 0) return
        if (oid.startsWith('drop:')) {
          const newCards = [...col.cards]
          const [m] = newCards.splice(fromIdx, 1)
          newCards.push(m)
          const indexed = newCards.map((k, i) => ({ ...k, order_index: i }))
          const updatedBoard = columns.map((c) =>
            c.id === activeContainer ? { ...c, cards: indexed } : c
          )
          setColumns(updatedBoard)
          await persistAllCards(updatedBoard)
          return
        }
        if (oid.startsWith('card:')) {
          const toIdx = col.cards.findIndex((k) => k.id === oid.slice(5))
          if (toIdx >= 0 && fromIdx !== toIdx) {
            const newCards = arrayMove(col.cards, fromIdx, toIdx).map((k, i) => ({
              ...k,
              order_index: i,
            }))
            const updatedBoard = columns.map((c) =>
              c.id === activeContainer ? { ...c, cards: newCards } : c
            )
            setColumns(updatedBoard)
            await persistAllCards(updatedBoard)
          }
        }
        return
      }

      const next = columns.map((c) => ({ ...c, cards: [...c.cards] }))
      const fromCol = next.find((c) => c.id === activeContainer)
      const toCol = next.find((c) => c.id === overContainer)
      if (!fromCol || !toCol) return
      const fi = fromCol.cards.findIndex((k) => k.id === cardId)
      if (fi < 0) return
      const [moved] = fromCol.cards.splice(fi, 1)
      if (!moved) return
      const updated = { ...moved, column_id: overContainer }
      if (oid.startsWith('drop:') || oid.startsWith('col:')) {
        toCol.cards.push(updated)
      } else {
        const j = toCol.cards.findIndex((k) => k.id === oid.slice(5))
        const at = j < 0 ? toCol.cards.length : j
        toCol.cards.splice(at, 0, updated)
      }
      next.forEach((c) => {
        c.cards = c.cards.map((k, i) => ({ ...k, order_index: i, column_id: c.id }))
      })
      setColumns(next)
      await persistAllCards(next)
    },
    [columns]
  )

  if (!open) return null

  const columnSortIds = columns.map((c) => `col:${c.id}`)

  return (
    <div
      className="modal-overlay-apple fixed inset-0 z-[530] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kanban-title"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <div
        className="flex h-full min-h-0 w-full flex-col bg-[var(--background)] shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <h2 id="kanban-title" className="text-lg font-semibold text-[var(--foreground)]">
            플롯 칸반
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[var(--muted)]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            불러오는 중…
          </div>
        ) : loadError ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[var(--muted)]">
            {loadError}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {columns.length === 0 ? (
              <p className="shrink-0 px-4 py-3 text-center text-sm text-[var(--muted)]">
                컬럼을 추가해 플롯을 구성해보세요
              </p>
            ) : null}
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto p-4">
              <DndContext
                sensors={sensors}
                collisionDetection={columnCollision}
                onDragStart={handleDragStart}
                onDragEnd={(e) => void handleDragEnd(e)}
              >
                <div className="flex items-start gap-3">
                  <SortableContext items={columnSortIds} strategy={horizontalListSortingStrategy}>
                    {columns.map((column) => (
                      <SortableColumnWrap
                        key={column.id}
                        column={column}
                        onTitleChange={onTitleChange}
                        onColumnTitleBlur={handleTitleBlur}
                        onAddCard={addCard}
                        onDeleteColumn={deleteColumn}
                        onOpenEdit={openEdit}
                        onDeleteCard={deleteCard}
                        onOpenColumnColorMenu={openColumnColorMenu}
                        onOpenCardColorMenu={openCardColorMenu}
                      />
                    ))}
                  </SortableContext>
                  <div className="flex shrink-0 self-start pt-1">
                    <button
                      type="button"
                      onClick={() => void addColumn()}
                      className="btn-apple btn-apple-secondary flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      컬럼 추가
                    </button>
                  </div>
                </div>
                <DragOverlay dropAnimation={null}>
                  {overlay?.kind === 'card' ? <CardOverlay card={overlay.card} /> : null}
                  {overlay?.kind === 'column' ? <ColumnOverlay column={overlay.column} /> : null}
                </DragOverlay>
              </DndContext>
            </div>
          </div>
        )}

        {!loading && !loadError ? (
          <div className="shrink-0 border-t border-[var(--border)] px-4 py-2 text-center text-xs text-[var(--muted)]">
            ESC로 닫기 · 컬럼과 카드를 드래그해 순서를 바꿀 수 있습니다
          </div>
        ) : null}
      </div>

      {colorMenu && !loading && !loadError ? (
        <KanbanColorPalette
          menu={colorMenu}
          currentColor={colorMenuCurrent}
          onPick={(hex) => void pickColor(hex)}
          onDismiss={() => setColorMenu(null)}
        />
      ) : null}

      {editing ? (
        <div
          className="fixed inset-0 z-[540] flex items-center justify-center p-4 modal-overlay-apple"
          role="presentation"
          onClick={() => void dismissEditModal()}
        >
          <div
            className="modal-panel-apple w-full max-w-md p-4 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="mb-3 text-sm font-semibold text-[var(--foreground)]">카드 편집</div>
            <label className="mb-2 block text-xs text-[var(--muted)]">제목</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="input-apple mb-3 w-full rounded-md px-3 py-2 text-sm"
            />
            <label className="mb-2 block text-xs text-[var(--muted)]">내용</label>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={5}
              className="input-apple mb-4 w-full resize-y rounded-md px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-apple btn-apple-secondary px-3 py-1.5 text-xs"
                onClick={() => void dismissEditModal()}
              >
                취소
              </button>
              <button
                type="button"
                disabled={savingEdit}
                className="btn-apple px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                onClick={() => void saveEdit()}
              >
                {savingEdit ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
