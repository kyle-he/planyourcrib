import type { Rect, Vec2 } from '@/core/geometry'
import type { ItemTemplate } from '@/model/catalog'
import type {
  Item,
  Opening,
  OpeningKind,
  Plan,
  Room,
  SelectionRef,
  Settings,
} from '@/model/types'

export type ToolId = 'select' | 'room' | 'opening' | 'item' | 'measure'

export interface Viewport {
  /** Pixels per inch. */
  scale: number
  /** Screen-space translation in pixels. */
  x: number
  y: number
  /** Size of the canvas element in pixels. */
  width: number
  height: number
}

export interface PlanSlice {
  plan: Plan
  past: Plan[]
  future: Plan[]

  /**
   * Group every change until `endBatch` into a single undo step. The snapshot is
   * taken lazily, so a batch that changes nothing adds no history entry.
   */
  beginBatch: () => void
  endBatch: () => void
  /** Apply a change as its own undo step (or folded into the open batch). */
  commit: (recipe: (plan: Plan) => void) => void
  undo: () => void
  redo: () => void

  loadPlan: (plan: Plan) => void
  newPlan: () => void
  renamePlan: (name: string) => void

  addRoom: (room: Room) => void
  updateRoom: (id: string, patch: Partial<Omit<Room, 'id'>>) => void
  setRoomRect: (id: string, rect: Rect) => void
  moveRoomVertex: (id: string, index: number, point: Vec2) => void
  insertRoomVertex: (id: string, afterIndex: number, point: Vec2) => void
  removeRoomVertex: (id: string, index: number) => void

  addOpening: (opening: Opening) => void
  updateOpening: (id: string, patch: Partial<Omit<Opening, 'id'>>) => void

  addItem: (item: Item) => void
  updateItem: (id: string, patch: Partial<Omit<Item, 'id'>>) => void
  reorderItem: (id: string, to: 'front' | 'back') => void

  deleteEntities: (refs: readonly SelectionRef[]) => void
  translateEntities: (refs: readonly SelectionRef[], delta: Vec2) => void
  rotateEntities: (refs: readonly SelectionRef[], degrees: number) => void
  /** Returns the refs of the copies so callers can select them. */
  duplicateEntities: (refs: readonly SelectionRef[], delta: Vec2) => SelectionRef[]
}

export interface SelectionSlice {
  selection: SelectionRef[]
  hover: SelectionRef | null
  /** A room corner being edited independently from its containing room. */
  selectedVertex: { roomId: string; index: number } | null
  /** Room id whose vertices are being edited, if any. */
  editingRoomId: string | null

  select: (ref: SelectionRef | null, additive?: boolean) => void
  setSelection: (refs: readonly SelectionRef[]) => void
  toggleSelection: (ref: SelectionRef) => void
  clearSelection: () => void
  selectAll: () => void
  setHover: (ref: SelectionRef | null) => void
  selectVertex: (roomId: string, index: number) => void
  setEditingRoom: (id: string | null) => void
}

export interface ToolSlice {
  tool: ToolId
  /** Kind used by the opening tool. */
  openingKind: OpeningKind
  /** Template used by the item tool. */
  itemTemplate: ItemTemplate | null

  setTool: (tool: ToolId) => void
  startPlacingItem: (template: ItemTemplate) => void
  startPlacingOpening: (kind: OpeningKind) => void
}

export interface ViewportSlice {
  viewport: Viewport
  setViewportSize: (width: number, height: number) => void
  panBy: (dx: number, dy: number) => void
  zoomAt: (screenPoint: Vec2, factor: number) => void
  setZoom: (scale: number) => void
  fitToRect: (rect: Rect, padding?: number) => void
  resetView: () => void
}

export interface SettingsSlice {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  setWallThickness: (wallThickness: number) => void
}

export interface ClipboardSlice {
  clipboard: { items: Item[] } | null
  copySelection: () => void
  cut: () => void
  paste: () => void
}

export type EditorStore = PlanSlice &
  SelectionSlice &
  ToolSlice &
  ViewportSlice &
  SettingsSlice &
  ClipboardSlice
