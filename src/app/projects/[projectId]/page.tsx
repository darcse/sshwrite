'use client'

import { BinderProvider, BinderTree, useBinderContext } from '@/components/binder/BinderTree'
import { AssistantPanel } from '@/components/assistant/AssistantPanel'
import { Corkboard } from '@/components/corkboard/Corkboard'
import { Editor } from '@/components/editor/Editor'
import { PomodoroTimer } from '@/components/ui/PomodoroTimer'
import { createClient } from '@/lib/supabase/client'
import {
  CheckCircle2,
  Circle,
  Expand,
  FilePlus,
  FolderPlus,
  PenLine,
  Shrink,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  Suspense,
  type CSSProperties,
  type RefObject,
} from 'react'
import { useParams } from 'next/navigation'

const STORAGE_KEY = 'sshwrite:editor-layout'

type StoredLayout = {
  binderWidth: number
  inspectorWidth: number
  binderCollapsed: boolean
}

const DEFAULT_BINDER = 260
const DEFAULT_INSPECTOR = 280
const MIN_PANEL = 160
const MIN_EDITOR = 200
const SPLITTER_PX = 6
const COLLAPSE_RAIL_PX = 28
const LABEL_COLORS = [
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#007aff',
  '#5856d6',
  '#ff2d55',
]

async function uploadWriteAssetToStorage(
  file: File,
  projectId: string
): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const parts = file.name.split('.')
  const last = parts[parts.length - 1]
  const ext =
    parts.length > 1 && last && /^[a-zA-Z0-9]+$/.test(last) ? last : 'jpg'
  const path = `${projectId}/${user.id}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('write-assets').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) return null
  const { data } = supabase.storage.from('write-assets').getPublicUrl(path)
  return data.publicUrl
}

function contentToText(raw: unknown): string {
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

function BinderPanelToggleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="4" height="12" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="8" y="2" width="6" height="12" rx="1" fill="currentColor" />
    </svg>
  )
}

function loadStored(projectId: string): StoredLayout | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${projectId}`)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<StoredLayout>
    if (
      typeof p.binderWidth !== 'number' ||
      typeof p.inspectorWidth !== 'number' ||
      typeof p.binderCollapsed !== 'boolean'
    ) {
      return null
    }
    return {
      binderWidth: p.binderWidth,
      inspectorWidth: p.inspectorWidth,
      binderCollapsed: p.binderCollapsed,
    }
  } catch {
    return null
  }
}

function saveStored(projectId: string, layout: StoredLayout) {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${projectId}`, JSON.stringify(layout))
  } catch {}
}

function clampBinder(next: number, containerW: number, inspectorW: number) {
  const max = containerW - inspectorW - SPLITTER_PX * 2 - MIN_EDITOR
  return Math.min(Math.max(MIN_PANEL, next), Math.max(MIN_PANEL, max))
}

function clampInspector(next: number, containerW: number, binderW: number) {
  const max = containerW - binderW - SPLITTER_PX * 2 - MIN_EDITOR
  return Math.min(Math.max(MIN_PANEL, next), Math.max(MIN_PANEL, max))
}

function BinderHeaderBar({ onCollapse }: { onCollapse: () => void }) {
  const { createDocument, createFolder, loading } = useBinderContext()
  const [pending, setPending] = useState(false)
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
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--card-bg)] px-4">
      <span className="text-sm font-medium text-[var(--foreground)]">Binder</span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => run(createDocument)}
          disabled={busy}
          className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
          title="새 문서"
        >
          <FilePlus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => run(createFolder)}
          disabled={busy}
          className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
          title="새 폴더"
        >
          <FolderPlus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onCollapse}
          className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          aria-expanded
          aria-controls="binder-panel"
          title="바인더 접기"
        >
          <BinderPanelToggleIcon />
        </button>
      </div>
    </div>
  )
}

function EditorPanel() {
  const { documents, labels, selectedDocId, updateDocument, navigateToDoc } = useBinderContext()
  const doc = selectedDocId ? documents.find((d) => d.id === selectedDocId) : undefined
  const [focusMode, setFocusMode] = useState(false)
  return (
    <>
      <div className="flex h-12 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm font-medium text-[var(--foreground)]">
        <span className="min-w-0 flex-1 truncate">{doc ? doc.title : '문서를 선택하세요'}</span>
        <div className="flex items-center gap-1">
          <PomodoroTimer />
          <button
            type="button"
            className="shrink-0 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            onClick={() => setFocusMode((v) => !v)}
            aria-label={focusMode ? '포커스 해제' : '포커스 모드'}
            title={focusMode ? '포커스 해제' : '포커스 모드'}
          >
            {focusMode ? (
              <Shrink className="h-5 w-5" strokeWidth={2} aria-hidden />
            ) : (
              <Expand className="h-5 w-5" strokeWidth={2} aria-hidden />
            )}
          </button>
        </div>
      </div>
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden p-4"
        style={{
          backgroundColor: 'var(--card-bg)',
        }}
      >
        {!doc ? (
          <p className="text-[var(--muted)]">문서를 선택하세요</p>
        ) : doc.type === 'folder' ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <Corkboard
              folderId={doc.id}
              documents={documents}
              labels={labels}
              onOpenDocument={navigateToDoc}
              onSaveSynopsis={async (id, synopsis) => {
                await updateDocument(id, { synopsis: synopsis || null })
              }}
            />
          </div>
        ) : (
          <Editor
            key={doc.id}
            documentId={doc.id}
            initialContent={doc.content}
            focusMode={focusMode}
            onFocusModeChange={setFocusMode}
          />
        )}
      </div>
    </>
  )
}

function InspectorPanel() {
  const { projectId, documents, labels, selectedDocId, updateDocument, refresh, loading } =
    useBinderContext()
  const [saving, setSaving] = useState(false)
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0])
  const [labelName, setLabelName] = useState('')
  const [synopsisDraft, setSynopsisDraft] = useState('')
  const [memoDraft, setMemoDraft] = useState('')
  const doc = selectedDocId ? documents.find((d) => d.id === selectedDocId) : undefined
  const docLabelId =
    ((doc as unknown as { label_id?: string | null })?.label_id ?? doc?.label) ?? null
  const selectedLabel = labels.find((l) => l.id === docLabelId)

  async function patch(p: Parameters<typeof updateDocument>[1]) {
    if (!doc) return
    setSaving(true)
    await updateDocument(doc.id, p)
    setSaving(false)
  }

  useEffect(() => {
    if (!doc || doc.type !== 'document') return
    setSynopsisDraft(doc.synopsis ?? '')
    setMemoDraft(((doc as unknown as { memo?: string | null }).memo ?? '') as string)
    if (selectedLabel) {
      setLabelColor(selectedLabel.color)
      setLabelName(selectedLabel.name)
    } else {
      setLabelColor(LABEL_COLORS[0])
      setLabelName('')
    }
  }, [doc?.id, doc?.synopsis, doc?.label, selectedLabel?.id, selectedLabel?.color, selectedLabel?.name])

  useEffect(() => {
    if (!doc || doc.type !== 'document') return
    const timer = setTimeout(() => {
      const next = synopsisDraft.trim()
      if ((doc.synopsis ?? '') === next) return
      void patch({ synopsis: next || null })
    }, 1000)
    return () => clearTimeout(timer)
  }, [synopsisDraft, doc?.id])

  useEffect(() => {
    if (!doc || doc.type !== 'document') return
    const timer = setTimeout(async () => {
      const next = memoDraft.trim()
      const current = ((doc as unknown as { memo?: string | null }).memo ?? '') as string
      if (current === next) return
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      await supabase
        .from('write_documents')
        .update({ memo: next || null } as Record<string, unknown>)
        .eq('id', doc.id)
        .eq('user_id', user.id)
      await refresh()
    }, 1000)
    return () => clearTimeout(timer)
  }, [memoDraft, doc?.id, refresh])

  async function saveLabel() {
    if (!doc || doc.type !== 'document') return
    const nextName = labelName.trim()
    if (!nextName) return
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }
    if (selectedLabel) {
      await supabase
        .from('write_document_labels')
        .update({ name: nextName, color: labelColor })
        .eq('id', selectedLabel.id)
        .eq('user_id', user.id)
      await supabase
        .from('write_documents')
        .update({ label_id: selectedLabel.id } as Record<string, unknown>)
        .eq('id', doc.id)
        .eq('user_id', user.id)
      await refresh()
      setSaving(false)
      return
    }
    const { data } = await supabase
      .from('write_document_labels')
      .insert({
        project_id: projectId,
        user_id: user.id,
        name: nextName,
        color: labelColor,
      })
      .select('id')
      .single()
    if (data?.id) {
      await supabase
        .from('write_documents')
        .update({ label_id: data.id } as Record<string, unknown>)
        .eq('id', doc.id)
        .eq('user_id', user.id)
      await refresh()
      setSaving(false)
    } else {
      setSaving(false)
    }
  }

  async function clearLabel() {
    if (!doc || doc.type !== 'document') return
    setLabelName('')
    await patch({ label: null })
  }

  if (loading) {
    return <p className="text-[var(--muted)]">불러오는 중…</p>
  }

  if (!doc || doc.type !== 'document') {
    return (
      <p className="text-sm text-[var(--muted)]">
        문서를 선택하면 라벨과 상태를 편집할 수 있습니다.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">시놉시스</span>
        <textarea
          rows={3}
          value={synopsisDraft}
          onChange={(e) => setSynopsisDraft(e.target.value)}
          placeholder="시놉시스를 입력하세요"
          className="input-apple w-full resize-none px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">상태</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => patch({ status: 'todo' })}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors disabled:opacity-50"
            style={{
              backgroundColor: doc.status === 'todo' ? 'var(--badge-bg)' : 'transparent',
              color: 'var(--foreground)',
            }}
          >
            <Circle className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} aria-hidden />
            예정
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => patch({ status: 'writing' })}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors disabled:opacity-50"
            style={{
              backgroundColor: doc.status === 'writing' ? 'var(--badge-bg)' : 'transparent',
              color: 'var(--foreground)',
            }}
          >
            <PenLine className="h-3.5 w-3.5" style={{ color: '#007AFF' }} aria-hidden />
            작성 중
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => patch({ status: 'done' })}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors disabled:opacity-50"
            style={{
              backgroundColor: doc.status === 'done' ? 'var(--badge-bg)' : 'transparent',
              color: 'var(--foreground)',
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#34C759' }} aria-hidden />
            완료
          </button>
        </div>
      </label>
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">라벨</span>
        <div className="flex items-center gap-2">
          {LABEL_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setLabelColor(color)}
              className="h-4 w-4 rounded-full"
              style={{
                backgroundColor: color,
                border:
                  labelColor === color
                    ? '2px solid var(--foreground)'
                    : '1px solid color-mix(in srgb, var(--foreground) 20%, transparent)',
              }}
              aria-label={`라벨 색상 ${color}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
            placeholder="라벨 이름"
            className="input-apple min-w-0 flex-1 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={saveLabel}
            disabled={saving || !labelName.trim()}
            className="rounded px-2 py-1 text-xs text-[var(--foreground)] disabled:opacity-50"
            style={{ backgroundColor: 'var(--badge-bg)' }}
          >
            저장
          </button>
          <button
            type="button"
            onClick={clearLabel}
            disabled={saving || !doc.label}
            className="rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
            aria-label="라벨 제거"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {selectedLabel ? (
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: selectedLabel.color }}
            />
            <span className="text-[var(--foreground)]">{selectedLabel.name}</span>
          </div>
        ) : null}
      </div>
      <label className="mb-6 flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">메모</span>
        <textarea
          rows={5}
          value={memoDraft}
          onChange={(e) => setMemoDraft(e.target.value)}
          placeholder="메모를 입력하세요"
          className="input-apple w-full resize-none px-2 py-1.5 text-sm"
        />
      </label>
      {saving ? <p className="text-xs text-[var(--muted)]">저장 중…</p> : null}
    </div>
  )
}

function ProjectWorkspace({ projectId }: { projectId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<StoredLayout>({
    binderWidth: DEFAULT_BINDER,
    inspectorWidth: DEFAULT_INSPECTOR,
    binderCollapsed: false,
  })

  const [binderWidth, setBinderWidth] = useState(DEFAULT_BINDER)
  const [inspectorWidth, setInspectorWidth] = useState(DEFAULT_INSPECTOR)
  const [binderCollapsed, setBinderCollapsed] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<'inspector' | 'ai'>('inspector')
  const [hydrated, setHydrated] = useState(false)
  const [desktop, setDesktop] = useState(false)

  const dragKind = useRef<'binder' | 'inspector' | null>(null)
  const dragStartX = useRef(0)
  const dragStartBinder = useRef(0)
  const dragStartInspector = useRef(0)

  useLayoutEffect(() => {
    const s = loadStored(projectId)
    if (s) {
      layoutRef.current = s
      setBinderWidth(s.binderWidth)
      setInspectorWidth(s.inspectorWidth)
      setBinderCollapsed(s.binderCollapsed)
    } else {
      layoutRef.current = {
        binderWidth: DEFAULT_BINDER,
        inspectorWidth: DEFAULT_INSPECTOR,
        binderCollapsed: false,
      }
    }
    setHydrated(true)
  }, [projectId])

  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    function update() {
      setDesktop(mq.matches)
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    layoutRef.current = {
      binderWidth,
      inspectorWidth,
      binderCollapsed,
    }
  }, [binderWidth, inspectorWidth, binderCollapsed])

  useEffect(() => {
    if (!hydrated) return
    saveStored(projectId, layoutRef.current)
  }, [projectId, binderCollapsed, hydrated])

  const persistWidths = useCallback(() => {
    saveStored(projectId, layoutRef.current)
  }, [projectId])

  useEffect(() => {
    if (!hydrated || !desktop) return

    function onMove(e: MouseEvent) {
      const el = containerRef.current
      if (!el || !dragKind.current) return
      const width = el.getBoundingClientRect().width
      if (width <= 0) return

      if (dragKind.current === 'binder') {
        const delta = e.clientX - dragStartX.current
        const next = dragStartBinder.current + delta
        const b = clampBinder(next, width, layoutRef.current.inspectorWidth)
        setBinderWidth(b)
        layoutRef.current = {
          ...layoutRef.current,
          binderWidth: b,
        }
      } else {
        const delta = e.clientX - dragStartX.current
        const next = dragStartInspector.current + delta
        const i = clampInspector(next, width, layoutRef.current.binderWidth)
        setInspectorWidth(i)
        layoutRef.current = {
          ...layoutRef.current,
          inspectorWidth: i,
        }
      }
    }

    function onUp() {
      if (dragKind.current) {
        dragKind.current = null
        persistWidths()
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [hydrated, desktop, persistWidths])

  function startDragBinder(e: React.MouseEvent) {
    if (binderCollapsed || !desktop) return
    e.preventDefault()
    dragKind.current = 'binder'
    dragStartX.current = e.clientX
    dragStartBinder.current = binderWidth
  }

  function startDragInspector(e: React.MouseEvent) {
    if (!desktop) return
    e.preventDefault()
    dragKind.current = 'inspector'
    dragStartX.current = e.clientX
    dragStartInspector.current = inspectorWidth
  }

  function toggleBinder() {
    setBinderCollapsed((c) => !c)
  }

  const binderColumnStyle: CSSProperties = desktop
    ? {
        width: binderCollapsed ? COLLAPSE_RAIL_PX : binderWidth,
        minWidth: binderCollapsed ? COLLAPSE_RAIL_PX : MIN_PANEL,
        maxWidth: binderCollapsed ? COLLAPSE_RAIL_PX : undefined,
      }
    : {
        width: '100%',
        maxHeight: '30vh',
      }

  const inspectorStyle: CSSProperties = desktop
    ? {
        width: inspectorWidth,
        minWidth: MIN_PANEL,
      }
    : {
        width: '100%',
        maxHeight: '28vh',
      }

  const uploadCharacterImage = useCallback(
    (file: File) => uploadWriteAssetToStorage(file, projectId),
    [projectId]
  )

  return (
    <BinderProvider projectId={projectId} uploadCharacterImage={uploadCharacterImage}>
      <ProjectWorkspaceBody
        containerRef={containerRef}
        binderColumnStyle={binderColumnStyle}
        inspectorStyle={inspectorStyle}
        desktop={desktop}
        binderCollapsed={binderCollapsed}
        toggleBinder={toggleBinder}
        startDragBinder={startDragBinder}
        startDragInspector={startDragInspector}
        inspectorTab={inspectorTab}
        setInspectorTab={setInspectorTab}
      />
    </BinderProvider>
  )
}

function ProjectWorkspaceBody({
  containerRef,
  binderColumnStyle,
  inspectorStyle,
  desktop,
  binderCollapsed,
  toggleBinder,
  startDragBinder,
  startDragInspector,
  inspectorTab,
  setInspectorTab,
}: {
  containerRef: RefObject<HTMLDivElement | null>
  binderColumnStyle: CSSProperties
  inspectorStyle: CSSProperties
  desktop: boolean
  binderCollapsed: boolean
  toggleBinder: () => void
  startDragBinder: (e: React.MouseEvent) => void
  startDragInspector: (e: React.MouseEvent) => void
  inspectorTab: 'inspector' | 'ai'
  setInspectorTab: (tab: 'inspector' | 'ai') => void
}) {
  const { documents, selectedDocId } = useBinderContext()
  const selectedDoc = selectedDocId ? documents.find((d) => d.id === selectedDocId) : undefined
  const selectedDocText = selectedDoc?.type === 'document' ? contentToText(selectedDoc.content) : ''
  return (
    <div
          ref={containerRef}
          className="flex min-h-0 w-full flex-1 flex-col border-t border-[var(--border)] bg-[var(--background)] md:h-[calc(100dvh-3.5rem)] md:flex-row md:overflow-hidden"
    >
        <div
          className="flex min-h-0 shrink-0 flex-col border-b border-[var(--border)] bg-[var(--card-bg)] transition-[width] duration-200 ease-out md:h-full md:border-b-0 md:border-r"
          style={binderColumnStyle}
          data-panel="binder"
        >
          {desktop && binderCollapsed ? (
            <div className="flex w-full flex-col items-stretch">
              <button
                type="button"
                onClick={toggleBinder}
                className="sticky top-0 z-10 flex h-12 w-7 shrink-0 items-center justify-center border-r border-[var(--border)] bg-[var(--card-bg)] text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                aria-expanded={false}
                aria-controls="binder-panel"
                title="바인더 펼치기"
              >
                <BinderPanelToggleIcon />
              </button>
            </div>
          ) : binderCollapsed && !desktop ? (
            <div className="flex h-full min-h-[2.5rem] w-full flex-row items-stretch">
              <button
                type="button"
                onClick={toggleBinder}
                className="flex flex-1 items-center justify-center border-r border-[var(--border)] bg-[var(--card-bg)] text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                aria-expanded={false}
                aria-controls="binder-panel"
                title="바인더 펼치기"
              >
                <BinderPanelToggleIcon />
              </button>
            </div>
          ) : (
            <div
              id="binder-panel"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <BinderHeaderBar onCollapse={toggleBinder} />
              <BinderTree />
            </div>
          )}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          className={
            binderCollapsed
              ? 'hidden'
              : 'hidden cursor-col-resize md:block md:shrink-0'
          }
          style={{
            width: SPLITTER_PX,
            backgroundColor: 'var(--border)',
          }}
          onMouseDown={startDragBinder}
        />

        <main
          className="flex min-h-[40vh] min-w-0 flex-1 flex-col overflow-hidden border-b border-[var(--border)] md:min-h-0 md:border-b-0"
          data-panel="editor"
        >
          <EditorPanel />
        </main>

        <div
          role="separator"
          aria-orientation="vertical"
          className="hidden shrink-0 cursor-col-resize md:block"
          style={{
            width: SPLITTER_PX,
            backgroundColor: 'var(--border)',
          }}
          onMouseDown={startDragInspector}
        />

      <aside
          className="flex min-h-0 shrink-0 flex-col border-t border-[var(--border)] bg-[var(--card-bg)] md:h-full md:border-t-0 md:border-l"
          style={{
            ...inspectorStyle,
            borderColor: 'var(--border)',
          }}
          data-panel="inspector"
      >
        <div className="flex h-12 shrink-0 items-end gap-4 border-b border-[var(--border)] px-3 text-sm font-medium">
          <button
            type="button"
            onClick={() => setInspectorTab('inspector')}
            className="h-full border-b-2 px-0.5"
            style={{
              color: inspectorTab === 'inspector' ? 'var(--foreground)' : 'var(--muted)',
              borderBottomColor: inspectorTab === 'inspector' ? 'var(--foreground)' : 'transparent',
            }}
          >
            Inspector
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab('ai')}
            className="h-full border-b-2 px-0.5"
            style={{
              color: inspectorTab === 'ai' ? 'var(--foreground)' : 'var(--muted)',
              borderBottomColor: inspectorTab === 'ai' ? 'var(--foreground)' : 'transparent',
            }}
          >
            AI
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3 text-sm text-[var(--muted)]">
          {inspectorTab === 'inspector' ? (
            <InspectorPanel />
          ) : (
            <AssistantPanel documentText={selectedDocText} />
          )}
        </div>
      </aside>
    </div>
  )
}

function ProjectPageInner() {
  const params = useParams()
  const projectId = params.projectId as string
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectWorkspace projectId={projectId} />
    </div>
  )
}

export default function ProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-[var(--muted)]">
          불러오는 중…
        </div>
      }
    >
      <ProjectPageInner />
    </Suspense>
  )
}
