'use client'

import { Loader2, Send, Sparkles } from 'lucide-react'
import { useState } from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

export function AssistantPanel({
  documentText,
}: {
  documentText: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function callAssistant(payload: Record<string, unknown>) {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(json.error ?? '요청에 실패했습니다.')
    }
    const json = (await res.json()) as { text?: string }
    return (json.text ?? '').trim()
  }

  async function sendChat() {
    const text = input.trim()
    if (!text || loading) return
    setError('')
    setLoading(true)
    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')
    try {
      const reply = await callAssistant({
        mode: 'chat',
        message: text,
        context: documentText,
      })
      setMessages((prev) => [...prev, { role: 'assistant', text: reply || '응답이 비어 있습니다.' }])
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function suggestIdeas() {
    if (loading) return
    if (!documentText.trim()) {
      setError('문서 내용이 없어서 아이디어를 제안할 수 없습니다.')
      return
    }
    setError('')
    setLoading(true)
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: '현재 문서 기준으로 아이디어를 제안해줘.' },
    ])
    try {
      const reply = await callAssistant({
        mode: 'ideas',
        context: documentText,
      })
      setMessages((prev) => [...prev, { role: 'assistant', text: reply || '아이디어를 생성하지 못했습니다.' }])
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <button
        type="button"
        onClick={() => void suggestIdeas()}
        disabled={loading}
        className="inline-flex w-fit items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60"
        style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--foreground)' }}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        아이디어 제안
      </button>
      <div className="min-h-0 flex-1 overflow-auto rounded border border-[var(--border)] bg-[var(--card-bg)] p-2">
        <div className="flex flex-col gap-2">
          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className="rounded px-2 py-1.5 text-sm whitespace-pre-wrap"
              style={{
                backgroundColor: m.role === 'assistant' ? 'var(--badge-bg)' : 'transparent',
                color: 'var(--foreground)',
              }}
            >
              {m.text}
            </div>
          ))}
          {loading ? (
            <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              응답 생성 중…
            </div>
          ) : null}
          {error ? <p className="text-xs text-[#ff3b30]">{error}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <textarea
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onInput={(e) => {
            const el = e.currentTarget
            el.style.height = '80px'
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`
          }}
          placeholder="프롬프트를 입력해 주세요"
          className="input-apple min-w-0 resize-none px-2 py-1.5 text-sm"
          style={{ minHeight: 80, maxHeight: 160, overflowY: 'auto' }}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void sendChat()}
            disabled={loading || !input.trim()}
            className="btn-accent inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            전송
          </button>
        </div>
      </div>
    </div>
  )
}
