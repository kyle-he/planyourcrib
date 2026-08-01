import type { StateCreator } from 'zustand'
import { clamp } from '@/core/geometry'
import type { EditorStore, Viewport, ViewportSlice } from './types'

export const MIN_SCALE = 0.1
export const MAX_SCALE = 16
const DEFAULT_SCALE = 2.2

export const INITIAL_VIEWPORT: Viewport = {
  scale: DEFAULT_SCALE,
  x: 120,
  y: 120,
  width: 1,
  height: 1,
}

export const createViewportSlice: StateCreator<EditorStore, [], [], ViewportSlice> = (
  set,
  get,
) => ({
  viewport: INITIAL_VIEWPORT,

  // Resizing the canvas must never be interpreted as a pan. In particular,
  // opening or closing the library only changes the available dimensions;
  // the plan's translation and zoom stay exactly where the user left them.
  setViewportSize: (width, height) =>
    set((state) => ({ viewport: { ...state.viewport, width, height } })),

  panBy: (dx, dy) =>
    set((state) => ({
      viewport: { ...state.viewport, x: state.viewport.x + dx, y: state.viewport.y + dy },
    })),

  zoomAt: (screenPoint, factor) =>
    set((state) => {
      const { viewport } = state
      const scale = clamp(viewport.scale * factor, MIN_SCALE, MAX_SCALE)
      if (scale === viewport.scale) return {}
      const worldX = (screenPoint.x - viewport.x) / viewport.scale
      const worldY = (screenPoint.y - viewport.y) / viewport.scale
      return {
        viewport: {
          ...viewport,
          scale,
          x: screenPoint.x - worldX * scale,
          y: screenPoint.y - worldY * scale,
        },
      }
    }),

  setZoom: (scale) => {
    const { viewport, zoomAt } = get()
    zoomAt(
      { x: viewport.width / 2, y: viewport.height / 2 },
      clamp(scale, MIN_SCALE, MAX_SCALE) / viewport.scale,
    )
  },

  fitToRect: (rect, padding = 80) =>
    set((state) => {
      const { width, height } = state.viewport
      if (width <= 1 || height <= 1) return {}
      const usableWidth = Math.max(1, width - padding * 2)
      const usableHeight = Math.max(1, height - padding * 2)
      const scale = clamp(
        Math.min(usableWidth / Math.max(rect.width, 1), usableHeight / Math.max(rect.height, 1)),
        MIN_SCALE,
        MAX_SCALE,
      )
      return {
        viewport: {
          ...state.viewport,
          scale,
          x: width / 2 - (rect.x + rect.width / 2) * scale,
          y: height / 2 - (rect.y + rect.height / 2) * scale,
        },
      }
    }),

  resetView: () =>
    set((state) => ({
      viewport: {
        ...state.viewport,
        scale: DEFAULT_SCALE,
        x: state.viewport.width / 2 - 100,
        y: state.viewport.height / 2 - 100,
      },
    })),
})
