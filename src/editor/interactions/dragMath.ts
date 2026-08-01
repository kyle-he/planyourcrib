import {
  add,
  clamp,
  distanceToSegment,
  dot,
  projectOnSegment,
  roundTo,
  rotate,
  toLocalSpace,
  toRadians,
  type Vec2,
} from '@/core/geometry'
import { allWalls, maxOpeningOffset, type WallRef } from '@/model/derive'
import type { Item, Plan, Settings } from '@/model/types'
import type { RoomEdgeRef } from '@/model/wallTopology'
import type { ResizeHandle } from './types'

export const MIN_ITEM_SIZE = 4

export interface ItemBoxSnapshot {
  center: Vec2
  width: number
  depth: number
  rotation: number
}

export interface ResizeOptions {
  /** Resize around the centre instead of the opposite edge. */
  symmetric: boolean
  /** Preserve the original aspect ratio. */
  keepAspect: boolean
  snapStep: number
}

/**
 * Resize a rotated box by dragging one handle. Everything is computed in the
 * box's local frame, then the centre is moved back out to world space so the
 * un-dragged edges stay put.
 */
export function resizeItemBox(
  start: ItemBoxSnapshot,
  handle: ResizeHandle,
  pointerWorld: Vec2,
  { symmetric, keepAspect, snapStep }: ResizeOptions,
): ItemBoxSnapshot {
  const local = toLocalSpace(pointerWorld, start.center, start.rotation)
  const halfWidth = start.width / 2
  const halfDepth = start.depth / 2

  const movesEast = handle.includes('e')
  const movesWest = handle.includes('w')
  const movesNorth = handle.includes('n')
  const movesSouth = handle.includes('s')

  let width = start.width
  let depth = start.depth
  let shiftX = 0
  let shiftY = 0

  const applyAxis = (
    pointer: number,
    half: number,
    positiveSide: boolean,
  ): { size: number; shift: number } => {
    if (symmetric) return { size: Math.abs(pointer) * 2, shift: 0 }
    const fixedEdge = positiveSide ? -half : half
    const size = Math.abs(pointer - fixedEdge)
    const newCenter = (pointer + fixedEdge) / 2
    return { size, shift: newCenter }
  }

  if (movesEast || movesWest) {
    const result = applyAxis(local.x, halfWidth, movesEast)
    width = result.size
    shiftX = result.shift
  }
  if (movesNorth || movesSouth) {
    const result = applyAxis(local.y, halfDepth, movesSouth)
    depth = result.size
    shiftY = result.shift
  }

  if (snapStep > 0) {
    if (movesEast || movesWest) width = roundTo(width, snapStep)
    if (movesNorth || movesSouth) depth = roundTo(depth, snapStep)
  }

  if (keepAspect && start.width > 0 && start.depth > 0) {
    const ratio = start.depth / start.width
    if (movesEast || movesWest) depth = width * ratio
    else if (movesNorth || movesSouth) width = depth / ratio
  }

  width = Math.max(MIN_ITEM_SIZE, width)
  depth = Math.max(MIN_ITEM_SIZE, depth)

  if (!symmetric) {
    // Recompute the shift from the snapped size so the fixed edge stays exact.
    if (movesEast) shiftX = width / 2 - halfWidth
    if (movesWest) shiftX = halfWidth - width / 2
    if (movesSouth) shiftY = depth / 2 - halfDepth
    if (movesNorth) shiftY = halfDepth - depth / 2
  }

  const center = add(
    start.center,
    rotate({ x: shiftX, y: shiftY }, toRadians(start.rotation)),
  )
  return { center, width, depth, rotation: start.rotation }
}

export interface WallHit {
  wall: WallRef
  /** Distance along the wall of the projected point. */
  offset: number
  distance: number
}

/** Closest wall centerline to a world point, within `maxDistance` inches. */
export function findNearestWall(
  plan: Plan,
  point: Vec2,
  maxDistance = Infinity,
  preferred?: RoomEdgeRef,
): WallHit | null {
  let best: WallHit | null = null
  for (const wall of allWalls(plan)) {
    if (wall.length < 1) continue
    const gap = distanceToSegment(point, wall.a, wall.b)
    if (gap > maxDistance) continue
    const isPreferred =
      preferred?.roomId === wall.roomId && preferred.edgeIndex === wall.index
    const bestIsPreferred =
      preferred?.roomId === best?.wall.roomId && preferred?.edgeIndex === best?.wall.index
    if (
      !best ||
      gap < best.distance - 1e-6 ||
      (Math.abs(gap - best.distance) <= 1e-6 && isPreferred && !bestIsPreferred)
    ) {
      best = { wall, offset: projectOnSegment(point, wall.a, wall.b) * wall.length, distance: gap }
    }
  }
  return best
}

/** Where an opening of `width` should sit when dropped at `point`. */
export function resolveOpeningPlacement(
  plan: Plan,
  point: Vec2,
  width: number,
  settings: Settings,
  maxDistance = Infinity,
  preferred?: RoomEdgeRef,
): { roomId: string; edgeIndex: number; offset: number } | null {
  const hit = findNearestWall(plan, point, maxDistance, preferred)
  if (!hit) return null
  const { wall } = hit
  const axisAligned = Math.abs(wall.direction.x) < 1e-6 || Math.abs(wall.direction.y) < 1e-6
  let offset = hit.offset
  if (settings.snapToGrid && axisAligned) {
    // Snap in world space so the opening lines up with the grid, not the wall start.
    const worldAlong = dot(wall.a, wall.direction) + offset
    offset = roundTo(worldAlong, settings.gridStep) - dot(wall.a, wall.direction)
  }
  const usableWidth = Math.min(width, Math.max(wall.length - 2, 8))
  return {
    roomId: wall.roomId,
    edgeIndex: wall.index,
    offset: clamp(offset, usableWidth / 2, maxOpeningOffset(wall.length, usableWidth)),
  }
}

/** Axis-lock a drag delta to the dominant axis (shift-drag). */
export function lockAxis(delta: Vec2): Vec2 {
  return Math.abs(delta.x) >= Math.abs(delta.y) ? { x: delta.x, y: 0 } : { x: 0, y: delta.y }
}

export function itemSnapshot(item: Item): ItemBoxSnapshot {
  return { center: item.center, width: item.width, depth: item.depth, rotation: item.rotation }
}

/** Signed distance a wall drag should move an edge along its own normal. */
export function wallPushDistance(delta: Vec2, normal: Vec2): number {
  return dot(delta, normal)
}
