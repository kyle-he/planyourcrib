import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Rect, Vec2 } from '@/core/geometry'
import type { SelectionRef } from '@/model/types'
import type { SnapGuide } from '../snapping'

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
export type OpeningResizeHandle = 'start' | 'end'

/** Drag gestures that scene shapes and handles can start. */
export interface SceneHandlers {
  /** Click/drag an entity: selects it and starts a move. */
  startMove: (ref: SelectionRef, event: ReactPointerEvent) => void
  startItemResize: (itemId: string, handle: ResizeHandle, event: ReactPointerEvent) => void
  startItemRotate: (itemId: string, event: ReactPointerEvent) => void
  startVertexDrag: (roomId: string, index: number, event: ReactPointerEvent) => void
  /** Add a point to a wall, then let the same gesture position it. */
  startVertexInsert: (roomId: string, edgeIndex: number, at: Vec2, event: ReactPointerEvent) => void
  removeVertex: (roomId: string, index: number, event: ReactPointerEvent) => void
  startWallDrag: (roomId: string, edgeIndex: number, event: ReactPointerEvent) => void
  startOpeningDrag: (openingId: string, event: ReactPointerEvent) => void
  startOpeningResize: (
    openingId: string,
    handle: OpeningResizeHandle,
    event: ReactPointerEvent,
  ) => void
  insertVertex: (roomId: string, edgeIndex: number, at: Vec2) => void
  hover: (ref: SelectionRef | null) => void
}

/** Transient visuals that only exist while a gesture is in flight. */
export interface PreviewState {
  marquee: Rect | null
  draftRoom: Rect | null
  measure: { a: Vec2; b: Vec2 } | null
  /** Ghost for the item placement tool. */
  itemGhost: {
    center: Vec2
    width: number
    depth: number
    rotation: number
    glyphKey: string
    /** Set when placing a user image, so the ghost shows the actual picture. */
    imageId?: string
  } | null
  /** Ghost for the opening placement tool. */
  openingGhost: { roomId: string; edgeIndex: number; offset: number } | null
  guides: SnapGuide[]
  /** Live size readout shown while drawing or resizing. */
  sizeHint: { at: Vec2; width: number; height: number } | null
}

export const EMPTY_PREVIEW: PreviewState = {
  marquee: null,
  draftRoom: null,
  measure: null,
  itemGhost: null,
  openingGhost: null,
  guides: [],
  sizeHint: null,
}
