import type { StateCreator } from 'zustand'
import type { EditorStore, ToolSlice } from './types'

export const createToolSlice: StateCreator<EditorStore, [], [], ToolSlice> = (set) => ({
  tool: 'select',
  openingKind: 'door',
  itemTemplate: null,

  setTool: (tool) =>
    set((state) => ({
      tool,
      itemTemplate: tool === 'item' ? state.itemTemplate : null,
      selection: tool === 'select' ? state.selection : [],
    })),

  startPlacingItem: (template) => set({ tool: 'item', itemTemplate: template, selection: [] }),
  startPlacingOpening: (kind) => set({ tool: 'opening', openingKind: kind, selection: [] }),
})
