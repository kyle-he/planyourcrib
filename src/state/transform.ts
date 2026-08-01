import type { Rect, Vec2 } from '@/core/geometry'
import type { Viewport } from './types'

export const worldToScreen = (viewport: Viewport, point: Vec2): Vec2 => ({
  x: point.x * viewport.scale + viewport.x,
  y: point.y * viewport.scale + viewport.y,
})

export const screenToWorld = (viewport: Viewport, point: Vec2): Vec2 => ({
  x: (point.x - viewport.x) / viewport.scale,
  y: (point.y - viewport.y) / viewport.scale,
})

/** Convert a pixel distance to inches at the current zoom. */
export const pixelsToInches = (viewport: Viewport, pixels: number): number =>
  pixels / viewport.scale

/** World-space rectangle currently visible, useful for culling. */
export function visibleWorldRect(viewport: Viewport): Rect {
  const topLeft = screenToWorld(viewport, { x: 0, y: 0 })
  const bottomRight = screenToWorld(viewport, { x: viewport.width, y: viewport.height })
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  }
}
