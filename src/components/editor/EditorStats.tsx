'use client'

import { useLayoutEffect, useState, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type EditorStatsProps = {
  wordCount: number
  targetWords: number | null
  onTargetWordsChange: (n: number | null) => void
  saveStatus: SaveStatus
  focusMode: boolean
  onFocusModeChange: (v: boolean) => void
}

export function EditorStats({
  wordCount,
  targetWords,
  onTargetWordsChange,
  saveStatus,
  focusMode,
  onFocusModeChange,
}: EditorStatsProps) {
  const [inspectorMount, setInspectorMount] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const host = document.querySelector(
      'aside[data-panel="inspector"] > div:last-child'
    ) as HTMLElement | null
    if (!host) return
    const el = document.createElement('div')
    host.insertBefore(el, host.firstChild)
    setInspectorMount(el)
    return () => {
      setInspectorMount(null)
      if (el.parentNode === host) {
        host.removeChild(el)
      }
    }
  }, [])

  const onGoalInput = useCallback(
    (raw: string) => {
      const t = raw.trim()
      if (t === '') {
        onTargetWordsChange(null)
        return
      }
      const n = parseInt(t, 10)
      if (!Number.isFinite(n) || n <= 0) {
        onTargetWordsChange(null)
        return
      }
      onTargetWordsChange(n)
    },
    [onTargetWordsChange]
  )

  const goalBlock = (
    <div
      className="mb-4 border-b pb-4"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <label className="flex flex-col gap-1.5 text-sm">
        <span style={{ color: 'var(--text-secondary)' }}>목표 단어 수</span>
        <input
          type="number"
          min={1}
          step={1}
          value={targetWords ?? ''}
          placeholder="미설정"
          onChange={(e) => onGoalInput(e.target.value)}
          className="input-apple w-full px-2 py-1.5 text-sm"
        />
      </label>
    </div>
  )

  const progressPct =
    targetWords != null && targetWords > 0
      ? Math.min(100, (wordCount / targetWords) * 100)
      : null

  const goalInFooter = !inspectorMount

  return (
    <>
      {inspectorMount ? createPortal(goalBlock, inspectorMount) : null}

      <div
        className="flex shrink-0 flex-col gap-2 border-t px-1 py-1.5 text-xs"
        style={{
          borderColor: 'var(--border-color)',
          color: 'var(--muted)',
        }}
      >
        {goalInFooter ? goalBlock : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span style={{ color: 'var(--foreground)' }}>
                {wordCount}
                {targetWords != null && targetWords > 0 ? (
                  <>
                    {' '}
                    / {targetWords} 단어
                  </>
                ) : (
                  <> 단어</>
                )}
              </span>
            </div>
            {progressPct != null ? (
              <div
                className="h-1 w-full max-w-xs overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--badge-bg)' }}
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: 'var(--accent)',
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="btn-accent rounded-lg px-2.5 py-1 text-xs font-semibold"
              onClick={() => onFocusModeChange(!focusMode)}
            >
              {focusMode ? '포커스 해제' : '포커스 모드'}
            </button>
          </div>
        </div>

        <div style={{ color: 'var(--muted)' }}>
          {saveStatus === 'saving' ? '저장 중…' : null}
          {saveStatus === 'saved' ? '저장됨' : null}
          {saveStatus === 'error'
            ? '저장에 실패했습니다. 네트워크를 확인해 주세요.'
            : null}
          {saveStatus === 'idle' && !focusMode ? '\u00a0' : null}
        </div>
      </div>
    </>
  )
}
