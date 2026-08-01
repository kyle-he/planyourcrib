import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEFAULT_WALL_THICKNESS } from '@/model/factory'
import { createClipboardSlice } from './clipboardSlice'
import { createPlanSlice } from './planSlice'
import { createSelectionSlice } from './selectionSlice'
import { createSettingsSlice } from './settingsSlice'
import { createToolSlice } from './toolSlice'
import { createViewportSlice } from './viewportSlice'
import type { EditorStore } from './types'

const STORAGE_KEY = 'roomplanner:document'

export const useEditorStore = create<EditorStore>()(
  persist(
    (...args) => ({
      ...createPlanSlice(...args),
      ...createSelectionSlice(...args),
      ...createToolSlice(...args),
      ...createViewportSlice(...args),
      ...createSettingsSlice(...args),
      ...createClipboardSlice(...args),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Only the document and preferences survive a reload; transient editor
      // state (selection, tool, history, viewport) always starts fresh.
      partialize: (state) => ({ plan: state.plan, settings: state.settings }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<Pick<EditorStore, 'plan' | 'settings'>>
        const wallThickness = persisted.settings?.wallThickness ??
          persisted.plan?.rooms[0]?.wallThickness ?? DEFAULT_WALL_THICKNESS
        const plan = persisted.plan
          ? {
              ...persisted.plan,
              rooms: persisted.plan.rooms.map((room) => ({ ...room, wallThickness })),
            }
          : currentState.plan
        return {
          ...currentState,
          ...persisted,
          plan,
          settings: { ...currentState.settings, ...persisted.settings, wallThickness },
        }
      },
    },
  ),
)

/** Imperative access for non-React callers (keyboard handlers, DOM events). */
export const editorStore = useEditorStore

// Handy for poking at the document from the devtools console.
if (import.meta.env.DEV) {
  Object.assign(globalThis, { __roomPlannerStore: useEditorStore })
}
