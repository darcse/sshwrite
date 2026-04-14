'use client'

import { BinderProvider, BinderTree, useBinderContext } from '@/components/binder/BinderTree'
import { BinderHeaderBar, BinderPanelToggleIcon } from '@/components/binder/BinderHeaderBar'
import { AssistantPanel } from '@/components/assistant/AssistantPanel'
import { EditorPanel } from '@/components/editor/EditorPanel'
import { InspectorPanel } from '@/components/editor/InspectorPanel'
import { ProjectHeader } from '@/components/editor/ProjectHeader'
import { createClient } from '@/lib/supabase/client'
import { tiptapToPlainText } from '@/lib/doc-utils'
import {
  DEFAULT_BINDER,
  DEFAULT_INSPECTOR,
  MIN_PANEL,
  SPLITTER_PX,
  COLLAPSE_RAIL_PX,
  type StoredLayout,
  loadStored,
  saveStored,
  clampBinder,
  clampInspector,
} from '@/lib/workspace-layout'
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

function ProjectWorkspace({ projectId }: { projectId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<StoredLayout>({
    binderWidth: DEFAULT_BINDER,
    inspectorWidth: DEFAULT_INSPECTOR,
    binderCollapsed: false,
  })

  const [workspaceReady, setWorkspaceReady] = useState(false)
  useLayoutEffect(() => {
    setWorkspaceReady(true)
  }, [])

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

  if (!workspaceReady) {
    return (
      <div
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-t border-[var(--border)] bg-[var(--card-bg)]"
        aria-busy
      >
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--muted)]">
          불러오는 중…
        </div>
      </div>
    )
  }

  return (
    <BinderProvider projectId={projectId} uploadCharacterImage={uploadCharacterImage}>
      <div className="flex h-full min-h-0 w-full flex-col">
      <ProjectWorkspaceBody
        projectId={projectId}
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
      </div>
    </BinderProvider>
  )
}

function ProjectWorkspaceBody({
  projectId,
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
  projectId: string
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
  const selectedDocText = selectedDoc?.type === 'document' ? tiptapToPlainText(selectedDoc.content) : ''
  return (
    <>
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-[var(--border)] bg-[var(--card-bg)]">
      <ProjectHeader projectId={projectId} />
      <div
        ref={containerRef}
        className="flex h-full min-h-0 w-full flex-1 flex-col md:flex-row md:overflow-hidden"
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
                className="sticky top-0 z-10 flex h-12 w-7 shrink-0 items-center justify-center border-r border-b border-[var(--border)] bg-[var(--card-bg)] text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
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
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-b border-[var(--border)] md:border-b-0"
          data-panel="editor"
        >
          <EditorPanel showInspectorMeta={inspectorTab === 'inspector'} />
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
            Assistant
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3 text-sm text-[var(--muted)]">
          <div
            data-inspector-panel-content
            className={
              inspectorTab === 'inspector'
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                : 'hidden'
            }
          >
            <div className="min-h-0 shrink grow-0 overflow-y-auto pb-6">
              <InspectorPanel />
            </div>
            <div
              data-inspector-meta-mount
              className="shrink-0 border-t border-[var(--border)] pt-6"
            />
          </div>
          <div className={inspectorTab === 'ai' ? 'flex h-full min-h-0 flex-col overflow-hidden' : 'hidden'}>
            <AssistantPanel
              documentId={selectedDocId ?? null}
              documentText={selectedDocText}
            />
          </div>
        </div>
      </aside>
      </div>
    </div>
    </>
  )
}

function ProjectPageInner() {
  const params = useParams()
  const projectId = params.projectId as string
  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-0 w-full flex-col overflow-hidden">
      <div className="flex h-0 min-h-0 flex-1 flex-col">
        <ProjectWorkspace projectId={projectId} />
      </div>
    </div>
  )
}

export default function ProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100dvh-3rem)] shrink-0 items-center justify-center p-8 text-sm text-[var(--muted)]">
          불러오는 중…
        </div>
      }
    >
      <ProjectPageInner />
    </Suspense>
  )
}
