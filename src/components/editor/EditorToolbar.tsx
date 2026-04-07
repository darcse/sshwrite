'use client'

import type { Editor } from '@tiptap/core'

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  const btn = (active: boolean) =>
    ({
      borderWidth: 1,
      borderStyle: 'solid' as const,
      borderColor: 'var(--border-color)',
      backgroundColor: active ? 'var(--accent-color)' : 'var(--card-bg)',
      color: active ? '#fff' : 'var(--foreground)',
      borderRadius: 6,
      padding: '4px 8px',
      fontSize: 12,
      fontWeight: 600,
    })

  return (
    <div
      className="flex flex-wrap gap-1 border-b pb-2 mb-2 shrink-0"
      style={{ borderColor: 'var(--border-color)' }}
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
    </div>
  )
}
