import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const TypewriterScrollExtension = Extension.create({
  name: 'typewriterScroll',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('typewriterScroll'),
        view: (view) => {
          let latestView = view

          const scrollToCursor = () => {
            const scrollContainer = document.querySelector('[data-typewriter-scroll]')
            if (!scrollContainer) return
            const { from } = latestView.state.selection
            const coords = latestView.coordsAtPos(from)
            const containerRect = scrollContainer.getBoundingClientRect()
            const delta = coords.top - (containerRect.top + containerRect.height / 2)
            if (Math.abs(delta) < 6) return
            scrollContainer.scrollTop += delta
          }

          document.addEventListener('typewriter-activate', scrollToCursor)

          return {
            update: (updatedView, prevState) => {
              latestView = updatedView
              const state = updatedView.state
              if (
                prevState &&
                prevState.doc.eq(state.doc) &&
                prevState.selection.eq(state.selection)
              ) return
              requestAnimationFrame(scrollToCursor)
            },
            destroy: () => {
              document.removeEventListener('typewriter-activate', scrollToCursor)
            },
          }
        },
      }),
    ]
  },
})
