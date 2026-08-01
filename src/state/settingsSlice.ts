import type { StateCreator } from 'zustand'
import { clamp } from '@/core/geometry'
import { defaultGridStep } from '@/core/units'
import { DEFAULT_SETTINGS } from '@/model/factory'
import type { EditorStore, SettingsSlice } from './types'

export const createSettingsSlice: StateCreator<EditorStore, [], [], SettingsSlice> = (set, get) => ({
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

  setWallThickness: (wallThickness) => {
    const next = clamp(wallThickness, 1, 24)
    get().commit((plan) => {
      for (const room of plan.rooms) room.wallThickness = next
    })
    set((state) => ({ settings: { ...state.settings, wallThickness: next } }))
  },
})
