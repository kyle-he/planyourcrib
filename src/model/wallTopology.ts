import { add, cross, distanceToSegment, dot, scale, sub, type Vec2 } from '@/core/geometry'
import { roomEdges, type WallEdge } from './derive'
import type { Plan, Room } from './types'

/** A room edge addressed without relying on object identity. */
export interface RoomEdgeRef {
  roomId: string
  edgeIndex: number
}

/**
 * The portion of two opposing wall centerlines that occupies the same space.
 * Rooms remain independent; this is derived topology, not persisted state.
 */
export interface SharedWall {
  first: RoomEdgeRef
  second: RoomEdgeRef
  a: Vec2
  b: Vec2
  length: number
  /** True when the shared portion covers both complete room edges. */
  fullEdgeMatch: boolean
  thickness: number
}

export interface WallTopology {
  sharedWalls: SharedWall[]
  sharedEdgeKeys: ReadonlySet<string>
  fullySharedEdgeKeys: ReadonlySet<string>
}

const ANGLE_EPSILON = 1e-4
const DEFAULT_POSITION_EPSILON = 0.02

export const roomEdgeKey = (roomId: string, edgeIndex: number): string =>
  `${roomId}:${edgeIndex}`

interface CenterlineEdge extends RoomEdgeRef {
  room: Room
  edge: WallEdge
  a: Vec2
  b: Vec2
}

function centerlineEdges(plan: Plan): CenterlineEdge[] {
  return plan.rooms.flatMap((room) =>
    roomEdges(room).map((edge) => {
      const half = room.wallThickness / 2
      const shift = scale(edge.normal, half)
      return {
        room,
        roomId: room.id,
        edgeIndex: edge.index,
        edge,
        a: add(edge.a, shift),
        b: add(edge.b, shift),
      }
    }),
  )
}

/** Detect shared wall bands by matching their opposing centerlines. */
export function analyzeWallTopology(
  plan: Plan,
  positionEpsilon = DEFAULT_POSITION_EPSILON,
): WallTopology {
  const edges = centerlineEdges(plan)
  const sharedWalls: SharedWall[] = []
  const sharedEdgeKeys = new Set<string>()
  const fullySharedEdgeKeys = new Set<string>()

  for (let i = 0; i < edges.length; i++) {
    const first = edges[i]!
    for (let j = i + 1; j < edges.length; j++) {
      const second = edges[j]!
      if (first.roomId === second.roomId) continue
      if (dot(first.edge.direction, second.edge.direction) > -1 + ANGLE_EPSILON) continue

      const lineGap = Math.abs(cross(sub(second.a, first.a), first.edge.direction))
      if (lineGap > positionEpsilon) continue

      const secondStart = dot(sub(second.a, first.a), first.edge.direction)
      const secondEnd = dot(sub(second.b, first.a), first.edge.direction)
      const overlapStart = Math.max(0, Math.min(secondStart, secondEnd))
      const overlapEnd = Math.min(first.edge.length, Math.max(secondStart, secondEnd))
      const overlapLength = overlapEnd - overlapStart
      if (overlapLength <= positionEpsilon) continue

      const firstIsCovered =
        overlapStart <= positionEpsilon &&
        first.edge.length - overlapEnd <= positionEpsilon
      const secondIsCovered =
        Math.abs(overlapLength - second.edge.length) <= positionEpsilon
      const fullEdgeMatch = firstIsCovered && secondIsCovered
      const shared: SharedWall = {
        first: { roomId: first.roomId, edgeIndex: first.edgeIndex },
        second: { roomId: second.roomId, edgeIndex: second.edgeIndex },
        a: add(first.a, scale(first.edge.direction, overlapStart)),
        b: add(first.a, scale(first.edge.direction, overlapEnd)),
        length: overlapLength,
        fullEdgeMatch,
        thickness: Math.max(first.room.wallThickness, second.room.wallThickness),
      }
      sharedWalls.push(shared)

      const firstKey = roomEdgeKey(first.roomId, first.edgeIndex)
      const secondKey = roomEdgeKey(second.roomId, second.edgeIndex)
      sharedEdgeKeys.add(firstKey)
      sharedEdgeKeys.add(secondKey)
      if (fullEdgeMatch) {
        fullySharedEdgeKeys.add(firstKey)
        fullySharedEdgeKeys.add(secondKey)
      }
    }
  }

  return { sharedWalls, sharedEdgeKeys, fullySharedEdgeKeys }
}

export function sharedWallForEdge(
  topology: WallTopology,
  roomId: string,
  edgeIndex: number,
): SharedWall | undefined {
  return topology.sharedWalls.find(
    (wall) =>
      (wall.first.roomId === roomId && wall.first.edgeIndex === edgeIndex) ||
      (wall.second.roomId === roomId && wall.second.edgeIndex === edgeIndex),
  )
}

/** The shared portion containing a specific point on a room edge, if any. */
export function sharedWallAtPoint(
  topology: WallTopology,
  roomId: string,
  edgeIndex: number,
  point: Vec2,
  tolerance = DEFAULT_POSITION_EPSILON,
): SharedWall | undefined {
  return topology.sharedWalls.find(
    (wall) =>
      ((wall.first.roomId === roomId && wall.first.edgeIndex === edgeIndex) ||
        (wall.second.roomId === roomId && wall.second.edgeIndex === edgeIndex)) &&
      distanceToSegment(point, wall.a, wall.b) <= tolerance,
  )
}

export function otherSideOfSharedWall(
  wall: SharedWall,
  roomId: string,
): RoomEdgeRef | undefined {
  if (wall.first.roomId === roomId) return wall.second
  if (wall.second.roomId === roomId) return wall.first
  return undefined
}

export interface RoomWallSnap {
  delta: Vec2
  walls: SharedWall[]
}

interface TranslationConstraint {
  normal: Vec2
  amount: number
}

function connectionForTranslation(
  moving: CenterlineEdge,
  target: CenterlineEdge,
  delta: Vec2,
  positionEpsilon = DEFAULT_POSITION_EPSILON,
): SharedWall | null {
  if (dot(moving.edge.direction, target.edge.direction) > -1 + ANGLE_EPSILON) return null
  const movedA = add(moving.a, delta)
  const lineGap = Math.abs(dot(sub(target.a, movedA), moving.edge.normal))
  if (lineGap > positionEpsilon) return null

  const targetStart = dot(sub(target.a, movedA), moving.edge.direction)
  const targetEnd = dot(sub(target.b, movedA), moving.edge.direction)
  const overlapStart = Math.max(0, Math.min(targetStart, targetEnd))
  const overlapEnd = Math.min(moving.edge.length, Math.max(targetStart, targetEnd))
  const length = overlapEnd - overlapStart
  if (length <= 1) return null

  return {
    first: { roomId: moving.roomId, edgeIndex: moving.edgeIndex },
    second: { roomId: target.roomId, edgeIndex: target.edgeIndex },
    a: add(movedA, scale(moving.edge.direction, overlapStart)),
    b: add(movedA, scale(moving.edge.direction, overlapEnd)),
    length,
    fullEdgeMatch:
      overlapStart <= positionEpsilon &&
      moving.edge.length - overlapEnd <= positionEpsilon &&
      Math.abs(length - target.edge.length) <= positionEpsilon,
    thickness: Math.max(moving.room.wallThickness, target.room.wallThickness),
  }
}

function matchingConnections(
  movingEdges: readonly CenterlineEdge[],
  stationaryEdges: readonly CenterlineEdge[],
  delta: Vec2,
): SharedWall[] {
  const result: SharedWall[] = []
  for (const moving of movingEdges) {
    for (const target of stationaryEdges) {
      const connection = connectionForTranslation(moving, target, delta)
      if (connection) result.push(connection)
    }
  }
  return result
}

function addConstraint(
  constraints: TranslationConstraint[],
  candidate: TranslationConstraint,
) {
  const duplicate = constraints.some((existing) => {
    const sameDirection = Math.abs(cross(existing.normal, candidate.normal)) < ANGLE_EPSILON
    if (!sameDirection) return false
    const aligned = dot(existing.normal, candidate.normal) >= 0
    return Math.abs(existing.amount - (aligned ? candidate.amount : -candidate.amount)) < 0.01
  })
  if (!duplicate) constraints.push(candidate)
}

function solveConstraintPair(
  first: TranslationConstraint,
  second: TranslationConstraint,
): Vec2 | null {
  const determinant = cross(first.normal, second.normal)
  // Nearly parallel constraints do not add a second useful degree of freedom.
  if (Math.abs(determinant) < 0.08) return null
  return {
    x: (first.amount * second.normal.y - first.normal.y * second.amount) / determinant,
    y: (first.normal.x * second.amount - first.amount * second.normal.x) / determinant,
  }
}

/**
 * Magnetically align moving room wall centerlines with one or more opposing
 * stationary walls. One constraint supplies a normal correction; two
 * independent constraints are solved as a tiny 2x2 system. The solved position
 * is then rescanned so one long wall can connect to several shorter segments.
 */
export function snapRoomsToWalls(
  plan: Plan,
  movingRooms: readonly Room[],
  proposedDelta: Vec2,
  tolerance: number,
): RoomWallSnap | null {
  const movingIds = new Set(movingRooms.map((room) => room.id))
  const movingPlan: Plan = { ...plan, rooms: [...movingRooms] }
  const movingEdges = centerlineEdges(movingPlan)
  const stationaryEdges = centerlineEdges({
    ...plan,
    rooms: plan.rooms.filter((room) => !movingIds.has(room.id)),
  })
  const constraints: TranslationConstraint[] = []

  for (const moving of movingEdges) {
    const movedA = add(moving.a, proposedDelta)
    for (const target of stationaryEdges) {
      if (dot(moving.edge.direction, target.edge.direction) > -1 + ANGLE_EPSILON) continue

      const amount = dot(sub(target.a, movedA), moving.edge.normal)
      if (Math.abs(amount) > tolerance) continue
      const correctedDelta = add(proposedDelta, scale(moving.edge.normal, amount))
      if (!connectionForTranslation(moving, target, correctedDelta)) continue
      addConstraint(constraints, { normal: moving.edge.normal, amount })
    }
  }

  // Keep pointer-move work bounded even in a very large plan. Nearby duplicate
  // constraints have already been collapsed above, so the closest 24 cover the
  // useful candidates while limiting pair evaluation to 276 tiny solves.
  constraints.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount))
  const nearby = constraints.slice(0, 24)
  const corrections: Vec2[] = nearby.map((constraint) =>
    scale(constraint.normal, constraint.amount),
  )
  for (let i = 0; i < nearby.length; i++) {
    for (let j = i + 1; j < nearby.length; j++) {
      const solved = solveConstraintPair(nearby[i]!, nearby[j]!)
      if (solved && Math.hypot(solved.x, solved.y) <= tolerance * 1.5) corrections.push(solved)
    }
  }

  let best: RoomWallSnap | null = null
  let bestScore = -Infinity
  for (const correction of corrections) {
    const delta = add(proposedDelta, correction)
    const walls = matchingConnections(movingEdges, stationaryEdges, delta)
    if (walls.length === 0) continue
    const fullMatches = walls.filter((wall) => wall.fullEdgeMatch).length
    const score = walls.length * 1000 + fullMatches * 10 - Math.hypot(correction.x, correction.y)
    if (score > bestScore) {
      best = { delta, walls }
      bestScore = score
    }
  }
  return best
}

export interface WallPushSnap {
  push: number
  walls: SharedWall[]
}

/** Snap a wall-handle resize to parallel walls, including angled walls. */
export function snapWallPushToWalls(
  plan: Plan,
  roomId: string,
  edgeIndex: number,
  startPoints: readonly Vec2[],
  proposedPush: number,
  tolerance: number,
  excludeRoomIds: ReadonlySet<string> = new Set([roomId]),
): WallPushSnap | null {
  const room = plan.rooms.find((candidate) => candidate.id === roomId)
  if (!room) return null
  const sourceRoom = { ...room, points: startPoints.map((point) => ({ ...point })) }
  const moving = centerlineEdges({ ...plan, rooms: [sourceRoom] }).find(
    (candidate) => candidate.edgeIndex === edgeIndex,
  )
  if (!moving) return null
  const stationary = centerlineEdges({
    ...plan,
    rooms: plan.rooms.filter((candidate) => !excludeRoomIds.has(candidate.id)),
  })

  const candidatePushes = new Set<number>()
  const proposedDelta = scale(moving.edge.normal, proposedPush)
  const movedA = add(moving.a, proposedDelta)
  for (const target of stationary) {
    if (dot(moving.edge.direction, target.edge.direction) > -1 + ANGLE_EPSILON) continue
    const correction = dot(sub(target.a, movedA), moving.edge.normal)
    if (Math.abs(correction) > tolerance) continue
    const push = proposedPush + correction
    if (connectionForTranslation(moving, target, scale(moving.edge.normal, push))) {
      candidatePushes.add(push)
    }
  }

  let best: WallPushSnap | null = null
  for (const push of candidatePushes) {
    const delta = scale(moving.edge.normal, push)
    const walls = stationary.flatMap((target) => {
      const connection = connectionForTranslation(moving, target, delta)
      return connection ? [connection] : []
    })
    if (
      walls.length > (best?.walls.length ?? 0) ||
      (walls.length === best?.walls.length &&
        Math.abs(push - proposedPush) < Math.abs((best?.push ?? proposedPush) - proposedPush))
    ) {
      best = { push, walls }
    }
  }
  return best
}
