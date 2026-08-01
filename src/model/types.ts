import type { Vec2 } from '@/core/geometry'
import type { UnitSystem } from '@/core/units'

export type EntityKind = 'room' | 'item' | 'opening'

/** A room is stored as its *interior* ring; walls are grown outward from it. */
export interface Room {
  id: string
  name: string
  /** Interior corner points, in inches, in ring order. */
  points: Vec2[]
  wallThickness: number
  floor: string
}

export type OpeningKind =
  | 'door'
  | 'double-door'
  | 'sliding-door'
  | 'pocket-door'
  | 'archway'
  | 'window'
  | 'bay-window'

/**
 * Doors and windows are *hosted* by a wall: they store which room edge they sit
 * on plus a distance along that edge, so they move with the wall automatically.
 */
export interface Opening {
  id: string
  kind: OpeningKind
  roomId: string
  /** Index of the room edge (points[i] -> points[i+1]) hosting this opening. */
  edgeIndex: number
  /** Distance in inches from the edge start to the opening's center. */
  offset: number
  width: number
  /** Which way a hinged door swings open. */
  flipHinge: boolean
  /** True when the leaf swings into the host room. */
  flipInward: boolean
}

/** Furniture, appliances and fixtures. Axis-aligned box + rotation. */
export interface Item {
  id: string
  templateId: string
  name: string
  center: Vec2
  width: number
  depth: number
  /** Degrees, clockwise on screen. */
  rotation: number
  color: string
  locked: boolean
  /**
   * Set on user-added images. The pixels live in the image asset store, keyed by
   * this id; plans (and their autosave) only ever carry the reference.
   */
  imageId?: string
}

export interface Plan {
  version: 1
  name: string
  rooms: Room[]
  openings: Opening[]
  items: Item[]
}

export interface Settings {
  unit: UnitSystem
  gridStep: number
  showGrid: boolean
  snapToGrid: boolean
  snapToObjects: boolean
  showDimensions: boolean
  showAreas: boolean
  showNames: boolean
}

/** A reference to something selectable. `vertexIndex` targets a room corner. */
export interface SelectionRef {
  kind: EntityKind
  id: string
}

export type Entity = Room | Opening | Item

export function isRoom(entity: Entity): entity is Room {
  return 'points' in entity
}

export function isOpening(entity: Entity): entity is Opening {
  return 'edgeIndex' in entity
}

export function isItem(entity: Entity): entity is Item {
  return 'templateId' in entity
}
