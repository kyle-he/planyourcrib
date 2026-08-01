import { useEffect } from 'react'
import { planBounds } from '@/model/derive'
import { useEditorStore } from '@/state/store'
import type { ToolId } from '@/state/types'

const TOOL_KEYS: Record<string, ToolId> = {
  s: 'select',
  '1': 'select',
  r: 'room',
  '2': 'room',
  m: 'measure',
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

export interface ShortcutCallbacks {
  onToggleShortcuts: () => void
}

/**
 * Global keyboard map. Everything routes through store actions so shortcuts and
 * UI buttons always behave identically.
 */
export function useKeyboardShortcuts({ onToggleShortcuts }: ShortcutCallbacks): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const store = useEditorStore.getState()
      const mod = event.metaKey || event.ctrlKey
      const key = event.key
      const lower = key.toLowerCase()
      const step = store.settings.snapToGrid ? store.settings.gridStep : 1

      // --- editing ---------------------------------------------------------
      if (mod && lower === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (mod && lower === 'y') {
        event.preventDefault()
        store.redo()
        return
      }
      if (mod && lower === 'a') {
        event.preventDefault()
        store.selectAll()
        return
      }
      if (mod && lower === 'c') {
        store.copySelection()
        return
      }
      if (mod && lower === 'x') {
        store.cut()
        return
      }
      if (mod && lower === 'v') {
        store.paste()
        return
      }
      if (mod && lower === 'd') {
        event.preventDefault()
        const copies = store.duplicateEntities(store.selection, { x: step * 2, y: step * 2 })
        if (copies.length > 0) store.setSelection(copies)
        return
      }

      // --- view ------------------------------------------------------------
      if (mod && (key === '=' || key === '+')) {
        event.preventDefault()
        store.setZoom(store.viewport.scale * 1.25)
        return
      }
      if (mod && key === '-') {
        event.preventDefault()
        store.setZoom(store.viewport.scale / 1.25)
        return
      }
      if (mod && key === '0') {
        event.preventDefault()
        store.resetView()
        return
      }
      if (!mod && lower === 'f') {
        const bounds = planBounds(store.plan)
        if (bounds) store.fitToRect(bounds)
        return
      }
      if (mod) return // leave every other browser shortcut alone

      // --- selection -------------------------------------------------------
      if (key === 'Delete' || key === 'Backspace') {
        event.preventDefault()
        store.deleteEntities(store.selection)
        return
      }
      if (key === 'Escape') {
        if (store.tool !== 'select') store.setTool('select')
        else store.clearSelection()
        return
      }
      if (key.startsWith('Arrow')) {
        event.preventDefault()
        const amount = event.altKey ? 1 : event.shiftKey ? step * 10 : step
        const delta = {
          ArrowLeft: { x: -amount, y: 0 },
          ArrowRight: { x: amount, y: 0 },
          ArrowUp: { x: 0, y: -amount },
          ArrowDown: { x: 0, y: amount },
        }[key]
        if (delta) store.translateEntities(store.selection, delta)
        return
      }
      if (lower === 'q' || lower === 'e') {
        store.rotateEntities(store.selection, lower === 'q' ? -90 : 90)
        return
      }
      if (key === '[' || key === ']') {
        for (const ref of store.selection) {
          if (ref.kind === 'item') store.reorderItem(ref.id, key === '[' ? 'back' : 'front')
        }
        return
      }

      // --- tools & toggles -------------------------------------------------
      if (lower === 'd') {
        store.startPlacingOpening('door')
        return
      }
      if (lower === 'w') {
        store.startPlacingOpening('window')
        return
      }
      if (lower === 'g') {
        store.updateSettings(
          event.shiftKey
            ? { snapToGrid: !store.settings.snapToGrid }
            : { showGrid: !store.settings.showGrid },
        )
        return
      }
      if (key === '?' || (key === '/' && event.shiftKey)) {
        event.preventDefault()
        onToggleShortcuts()
        return
      }
      const tool = TOOL_KEYS[lower]
      if (tool) {
        store.setTool(tool)
        // Tool shortcuts act directly on the canvas. Clear focus from any
        // previously clicked tool button so its focus ring is not left behind.
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onToggleShortcuts])
}
