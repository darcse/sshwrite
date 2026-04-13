export const STORAGE_KEY = 'sshwrite:editor-layout'

export type StoredLayout = {
  binderWidth: number
  inspectorWidth: number
  binderCollapsed: boolean
}

export const DEFAULT_BINDER = 260
export const DEFAULT_INSPECTOR = 280
export const MIN_PANEL = 160
export const MIN_EDITOR = 200
export const SPLITTER_PX = 6
export const COLLAPSE_RAIL_PX = 28
export const LABEL_COLORS = [
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#007aff',
  '#5856d6',
  '#ff2d55',
]

export function loadStored(projectId: string): StoredLayout | null {
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

export function saveStored(projectId: string, layout: StoredLayout) {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${projectId}`, JSON.stringify(layout))
  } catch {}
}

export function clampBinder(next: number, containerW: number, inspectorW: number) {
  const max = containerW - inspectorW - SPLITTER_PX * 2 - MIN_EDITOR
  return Math.min(Math.max(MIN_PANEL, next), Math.max(MIN_PANEL, max))
}

export function clampInspector(next: number, containerW: number, binderW: number) {
  const max = containerW - binderW - SPLITTER_PX * 2 - MIN_EDITOR
  return Math.min(Math.max(MIN_PANEL, next), Math.max(MIN_PANEL, max))
}
