import type { StateCreator } from 'zustand'
import { defaultGridStep } from '@/core/units'
import { DEFAULT_SETTINGS } from '@/model/factory'
import type { EditorStore, SettingsSlice } from './types'

export const createSettingsSlice: StateCreator<EditorStore, [], [], SettingsSlice> = (set) => ({
  settings: DEFAULT_SETTINGS,

  updateSettings: (patch) =>
    set((state) => {
      const settings = { ...state.settings, ...patch }
      // Switching unit systems should also move the grid to a sane step.
      if (patch.unit && patch.unit !== state.settings.unit && patch.gridStep === undefined) {
        settings.gridStep = defaultGridStep(patch.unit)
      }
      return { settings }
    }),
})
