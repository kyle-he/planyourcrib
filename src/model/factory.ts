import { createId } from '@/core/id'
import type { Rect, Vec2 } from '@/core/geometry'
import { defaultGridStep } from '@/core/units'
import { getItemTemplate, getOpeningTemplate, type ItemTemplate } from './catalog'
import type { Item, Opening, OpeningKind, Plan, Room, Settings } from './types'

export const DEFAULT_WALL_THICKNESS = 5
export const DEFAULT_FLOOR = '#ffffff'

const ROOM_NAMES = [
  'Living Room',
  'Bedroom',
  'Kitchen',
  'Bathroom',
  'Dining Room',
  'Office',
  'Hallway',
  'Closet',
]

export function nextRoomName(existing: readonly Room[]): string {
  const used = new Set(existing.map((room) => room.name))
  const fresh = ROOM_NAMES.find((name) => !used.has(name))
  return fresh ?? `Room ${existing.length + 1}`
}

export function createRoomFromRect(rect: Rect, name: string): Room {
  return {
    id: createId('room'),
    name,
    points: [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
    ],
    wallThickness: DEFAULT_WALL_THICKNESS,
    floor: DEFAULT_FLOOR,
  }
}

export function createItem(template: ItemTemplate, center: Vec2, rotation = 0): Item {
  return {
    id: createId('item'),
    templateId: template.id,
    name: template.name,
    center,
    width: template.width,
    depth: template.depth,
    rotation,
    color: template.color ?? '#eceef2',
    locked: false,
    ...(template.imageId ? { imageId: template.imageId } : null),
  }
}

export function createItemFromTemplateId(templateId: string, center: Vec2): Item | null {
  const template = getItemTemplate(templateId)
  return template ? createItem(template, center) : null
}

export function createOpening(
  kind: OpeningKind,
  roomId: string,
  edgeIndex: number,
  offset: number,
  width = getOpeningTemplate(kind).width,
): Opening {
  return {
    id: createId('open'),
    kind,
    roomId,
    edgeIndex,
    offset,
    width,
    flipHinge: false,
    flipInward: true,
  }
}

export const DEFAULT_SETTINGS: Settings = {
  unit: 'ftin',
  gridStep: defaultGridStep('ftin'),
  showGrid: true,
  snapToGrid: true,
  snapToObjects: true,
  showDimensions: true,
  showAreas: true,
  showNames: true,
}

export function createEmptyPlan(name = 'Untitled plan'): Plan {
  return { version: 1, name, rooms: [], openings: [], items: [] }
}

/** A small furnished room so a first-time user has something to poke at. */
export function createStarterPlan(): Plan {
  const width = 192
  const height = 156
  const room = createRoomFromRect({ x: 0, y: 0, width, height }, 'Living Room')
  const plan = createEmptyPlan('My first plan')
  plan.rooms.push(room)
  plan.openings.push(
    createOpening('door', room.id, 3, 108),
    createOpening('window', room.id, 0, 96, 48),
  )

  // Keep the middle of the room clear so the room label stays readable.
  const furniture: [string, Vec2, number][] = [
    ['sofa', { x: 96, y: 18 }, 0],
    ['armchair', { x: 18, y: 84 }, 270],
    ['tv-stand', { x: 96, y: 147 }, 180],
    ['plant', { x: 174, y: 18 }, 0],
  ]
  for (const [templateId, center, rotation] of furniture) {
    const item = createItemFromTemplateId(templateId, center)
    if (item) plan.items.push({ ...item, rotation })
  }
  return plan
}
