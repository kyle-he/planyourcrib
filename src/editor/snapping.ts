/**
 * Snapping. All snap logic lives here so interactions stay declarative: they
 * describe *what* is moving (a set of anchor points) and get back an adjusted
 * delta plus the guides to draw.
 */
import {
  add,
  closestPointOnSegment,
  distance,
  distanceToSegment,
  normalize,
  polygonBounds,
  roundTo,
  scale,
  sub,
  type Rect,
  type Vec2,
} from '@/core/geometry'
import { itemCorners, roomEdges, roomOuterRing } from '@/model/derive'
import type { Plan, Settings } from '@/model/types'

export interface AxisSnapGuide {
  axis: 'x' | 'y'
  /** World coordinate of the guide line. */
  position: number
  /** World extent along the other axis, used to keep guides short. */
  from: number
  to: number
}

export interface SegmentSnapGuide {
  axis: 'segment'
  a: Vec2
  b: Vec2
}

export type SnapGuide = AxisSnapGuide | SegmentSnapGuide

export interface SnapResult {
  delta: Vec2
  guides: SnapGuide[]
}

export interface WallSnapSegment {
  id: string
  a: Vec2
  b: Vec2
  direction: Vec2
}

export interface WallSegmentSnap extends SnapResult {
  segment: WallSnapSegment
}

export interface NearbyWallSegment {
  segment: WallSnapSegment
  distance: number
}

export interface SnapContext {
  plan: Plan
  settings: Settings
  /** Pixels-per-inch, so tolerance is constant on screen. */
  scale: number
  /** Ids excluded from object snapping (the things being dragged). */
  exclude?: ReadonlySet<string>
}

const TOLERANCE_PX = 7

interface AxisCandidates {
  x: number[]
  y: number[]
}

/** Alignment lines contributed by everything the user is *not* dragging. */
export function collectSnapTargets(context: SnapContext): AxisCandidates {
  const { plan, exclude } = context
  const x: number[] = []
  const y: number[] = []

  const pushRect = (rect: Rect) => {
    x.push(rect.x, rect.x + rect.width / 2, rect.x + rect.width)
    y.push(rect.y, rect.y + rect.height / 2, rect.y + rect.height)
  }

  for (const room of plan.rooms) {
    if (exclude?.has(room.id)) continue
    // Both faces of every wall are useful snap lines.
    pushRect(polygonBounds(room.points))
    pushRect(polygonBounds(roomOuterRing(room)))
    for (const point of room.points) {
      x.push(point.x)
      y.push(point.y)
    }
  }
  for (const item of plan.items) {
    if (exclude?.has(item.id)) continue
    pushRect(polygonBounds(itemCorners(item)))
  }
  return { x, y }
}

interface AxisSnap {
  delta: number
  target: number | null
}

function snapAxis(
  anchors: readonly number[],
  targets: readonly number[],
  proposedDelta: number,
  tolerance: number,
): AxisSnap {
  let best: AxisSnap = { delta: proposedDelta, target: null }
  let bestError = tolerance
  for (const anchor of anchors) {
    const moved = anchor + proposedDelta
    for (const target of targets) {
      const error = Math.abs(target - moved)
      if (error < bestError) {
        bestError = error
        best = { delta: proposedDelta + (target - moved), target }
      }
    }
  }
  return best
}

export interface MoveSnapInput extends SnapContext {
  /** Points that should prefer landing on nice values (usually AABB corners). */
  anchors: readonly Vec2[]
  /** Raw pointer delta before snapping. */
  delta: Vec2
  /** World-space extent of the dragged shape, for drawing guides. */
  bounds: Rect | null
}

export function snapMove({
  anchors,
  delta,
  bounds,
  ...context
}: MoveSnapInput): SnapResult {
  const { settings, scale } = context
  const tolerance = TOLERANCE_PX / scale
  const guides: SnapGuide[] = []
  const result: Vec2 = { ...delta }

  if (settings.snapToObjects && anchors.length > 0) {
    const targets = collectSnapTargets(context)
    const xs = anchors.map((point) => point.x)
    const ys = anchors.map((point) => point.y)
    const snapX = snapAxis(xs, targets.x, delta.x, tolerance)
    const snapY = snapAxis(ys, targets.y, delta.y, tolerance)
    result.x = snapX.delta
    result.y = snapY.delta
    if (snapX.target !== null && bounds) {
      guides.push({
        axis: 'x',
        position: snapX.target,
        from: bounds.y + result.y - 40,
        to: bounds.y + bounds.height + result.y + 40,
      })
    }
    if (snapY.target !== null && bounds) {
      guides.push({
        axis: 'y',
        position: snapY.target,
        from: bounds.x + result.x - 40,
        to: bounds.x + bounds.width + result.x + 40,
      })
    }
  }

  if (settings.snapToGrid) {
    const anchor = anchors[0]
    if (anchor) {
      const step = settings.gridStep
      if (guides.every((guide) => guide.axis !== 'x')) {
        result.x = roundTo(anchor.x + result.x, step) - anchor.x
      }
      if (guides.every((guide) => guide.axis !== 'y')) {
        result.y = roundTo(anchor.y + result.y, step) - anchor.y
      }
    }
  }

  return { delta: result, guides }
}

/** Snap a single free point (vertex dragging, room drawing, measuring). */
export function snapPoint(point: Vec2, context: SnapContext): SnapResult {
  const { settings, scale } = context
  const tolerance = TOLERANCE_PX / scale
  const guides: SnapGuide[] = []
  const snapped: Vec2 = { ...point }

  if (settings.snapToObjects) {
    const targets = collectSnapTargets(context)
    const snapX = snapAxis([point.x], targets.x, 0, tolerance)
    const snapY = snapAxis([point.y], targets.y, 0, tolerance)
    snapped.x = point.x + snapX.delta
    snapped.y = point.y + snapY.delta
    if (snapX.target !== null) {
      guides.push({ axis: 'x', position: snapX.target, from: point.y - 60, to: point.y + 60 })
    }
    if (snapY.target !== null) {
      guides.push({ axis: 'y', position: snapY.target, from: point.x - 60, to: point.x + 60 })
    }
  }

  if (settings.snapToGrid) {
    if (guides.every((guide) => guide.axis !== 'x')) snapped.x = roundTo(snapped.x, settings.gridStep)
    if (guides.every((guide) => guide.axis !== 'y')) snapped.y = roundTo(snapped.y, settings.gridStep)
  }

  return { delta: snapped, guides }
}

/**
 * Attach a point to the nearest wall centreline. Freestanding walls and room
 * walls participate, so dividers can join each other or continue from a room.
 */
export function snapPointToWallSegments(
  point: Vec2,
  context: SnapContext,
  tolerancePx = TOLERANCE_PX,
  respectMovementSnapping = true,
): WallSegmentSnap | null {
  if (respectMovementSnapping && !context.settings.snapToObjects) return null

  const tolerance = tolerancePx / context.scale
  let bestDistance = tolerance
  let best: { point: Vec2; segment: WallSnapSegment } | null = null

  const consider = (segment: WallSnapSegment) => {
    const { a, b } = segment
    const projected = closestPointOnSegment(point, a, b)
    const gap = distance(point, projected)
    if (gap >= bestDistance) return
    bestDistance = gap
    best = { point: projected, segment }
  }

  for (const segment of collectWallSnapSegments(context)) consider(segment)

  const result = best as { point: Vec2; segment: WallSnapSegment } | null
  return result
    ? {
        delta: result.point,
        guides: [{ axis: 'segment', a: result.segment.a, b: result.segment.b }],
        segment: result.segment,
      }
    : null
}

/** Find the closest wall to a small set of points, using a screen-space range. */
export function findNearbyWallSegment(
  points: readonly Vec2[],
  context: SnapContext,
  tolerancePx: number,
  respectMovementSnapping = true,
): NearbyWallSegment | null {
  if ((respectMovementSnapping && !context.settings.snapToObjects) || points.length === 0) return null
  let bestDistance = tolerancePx / context.scale
  let best: WallSnapSegment | null = null

  for (const segment of collectWallSnapSegments(context)) {
    for (const point of points) {
      const gap = distanceToSegment(point, segment.a, segment.b)
      if (gap >= bestDistance) continue
      bestDistance = gap
      best = segment
    }
  }

  return best ? { segment: best, distance: bestDistance } : null
}

function collectWallSnapSegments(context: SnapContext): WallSnapSegment[] {
  const result: WallSnapSegment[] = []
  for (const wall of context.plan.walls) {
    if (context.exclude?.has(wall.id)) continue
    result.push({
      id: wall.id,
      a: wall.a,
      b: wall.b,
      direction: normalize(sub(wall.b, wall.a)),
    })
  }

  for (const room of context.plan.rooms) {
    if (context.exclude?.has(room.id)) continue
    for (const edge of roomEdges(room)) {
      const offset = scale(edge.normal, room.wallThickness / 2)
      const a = add(edge.a, offset)
      const b = add(edge.b, offset)
      result.push({
        id: `room:${room.id}:${edge.index}`,
        a,
        b,
        direction: normalize(sub(b, a)),
      })
    }
  }
  return result
}

/**
 * Project a room vertex onto the nearest visible wall face. Testing the inner
 * and outer faces makes this useful both inside an existing room and when
 * joining a new room to its exterior, including at arbitrary angles.
 */
export function snapVertexToWalls(
  point: Vec2,
  context: SnapContext,
): SnapResult | null {
  if (!context.settings.snapToObjects) return null

  const tolerance = TOLERANCE_PX / context.scale
  let bestDistance = tolerance
  let best: { point: Vec2; a: Vec2; b: Vec2 } | null = null

  for (const room of context.plan.rooms) {
    if (context.exclude?.has(room.id)) continue
    for (const edge of roomEdges(room)) {
      for (const [a, b] of [[edge.a, edge.b], [edge.outerA, edge.outerB]] as const) {
        const projected = closestPointOnSegment(point, a, b)
        const gap = distance(point, projected)
        if (gap < bestDistance) {
          bestDistance = gap
          best = { point: projected, a, b }
        }
      }
    }
  }

  return best
    ? { delta: best.point, guides: [{ axis: 'segment', a: best.a, b: best.b }] }
    : null
}

/** Place a newly dropped item so its top-left corner lands on the grid. */
export function placementCenter(
  world: Vec2,
  width: number,
  depth: number,
  context: SnapContext,
): Vec2 {
  const corner = snapPoint({ x: world.x - width / 2, y: world.y - depth / 2 }, context).delta
  return { x: corner.x + width / 2, y: corner.y + depth / 2 }
}

/** Snap a scalar (a length or an offset along a wall) to the grid. */
export function snapScalar(value: number, settings: Settings): number {
  return settings.snapToGrid ? roundTo(value, settings.gridStep) : value
}
