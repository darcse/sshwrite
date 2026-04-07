'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

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
const COLLAPSE_RAIL_PX = 40

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
  const max =
    containerW - inspectorW - SPLITTER_PX * 2 - MIN_EDITOR
  return Math.min(Math.max(MIN_PANEL, next), Math.max(MIN_PANEL, max))
}

function clampInspector(next: number, containerW: number, binderW: number) {
  const max =
    containerW - binderW - SPLITTER_PX * 2 - MIN_EDITOR
  return Math.min(Math.max(MIN_PANEL, next), Math.max(MIN_PANEL, max))
}

export function ProjectEditorShell({ projectId }: { projectId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<StoredLayout>({
    binderWidth: DEFAULT_BINDER,
    inspectorWidth: DEFAULT_INSPECTOR,
    binderCollapsed: false,
  })

  const [binderWidth, setBinderWidth] = useState(DEFAULT_BINDER)
  const [inspectorWidth, setInspectorWidth] = useState(DEFAULT_INSPECTOR)
  const [binderCollapsed, setBinderCollapsed] = useState(false)
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

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 w-full flex-1 flex-col border-t md:h-[calc(100dvh-3.5rem)] md:flex-row md:overflow-hidden"
      style={{
        borderColor: 'var(--border-color)',
        backgroundColor: 'var(--bg-color)',
      }}
    >
      <div
        className="flex min-h-0 shrink-0 flex-col border-b md:h-full md:border-b-0 md:border-r"
        style={{
          ...binderColumnStyle,
          borderColor: 'var(--border-color)',
        }}
        data-panel="binder"
      >
        {binderCollapsed ? (
          <div className="flex h-full min-h-[2.5rem] flex-row items-stretch md:min-h-0 md:w-full md:flex-col">
            <button
              type="button"
              onClick={toggleBinder}
              className="flex flex-1 items-center justify-center border-r text-sm md:w-full md:flex-1 md:border-r-0 md:border-b"
              style={{
                borderColor: 'var(--border-color)',
                backgroundColor: 'var(--surface-color)',
                color: 'var(--text-secondary)',
              }}
              aria-expanded={false}
              aria-controls="binder-panel"
              title="바인더 펼치기"
            >
              ▸
            </button>
          </div>
        ) : (
          <div id="binder-panel" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-2"
              style={{
                borderColor: 'var(--border-color)',
                backgroundColor: 'var(--surface-color)',
              }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                바인더
              </span>
              <button
                type="button"
                onClick={toggleBinder}
                className="rounded px-2 py-1 text-sm"
                style={{ color: 'var(--text-secondary)' }}
                aria-expanded
                aria-controls="binder-panel"
                title="바인더 접기"
              >
                ◂
              </button>
            </div>
            <div
              className="min-h-0 flex-1 overflow-auto p-3 text-sm"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--surface-color)',
              }}
            >
              프로젝트 {projectId}
            </div>
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
          backgroundColor: 'var(--border-color)',
        }}
        onMouseDown={startDragBinder}
      />

      <main
        className="flex min-h-[40vh] min-w-0 flex-1 flex-col overflow-hidden border-b md:min-h-0 md:border-b-0"
        style={{ borderColor: 'var(--border-color)' }}
        data-panel="editor"
      >
        <div
          className="shrink-0 border-b px-3 py-2 text-sm font-medium"
          style={{
            borderColor: 'var(--border-color)',
            backgroundColor: 'var(--surface-color)',
            color: 'var(--text-primary)',
          }}
        >
          에디터
        </div>
        <div
          className="min-h-0 flex-1 overflow-auto p-4"
          style={{
            backgroundColor: 'var(--surface-color)',
            color: 'var(--text-secondary)',
          }}
        >
          문서 내용
        </div>
      </main>

      <div
        role="separator"
        aria-orientation="vertical"
        className="hidden shrink-0 cursor-col-resize md:block"
        style={{
          width: SPLITTER_PX,
          backgroundColor: 'var(--border-color)',
        }}
        onMouseDown={startDragInspector}
      />

      <aside
        className="flex min-h-0 shrink-0 flex-col border-t md:h-full md:border-t-0 md:border-l"
        style={{
          ...inspectorStyle,
          borderColor: 'var(--border-color)',
          backgroundColor: 'var(--surface-color)',
        }}
        data-panel="inspector"
      >
        <div
          className="shrink-0 border-b px-3 py-2 text-sm font-medium"
          style={{
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          인스펙터
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          메타데이터
        </div>
      </aside>
    </div>
  )
}
