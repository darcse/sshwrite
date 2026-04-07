'use client'

import type { Editor } from '@tiptap/core'

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  const btn = (active: boolean) =>
    ({
      backgroundColor: active ? 'var(--badge-bg)' : 'transparent',
      color: active ? 'var(--foreground)' : 'var(--muted)',
      borderRadius: 4,
      padding: '4px 6px',
      fontSize: 12,
      fontWeight: 600,
      lineHeight: '16px',
    }) as const

  const sep = (
    <span
      aria-hidden
      className="mx-1 inline-block w-px"
      style={{ height: 16, backgroundColor: 'var(--border)' }}
    />
  )

  return (
    <div
      className="flex w-full flex-wrap items-center gap-1 shrink-0 border-b px-2 py-2"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--border)',
      }}
    >
      <button
        type="button"
        style={btn(editor.isActive('bold'))}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </button>
      <button
        type="button"
        style={btn(editor.isActive('italic'))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </button>
      <button
        type="button"
        style={btn(editor.isActive('strike'))}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        S
      </button>
      {sep}
      <button
        type="button"
        style={btn(editor.isActive('heading', { level: 1 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </button>
      <button
        type="button"
        style={btn(editor.isActive('heading', { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </button>
      <button
        type="button"
        style={btn(editor.isActive('heading', { level: 3 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </button>
      {sep}
      <button
        type="button"
        style={btn(editor.isActive('bulletList'))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </button>
      <button
        type="button"
        style={btn(editor.isActive('orderedList'))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </button>
      {sep}
      <button
        type="button"
        style={btn(editor.isActive('blockquote'))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        &gt;
      </button>
      <button
        type="button"
        style={btn(editor.isActive('code'))}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        {'</>'}
      </button>
      <button
        type="button"
        style={btn(false)}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        —
      </button>
    </div>
  )
}
