import type { StateCreator } from 'zustand'
import type { SelectionRef } from '@/model/types'
import type { EditorStore, SelectionSlice } from './types'

const sameRef = (a: SelectionRef, b: SelectionRef) => a.kind === b.kind && a.id === b.id

export const createSelectionSlice: StateCreator<EditorStore, [], [], SelectionSlice> = (
  set,
  get,
) => ({
  selection: [],
  hover: null,
  selectedVertex: null,
  editingRoomId: null,

  select: (ref, additive = false) => {
    if (!ref) {
      set({ selection: [], selectedVertex: null, editingRoomId: null })
      return
    }
    if (additive) {
      get().toggleSelection(ref)
      return
    }
    set({ selection: [ref], selectedVertex: null, editingRoomId: null })
  },

  setSelection: (refs) => set({ selection: [...refs], selectedVertex: null }),

  toggleSelection: (ref) => {
    const { selection } = get()
    const exists = selection.some((candidate) => sameRef(candidate, ref))
    set({
      selection: exists
        ? selection.filter((candidate) => !sameRef(candidate, ref))
        : [...selection, ref],
      selectedVertex: null,
    })
  },

  clearSelection: () => set({ selection: [], selectedVertex: null, editingRoomId: null }),

  selectAll: () => {
    const { plan } = get()
    set({
      selection: [
        ...plan.rooms.map((room): SelectionRef => ({ kind: 'room', id: room.id })),
        ...plan.walls.map((wall): SelectionRef => ({ kind: 'wall', id: wall.id })),
        ...plan.items.map((item): SelectionRef => ({ kind: 'item', id: item.id })),
      ],
      selectedVertex: null,
    })
  },

  setHover: (ref) => {
    const current = get().hover
    if (current === ref || (current && ref && sameRef(current, ref))) return
    set({ hover: ref })
  },

  // Vertices are selected independently: selecting one clears any room, item,
  // or opening selection rather than treating it as a room sub-selection.
  selectVertex: (roomId, index) =>
    set({ selection: [], selectedVertex: { roomId, index }, editingRoomId: null }),

  setEditingRoom: (id) => set({ editingRoomId: id }),
})
