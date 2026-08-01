import type { StateCreator } from 'zustand'
import { createId } from '@/core/id'
import type { Item, SelectionRef } from '@/model/types'
import type { ClipboardSlice, EditorStore } from './types'

const PASTE_OFFSET = 12

export const createClipboardSlice: StateCreator<EditorStore, [], [], ClipboardSlice> = (
  set,
  get,
) => ({
  clipboard: null,

  copySelection: () => {
    const { plan, selection } = get()
    const ids = new Set(selection.filter((ref) => ref.kind === 'item').map((ref) => ref.id))
    const items = plan.items.filter((item) => ids.has(item.id))
    if (items.length > 0) set({ clipboard: { items: structuredClone(items) } })
  },

  cut: () => {
    get().copySelection()
    get().deleteEntities(get().selection)
  },

  paste: () => {
    const { clipboard, commit } = get()
    if (!clipboard || clipboard.items.length === 0) return
    const copies: Item[] = clipboard.items.map((item) => ({
      ...structuredClone(item),
      id: createId('item'),
      center: { x: item.center.x + PASTE_OFFSET, y: item.center.y + PASTE_OFFSET },
    }))
    commit((plan) => void plan.items.push(...copies))
    // Keep pasting repeatedly walking down-right instead of stacking.
    set({
      clipboard: { items: copies.map((item) => structuredClone(item)) },
      selection: copies.map((item): SelectionRef => ({ kind: 'item', id: item.id })),
      tool: 'select',
    })
  },
})
