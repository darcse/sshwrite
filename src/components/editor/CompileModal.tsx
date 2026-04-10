'use client'

import { useBinderContext } from '@/components/binder/BinderTree'
import type { DocRow } from '@/components/binder/BinderTree'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Editor } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { createClient } from '@/lib/supabase/client'
import {
  File as DocxFile,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import { FileOutput, GripVertical, X } from 'lucide-react'
import { Markdown } from 'tiptap-markdown'
import { useCallback, useEffect, useMemo, useState } from 'react'

function sortByOrder(docs: DocRow[]) {
  return [...docs].sort((a, b) => a.order_index - b.order_index)
}

function getChildren(docs: DocRow[], parentId: string | null) {
  return sortByOrder(docs.filter((d) => d.parent_id === parentId))
}

function collectDocumentIdsInTreeOrder(documents: DocRow[]): string[] {
  const ids: string[] = []
  function walk(parentId: string | null) {
    for (const node of getChildren(documents, parentId)) {
      if (node.type === 'folder') walk(node.id)
      else ids.push(node.id)
    }
  }
  walk(null)
  return ids
}

function contentToPlainText(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return ''
  const visit = (node: unknown): string => {
    if (!node || typeof node !== 'object') return ''
    const o = node as { text?: string; content?: unknown[] }
    const text = typeof o.text === 'string' ? o.text : ''
    const children = Array.isArray(o.content) ? o.content.map(visit).join(' ') : ''
    return `${text} ${children}`.trim()
  }
  return visit(raw).replace(/\s+/g, ' ').trim()
}

function isContentEmpty(content: unknown): boolean {
  if (content == null) return true
  if (typeof content !== 'object') return true
  const o = content as { type?: string; content?: unknown[] }
  if (o.type !== 'doc') return contentToPlainText(content).length === 0
  if (!Array.isArray(o.content) || o.content.length === 0) return true
  return contentToPlainText(content).length === 0
}

function folderTitleChain(documents: DocRow[], doc: DocRow): string[] {
  const chain: string[] = []
  let pid: string | null = doc.parent_id
  while (pid) {
    const p = documents.find((d) => d.id === pid)
    if (!p || p.type !== 'folder') break
    chain.push(p.title)
    pid = p.parent_id
  }
  chain.reverse()
  return chain
}

function emitFolderTransitions(prev: string[], next: string[]): string {
  let i = 0
  const n = Math.min(prev.length, next.length)
  while (i < n && prev[i] === next[i]) i++
  let out = ''
  for (let j = i; j < next.length; j++) {
    out += `# ${next[j]}\n\n`
  }
  return out
}

function jsonToMarkdown(json: JSONContent): string {
  const editor = new Editor({
    extensions: [StarterKit, Markdown],
    content: json,
    editable: false,
  })
  const storage = editor.storage as { markdown?: { getMarkdown: () => string } }
  const md = storage.markdown?.getMarkdown() ?? ''
  editor.destroy()
  return md.trimEnd()
}

type TNode = {
  type: string
  text?: string
  content?: TNode[]
  marks?: { type: string }[]
  attrs?: { level?: number }
}

function inlinesToRuns(nodes: TNode[] | undefined): TextRun[] {
  if (!nodes?.length) return [new TextRun({ text: '' })]
  const runs: TextRun[] = []
  for (const n of nodes) {
    if (n.type === 'text') {
      const bold = n.marks?.some((m) => m.type === 'bold')
      const italics = n.marks?.some((m) => m.type === 'italic')
      runs.push(new TextRun({ text: n.text ?? '', bold, italics }))
    } else if (n.type === 'hardBreak') {
      runs.push(new TextRun({ break: 1 }))
    }
  }
  return runs.length ? runs : [new TextRun({ text: '' })]
}

function blocksFromDocContent(content: unknown): Paragraph[] {
  const root = content as TNode
  if (!root?.content?.length) return []
  const out: Paragraph[] = []
  for (const child of root.content) {
    if (child.type === 'paragraph') {
      out.push(new Paragraph({ children: inlinesToRuns(child.content) }))
    } else if (child.type === 'heading') {
      const level = Math.min(3, Math.max(1, child.attrs?.level ?? 1))
      const hl =
        level === 1
          ? HeadingLevel.HEADING_1
          : level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3
      out.push(new Paragraph({ heading: hl, children: inlinesToRuns(child.content) }))
    } else if (child.type === 'bulletList') {
      for (const li of child.content ?? []) {
        if (li.type !== 'listItem') continue
        for (const inner of li.content ?? []) {
          if (inner.type === 'paragraph') {
            out.push(
              new Paragraph({
                children: inlinesToRuns(inner.content),
                bullet: { level: 0 },
              })
            )
          }
        }
      }
    } else if (child.type === 'orderedList') {
      let num = 1
      for (const li of child.content ?? []) {
        if (li.type !== 'listItem') continue
        for (const inner of li.content ?? []) {
          if (inner.type === 'paragraph') {
            const runs = inlinesToRuns(inner.content)
            out.push(
              new Paragraph({
                children: [new TextRun({ text: `${num}. ` }), ...runs],
              })
            )
            num += 1
          }
        }
      }
    } else if (child.type === 'horizontalRule') {
      out.push(new Paragraph({ children: [new TextRun({ text: '—' })] }))
    }
  }
  return out
}

function safeFileBase(title: string) {
  const t = title.trim() || 'project'
  return t.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 120)
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function SortableDocRow({
  id,
  title,
  checked,
  onToggle,
}: {
  id: string
  title: string
  checked: boolean
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 border-b border-[var(--border)] py-2 pr-1 text-sm text-[var(--foreground)]"
    >
      <button
        type="button"
        className="touch-none rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
        aria-label="순서 이동"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <input type="checkbox" checked={checked} onChange={onToggle} className="shrink-0 rounded" />
        <span className="truncate">{title}</span>
      </label>
    </div>
  )
}

export function CompileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { projectId, documents } = useBinderContext()
  const [projectTitle, setProjectTitle] = useState('')
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (!open || !projectId) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('write_projects')
        .select('title')
        .eq('id', projectId)
        .maybeSingle()
      if (!cancelled && data?.title) setProjectTitle(data.title as string)
    })()
    return () => {
      cancelled = true
    }
  }, [open, projectId])

  useEffect(() => {
    if (!open) return
    const ids = collectDocumentIdsInTreeOrder(documents)
    setOrderedIds(ids)
    setSelectedIds(new Set(ids))
  }, [open, documents])

  const idToDoc = useMemo(() => {
    const m = new Map<string, DocRow>()
    for (const d of documents) {
      if (d.type === 'document') m.set(d.id, d)
    }
    return m
  }, [documents])

  const rowIds = useMemo(() => orderedIds.filter((id) => idToDoc.has(id)), [orderedIds, idToDoc])

  const buildMergedMarkdown = useCallback(() => {
    const parts: string[] = []
    let prevPath: string[] = []
    let any = false
    for (const id of orderedIds) {
      if (!selectedIds.has(id)) continue
      const doc = idToDoc.get(id)
      if (!doc || isContentEmpty(doc.content)) continue
      any = true
      const path = folderTitleChain(documents, doc)
      parts.push(emitFolderTransitions(prevPath, path))
      prevPath = path
      parts.push(`## ${doc.title}\n\n`)
      parts.push(jsonToMarkdown(doc.content as JSONContent))
      parts.push('\n\n')
    }
    return { text: parts.join('').trimEnd(), any }
  }, [orderedIds, selectedIds, idToDoc, documents])

  const previewText = useMemo(() => {
    if (selectedIds.size === 0) return ''
    const { text, any } = buildMergedMarkdown()
    return any ? text : ''
  }, [buildMergedMarkdown, selectedIds])

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setOrderedIds((items) => {
      const valid = items.filter((id) => idToDoc.has(id))
      const oldIndex = valid.indexOf(active.id as string)
      const newIndex = valid.indexOf(over.id as string)
      if (oldIndex < 0 || newIndex < 0) return items
      const moved = arrayMove(valid, oldIndex, newIndex)
      const tail = items.filter((id) => !idToDoc.has(id))
      return [...moved, ...tail]
    })
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(orderedIds))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  async function downloadMd() {
    const { text, any } = buildMergedMarkdown()
    if (!any) return
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    downloadBlob(blob, `${safeFileBase(projectTitle)}.md`)
  }

  async function downloadDocx() {
    const children: Paragraph[] = []
    let prevPath: string[] = []
    for (const id of orderedIds) {
      if (!selectedIds.has(id)) continue
      const doc = idToDoc.get(id)
      if (!doc || isContentEmpty(doc.content)) continue
      const path = folderTitleChain(documents, doc)
      let i = 0
      const n = Math.min(prevPath.length, path.length)
      while (i < n && prevPath[i] === path[i]) i++
      for (let j = i; j < path.length; j++) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: path[j] })],
          })
        )
      }
      prevPath = path
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: doc.title })],
        })
      )
      children.push(...blocksFromDocContent(doc.content))
    }
    const file = new DocxFile({
      sections: [{ children }],
    })
    const blob = await Packer.toBlob(file)
    downloadBlob(blob, `${safeFileBase(projectTitle)}.docx`)
  }

  const hasExportable =
    orderedIds.some((id) => selectedIds.has(id) && !isContentEmpty(idToDoc.get(id)?.content))

  const emptySelection = selectedIds.size === 0

  if (!open) return null

  return (
    <div
      className="modal-overlay-apple fixed inset-0 z-[520] flex items-center justify-center p-4"
      role="dialog"
      aria-modal
      aria-labelledby="compile-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal-panel-apple flex w-full max-w-[800px] flex-col overflow-hidden p-0"
        style={{ height: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 id="compile-modal-title" className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
            <FileOutput className="h-5 w-5 text-[var(--muted)]" aria-hidden />
            컴파일
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-[3] flex-col border-r border-[var(--border)]">
            <div className="flex shrink-0 flex-wrap gap-2 border-b border-[var(--border)] p-3">
              <button
                type="button"
                onClick={selectAll}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)]"
              >
                전체 선택
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)]"
              >
                전체 해제
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
                  {rowIds.map((id) => {
                    const doc = idToDoc.get(id)!
                    return (
                      <SortableDocRow
                        key={id}
                        id={id}
                        title={doc.title}
                        checked={selectedIds.has(id)}
                        onToggle={() => toggleId(id)}
                      />
                    )
                  })}
                </SortableContext>
              </DndContext>
            </div>
          </div>
          <div className="flex min-w-0 flex-[7] flex-col">
            <div className="shrink-0 border-b border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)]">
              미리보기
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {emptySelection ? (
                <p className="text-sm text-[var(--muted)]">문서를 선택하세요</p>
              ) : !hasExportable ? (
                <p className="text-sm text-[var(--muted)]">문서를 선택하세요</p>
              ) : (
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--foreground)]">
                  {previewText}
                </pre>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            disabled={!hasExportable}
            onClick={() => void downloadMd()}
            className="btn-accent rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Markdown 다운로드
          </button>
          <button
            type="button"
            disabled={!hasExportable}
            onClick={() => void downloadDocx()}
            className="btn-accent rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Word 다운로드
          </button>
        </div>
      </div>
    </div>
  )
}
