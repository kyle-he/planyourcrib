/**
 * Derived geometry for the document model. Everything here is a pure function
 * of the plan, which keeps the store free of cached/denormalised state.
 */
import {
  add,
  distance,
  dot,
  edgeNormal,
  ensureCounterClockwise,
  midpoint,
  normalize,
  offsetPolygon,
  orientedBoxCorners,
  polygonArea,
  polygonBounds,
  polygonCentroid,
  scale,
  sub,
  toDegrees,
  unionRects,
  type Rect,
  type Vec2,
} from '@/core/geometry'
import type { Item, Opening, Plan, Room, Wall } from './types'

export interface WallEdge {
  index: number
  /** Interior start/end corner. */
  a: Vec2
  b: Vec2
  /** Outer face start/end corner (interior offset outward by wall thickness). */
  outerA: Vec2
  outerB: Vec2
  length: number
  /** Unit vector a -> b. */
  direction: Vec2
  /** Unit normal pointing out of the room. */
  normal: Vec2
  angleDegrees: number
}

/** Interior ring with a canonical (counter-clockwise) winding. */
export function roomRing(room: Room): Vec2[] {
  return ensureCounterClockwise(room.points)
}

export function roomOuterRing(room: Room): Vec2[] {
  return offsetPolygon(room.points, room.wallThickness)
}

export function roomEdges(room: Room): WallEdge[] {
  const ring = roomRing(room)
  const outer = roomOuterRing(room)
  return ring.map((a, index) => {
    const b = ring[(index + 1) % ring.length]!
    const direction = normalize(sub(b, a))
    return {
      index,
      a,
      b,
      outerA: outer[index] ?? a,
      outerB: outer[(index + 1) % outer.length] ?? b,
      length: distance(a, b),
      direction,
      normal: edgeNormal(a, b),
      angleDegrees: toDegrees(Math.atan2(direction.y, direction.x)),
    }
  })
}

export function roomEdge(room: Room, index: number): WallEdge | undefined {
  return roomEdges(room)[index]
}

/**
 * Interior rectangle of a four-corner room, regardless of its rotation, or null
 * for any other shape. Lets the inspector offer plain width/height fields where
 * they make sense.
 */
export function roomRect(room: Room): Rect | null {
  if (room.points.length !== 4) return null
  const [a, b, c, d] = room.points
  if (!a || !b || !c || !d) return null

  const top = sub(b, a)
  const right = sub(c, b)
  const bottom = sub(d, c)
  const left = sub(a, d)
  const width = distance(a, b)
  const height = distance(b, c)
  if (width < 1e-6 || height < 1e-6) return null

  // This is constant-time: four dot products and two opposite-edge checks. The
  // relative tolerance absorbs harmless floating-point drift from dragging.
  const isRightAngle = (first: Vec2, second: Vec2) =>
    Math.abs(dot(first, second)) <= Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y) * 1e-4
  const oppositeEdgeTolerance = Math.max(0.001, Math.max(width, height) * 1e-5)
  const areOpposite = (first: Vec2, second: Vec2) =>
    Math.hypot(first.x + second.x, first.y + second.y) <= oppositeEdgeTolerance

  if (
    !isRightAngle(top, right) ||
    !isRightAngle(right, bottom) ||
    !isRightAngle(bottom, left) ||
    !isRightAngle(left, top) ||
    !areOpposite(top, bottom) ||
    !areOpposite(right, left)
  ) {
    return null
  }

  return { x: a.x, y: a.y, width, height }
}

export const roomArea = (room: Room): number => polygonArea(room.points)
export const roomCentroid = (room: Room): Vec2 => polygonCentroid(room.points)
export const roomBounds = (room: Room): Rect => polygonBounds(roomOuterRing(room))

/** Four corners of a freestanding wall band, centred on its stored segment. */
export function wallCorners(wall: Wall): Vec2[] {
  const direction = normalize(sub(wall.b, wall.a))
  const normal = { x: -direction.y, y: direction.x }
  const offset = scale(normal, wall.thickness / 2)
  return [add(wall.a, offset), add(wall.b, offset), sub(wall.b, offset), sub(wall.a, offset)]
}

export const wallLength = (wall: Wall): number => distance(wall.a, wall.b)
export const wallBounds = (wall: Wall): Rect => polygonBounds(wallCorners(wall))

/** Where an opening sits in world space, plus the frame used to draw it. */
export interface OpeningFrame {
  center: Vec2
  /** Along-wall unit vector. */
  tangent: Vec2
  /** Outward unit normal. */
  normal: Vec2
  angleDegrees: number
  width: number
  thickness: number
  /** Endpoints of the opening on the wall centerline. */
  start: Vec2
  end: Vec2
}

export function openingFrame(plan: Plan, opening: Opening): OpeningFrame | null {
  const room = findRoom(plan, opening.roomId)
  if (!room) return null
  const edge = roomEdge(room, opening.edgeIndex)
  if (!edge) return null

  const half = room.wallThickness / 2
  const centerlineA = add(edge.a, scale(edge.normal, half))
  const center = add(centerlineA, scale(edge.direction, opening.offset))
  const halfWidth = opening.width / 2
  return {
    center,
    tangent: edge.direction,
    normal: edge.normal,
    angleDegrees: edge.angleDegrees,
    width: opening.width,
    thickness: room.wallThickness,
    start: add(center, scale(edge.direction, -halfWidth)),
    end: add(center, scale(edge.direction, halfWidth)),
  }
}

/** Longest offset an opening of `width` may have on the given edge. */
export function maxOpeningOffset(edgeLength: number, width: number): number {
  return Math.max(width / 2, edgeLength - width / 2)
}

export function itemCorners(item: Item): Vec2[] {
  return orientedBoxCorners(item.center, item.width, item.depth, item.rotation)
}

export function itemBounds(item: Item): Rect {
  return polygonBounds(itemCorners(item))
}

export function openingBounds(plan: Plan, opening: Opening): Rect | null {
  const frame = openingFrame(plan, opening)
  if (!frame) return null
  return polygonBounds([
    add(frame.start, scale(frame.normal, frame.thickness)),
    add(frame.end, scale(frame.normal, frame.thickness)),
    add(frame.start, scale(frame.normal, -frame.thickness)),
    add(frame.end, scale(frame.normal, -frame.thickness)),
  ])
}

export function planBounds(plan: Plan): Rect | null {
  const rects: Rect[] = [
    ...plan.rooms.map(roomBounds),
    ...plan.walls.map(wallBounds),
    ...plan.items.map(itemBounds),
  ]
  return unionRects(rects.filter((r) => r.width > 0 || r.height > 0))
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export const findRoom = (plan: Plan, id: string): Room | undefined =>
  plan.rooms.find((room) => room.id === id)
export const findItem = (plan: Plan, id: string): Item | undefined =>
  plan.items.find((item) => item.id === id)
export const findWall = (plan: Plan, id: string): Wall | undefined =>
  plan.walls.find((wall) => wall.id === id)
export const findOpening = (plan: Plan, id: string): Opening | undefined =>
  plan.openings.find((opening) => opening.id === id)

/** Every wall segment in the plan, tagged with its host room. */
export interface WallRef extends WallEdge {
  roomId: string
  wallThickness: number
}

export function allWalls(plan: Plan): WallRef[] {
  return plan.rooms.flatMap((room) =>
    roomEdges(room).map((edge) => ({
      ...edge,
      roomId: room.id,
      wallThickness: room.wallThickness,
    })),
  )
}

/** Centerline midpoint of a wall, handy for labels. */
export const wallCenter = (edge: WallEdge): Vec2 => midpoint(edge.a, edge.b)
