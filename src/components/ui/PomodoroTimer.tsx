'use client'

import { Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type Phase = 'writing' | 'break'

function formatTime(totalSeconds: number) {
  const mm = Math.floor(totalSeconds / 60)
  const ss = totalSeconds % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function PomodoroTimer() {
  const [open, setOpen] = useState(false)
  const [writingMinutes, setWritingMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [phase, setPhase] = useState<Phase>('writing')
  const [running, setRunning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60)
  const [completedCount, setCompletedCount] = useState(0)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  const accentColor = phase === 'writing' ? 'var(--accent)' : '#34C759'

  useEffect(() => {
    if (running) return
    setRemainingSeconds((phase === 'writing' ? writingMinutes : breakMinutes) * 60)
  }, [writingMinutes, breakMinutes, phase, running])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev > 1) return prev - 1

        if (phase === 'writing') {
          if (Notification.permission === 'granted') {
            new Notification('집필 시간 종료! 휴식을 취하세요')
          }
          setPhase('break')
          return breakMinutes * 60
        }

        if (Notification.permission === 'granted') {
          new Notification('휴식 종료! 다시 집필을 시작하세요')
        }
        setCompletedCount((count) => count + 1)
        setPhase('writing')
        return writingMinutes * 60
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, phase, writingMinutes, breakMinutes])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!popoverRef.current) return
      if (!popoverRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const timeText = useMemo(() => formatTime(remainingSeconds), [remainingSeconds])

  async function handleStart() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    setRunning(true)
  }

  function handlePause() {
    setRunning(false)
  }

  function handleReset() {
    setRunning(false)
    setPhase('writing')
    setRemainingSeconds(writingMinutes * 60)
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm"
        style={{ color: running ? accentColor : 'var(--muted)' }}
        aria-label="포모도로 타이머"
      >
        {running ? <span className="tabular-nums">{timeText}</span> : null}
        {running ? <Pause className="h-4 w-4" strokeWidth={2} aria-hidden /> : <Timer className="h-4 w-4" strokeWidth={2} aria-hidden />}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-20 w-64 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3 shadow-lg"
        >
          <div className="flex flex-col gap-3 text-sm">
            <label className="flex items-center justify-between gap-2">
              <span className="text-[var(--muted)]">집필 시간</span>
              <input
                type="number"
                min={1}
                max={60}
                value={writingMinutes}
                onChange={(e) => setWritingMinutes(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                className="input-apple w-20 px-2 py-1 text-right text-sm"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-[var(--muted)]">휴식 시간</span>
              <input
                type="number"
                min={1}
                max={30}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
                className="input-apple w-20 px-2 py-1 text-right text-sm"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={running ? handlePause : () => void handleStart()}
                className="btn-apple flex-1 px-2 py-1.5 text-xs"
              >
                {running ? '일시정지' : '시작'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="btn-apple px-2 py-1.5 text-xs"
              >
                리셋
              </button>
            </div>
            <div className="text-xs text-[var(--muted)]">🍅 x {completedCount}</div>
            <div className="flex items-center gap-2 text-xs" style={{ color: accentColor }}>
              {running ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
              <span>{phase === 'writing' ? '집필 중' : '휴식 중'}</span>
              <RotateCcw className="h-3.5 w-3.5 opacity-0" aria-hidden />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
