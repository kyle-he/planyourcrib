import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
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
    },
  ),
)

/** Imperative access for non-React callers (keyboard handlers, DOM events). */
export const editorStore = useEditorStore

// Handy for poking at the document from the devtools console.
if (import.meta.env.DEV) {
  Object.assign(globalThis, { __roomPlannerStore: useEditorStore })
}
