'use client'

import { useBinderContext } from '@/components/binder/BinderTree'
import type { DocRow } from '@/components/binder/BinderTree'
import type { JSONContent } from '@tiptap/core'
import { generateHTML } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

const readingExtensions = [StarterKit]

function sortByOrder(docs: DocRow[]) {
  return [...docs].sort((a, b) => a.order_index - b.order_index)
}

function getChildren(docs: DocRow[], parentId: string | null) {
  return sortByOrder(docs.filter((d) => d.parent_id === parentId))
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

function docToHtml(content: unknown): string {
  try {
    const json = content as JSONContent
    if (!json || typeof json !== 'object') return ''
    return generateHTML(json, readingExtensions)
  } catch {
    return ''
  }
}

export function ReadingMode({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { projectId, documents } = useBinderContext()
  const [projectTitle, setProjectTitle] = useState('')

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

  const sections = useMemo(() => {
    const out: {
      key: string
      kind: 'folder' | 'document'
      title?: string
      html?: string
    }[] = []
    function walk(parentId: string | null) {
      for (const node of getChildren(documents, parentId)) {
        if (node.type === 'folder') {
          out.push({
            key: `f-${node.id}`,
            kind: 'folder',
            title: node.title,
          })
          walk(node.id)
        } else {
          if (isContentEmpty(node.content)) continue
          const html = docToHtml(node.content)
          if (!html.trim()) continue
          out.push({
            key: `d-${node.id}`,
            kind: 'document',
            title: node.title,
            html,
          })
        }
      }
    }

    walk(null)
    return out
  }, [documents])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col"
      style={{ backgroundColor: 'var(--background)' }}
      role="dialog"
      aria-modal
      aria-label="읽기 모드"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <div className="min-w-0 truncate text-sm font-medium text-[var(--foreground)]">
          {projectTitle || '프로젝트'}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          aria-label="닫기"
        >
          <X className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      </header>
      <div
        className="min-h-0 flex-1 overflow-auto font-writing text-[var(--foreground)]"
        style={{ lineHeight: 1.8 }}
      >
        <div
          className="[&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_li]:my-1 [&_ol]:my-2 [&_p]:my-2 [&_ul]:my-2"
          style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px' }}
        >
          {sections.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">표시할 문서 내용이 없습니다.</p>
          ) : (
            sections.flatMap((s, i) => {
              const prev = sections[i - 1]
              const nodes: ReactNode[] = []
              if (s.kind === 'document' && prev?.kind === 'document') {
                nodes.push(
                  <hr
                    key={`sep-${prev.key}-${s.key}`}
                    style={{
                      margin: '24px 0',
                      border: 0,
                      borderTop: '1px solid var(--border)',
                    }}
                  />
                )
              }
              if (s.kind === 'folder') {
                nodes.push(
                  <h2
                    key={s.key}
                    className="text-[var(--foreground)]"
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      marginTop: i === 0 ? 0 : 48,
                    }}
                  >
                    {s.title}
                  </h2>
                )
              } else {
                nodes.push(
                  <div key={s.key}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: 'var(--foreground)',
                        marginBottom: 16,
                      }}
                    >
                      {s.title}
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: s.html ?? '' }} />
                  </div>
                )
              }
              return nodes
            })
          )}
        </div>
      </div>
    </div>
  )
}
