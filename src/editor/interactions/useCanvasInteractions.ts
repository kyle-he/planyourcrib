import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import {
  clamp,
  dot,
  polygonBounds,
  rectFromPoints,
  rectsIntersect,
  roundTo,
  sub,
  toDegrees,
  type Rect,
  type Vec2,
} from '@/core/geometry'
import { getOpeningTemplate } from '@/model/catalog'
import { itemCorners, maxOpeningOffset, roomEdge, roomOuterRing } from '@/model/derive'
import { createItem, createOpening, createRoomFromRect, nextRoomName } from '@/model/factory'
import type { Plan, SelectionRef } from '@/model/types'
import {
  analyzeWallTopology,
  otherSideOfSharedWall,
  sharedWallForEdge,
  snapRoomsToWalls,
  snapWallPushToWalls,
  type RoomEdgeRef,
  type SharedWall,
} from '@/model/wallTopology'
import { useEditorStore } from '@/state/store'
import { screenToWorld } from '@/state/transform'
import {
  placementCenter,
  snapMove,
  snapPoint,
  snapVertexToWalls,
  type SnapContext,
  type SnapGuide,
} from '../snapping'
import {
  findNearestWall,
  itemSnapshot,
  lockAxis,
  resizeItemBox,
  resolveOpeningPlacement,
  wallPushDistance,
  type ItemBoxSnapshot,
} from './dragMath'
import {
  EMPTY_PREVIEW,
  type OpeningResizeHandle,
  type PreviewState,
  type ResizeHandle,
  type SceneHandlers,
} from './types'

const MIN_ROOM_SIZE = 12
const OPENING_SNAP_DISTANCE = 48
const DRAG_THRESHOLD_PX = 3
const WALL_ANGLE_SNAP_TOLERANCE_PX = 10

interface MoveOrigin {
  rooms: { id: string; points: Vec2[] }[]
  items: { id: string; center: Vec2 }[]
  openings: { id: string; offset: number }[]
}

type DragState =
  | { kind: 'pan'; last: Vec2; moved: boolean; clearOnClick: boolean }
  | { kind: 'marquee'; origin: Vec2; additive: boolean }
  | {
      kind: 'move'
      startWorld: Vec2
      origin: MoveOrigin
      anchors: Vec2[]
      bounds: Rect | null
      excluded: Set<string>
      moved: boolean
    }
  | { kind: 'resize'; itemId: string; handle: ResizeHandle; start: ItemBoxSnapshot }
  | { kind: 'rotate'; itemId: string; center: Vec2; pointerAngle: number; startRotation: number }
  | { kind: 'vertex'; roomId: string; index: number }
  | {
      kind: 'wall'
      roomId: string
      edgeIndex: number
      startWorld: Vec2
      startPoints: Vec2[]
      normal: Vec2
      connected: (RoomEdgeRef & { startPoints: Vec2[] }) | null
    }
  | { kind: 'opening'; openingId: string }
  | { kind: 'opening-resize'; openingId: string; handle: OpeningResizeHandle }
  | { kind: 'draw-room'; origin: Vec2 }
  | { kind: 'measure'; origin: Vec2; completesAnchor: boolean; moved: boolean }

type MeasureCycle = { origin: Vec2 } | null

export interface CanvasInteractions {
  preview: PreviewState
  scene: SceneHandlers
  cursor: string
  onPointerDownCapture: (event: ReactPointerEvent) => void
  onPointerMoveCapture: (event: ReactPointerEvent) => void
  onPointerUpCapture: (event: ReactPointerEvent) => void
  onPointerDown: (event: ReactPointerEvent) => void
  onPointerMove: (event: ReactPointerEvent) => void
  onPointerUp: (event: ReactPointerEvent) => void
  onDoubleClick: (event: ReactMouseEvent) => void
}

export function useCanvasInteractions(
  hostRef: RefObject<HTMLDivElement | null>,
): CanvasInteractions {
  const tool = useEditorStore((state) => state.tool)
  const [preview, setPreview] = useState<PreviewState>(EMPTY_PREVIEW)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [shiftHeld, setShiftHeld] = useState(false)
  const drag = useRef<DragState | null>(null)
  const measureCycle = useRef<MeasureCycle>(null)
  const rect = useRef<DOMRect | null>(null)
  const touchPoints = useRef(new Map<number, Vec2>())
  const multiTouchActive = useRef(false)
  const multiTouchFrame = useRef<{ center: Vec2; distance: number } | null>(null)
  const patchPreview = useCallback(
    (patch: Partial<PreviewState>) => setPreview((current) => ({ ...current, ...patch })),
    [],
  )

  // Space-drag panning, like every other canvas app.
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

    const down = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTypingTarget(event.target)) {
        event.preventDefault()
        setSpaceHeld(true)
      }
      if (event.key === 'Shift' && !isTypingTarget(event.target)) setShiftHeld(true)
    }
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceHeld(false)
      if (event.key === 'Shift') setShiftHeld(false)
    }
    const blur = () => {
      setSpaceHeld(false)
      setShiftHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // Switching tools must not leave stale ghosts or a measuring tape behind.
  useEffect(() => {
    if (tool !== 'measure') measureCycle.current = null
    setPreview((current) =>
      current === EMPTY_PREVIEW
        ? current
        : { ...EMPTY_PREVIEW, measure: tool === 'measure' ? current.measure : null },
    )
  }, [tool])

  const localPoint = useCallback(
    (event: { clientX: number; clientY: number }): Vec2 => {
      const bounds = rect.current ?? hostRef.current?.getBoundingClientRect() ?? null
      if (bounds) rect.current = bounds
      return { x: event.clientX - (bounds?.left ?? 0), y: event.clientY - (bounds?.top ?? 0) }
    },
    [hostRef],
  )

  const worldPoint = useCallback(
    (event: { clientX: number; clientY: number }): Vec2 =>
      screenToWorld(useEditorStore.getState().viewport, localPoint(event)),
    [localPoint],
  )

  const snapContext = useCallback(
    (exclude?: Set<string>): SnapContext => {
      const { plan, settings, viewport } = useEditorStore.getState()
      return { plan, settings, scale: viewport.scale, exclude }
    },
    [],
  )

  /**
   * Capture on the host element (not the shape that was clicked) so a gesture
   * survives re-renders of the shape and keeps bubbling to our handlers.
   */
  const capture = useCallback(
    (event: ReactPointerEvent) => {
      rect.current = hostRef.current?.getBoundingClientRect() ?? null
      hostRef.current?.setPointerCapture(event.pointerId)
    },
    [hostRef],
  )

  const release = useCallback(
    (pointerId: number) => {
      const host = hostRef.current
      if (host?.hasPointerCapture(pointerId)) host.releasePointerCapture(pointerId)
    },
    [hostRef],
  )

  /**
   * Touches enter through the host's capture phase so the second finger wins
   * before a room, item, or resize handle can interpret it as another edit.
   * One finger retains the normal editor behavior; two fingers pan and pinch.
   */
  const onPointerDownCapture = useCallback(
    (event: ReactPointerEvent) => {
      if (event.pointerType !== 'touch') return
      touchPoints.current.set(event.pointerId, localPoint(event))
      if (touchPoints.current.size < 2) return

      event.preventDefault()
      event.stopPropagation()
      const currentDrag = drag.current
      if (currentDrag && dragUsesHistoryBatch(currentDrag)) {
        useEditorStore.getState().endBatch()
      }
      drag.current = null
      patchPreview({
        draftRoom: null,
        marquee: null,
        guides: [],
        sizeHint: null,
        itemGhost: null,
        openingGhost: null,
      })
      multiTouchActive.current = true
      multiTouchFrame.current = frameForTouches(touchPoints.current)
      rect.current = hostRef.current?.getBoundingClientRect() ?? null
      hostRef.current?.setPointerCapture(event.pointerId)
    },
    [hostRef, localPoint, patchPreview],
  )

  const onPointerMoveCapture = useCallback(
    (event: ReactPointerEvent) => {
      if (event.pointerType !== 'touch' || !touchPoints.current.has(event.pointerId)) return
      touchPoints.current.set(event.pointerId, localPoint(event))
      if (!multiTouchActive.current) return

      event.preventDefault()
      event.stopPropagation()
      const previous = multiTouchFrame.current
      const next = frameForTouches(touchPoints.current)
      if (!previous || !next) {
        multiTouchFrame.current = next
        return
      }

      const store = useEditorStore.getState()
      store.panBy(next.center.x - previous.center.x, next.center.y - previous.center.y)
      if (previous.distance > 0 && next.distance > 0) {
        store.zoomAt(next.center, next.distance / previous.distance)
      }
      multiTouchFrame.current = next
    },
    [localPoint],
  )

  const onPointerUpCapture = useCallback(
    (event: ReactPointerEvent) => {
      if (event.pointerType !== 'touch') return
      touchPoints.current.delete(event.pointerId)
      if (!multiTouchActive.current) return

      event.preventDefault()
      event.stopPropagation()
      release(event.pointerId)
      multiTouchFrame.current = frameForTouches(touchPoints.current)
      if (touchPoints.current.size === 0) {
        multiTouchActive.current = false
        multiTouchFrame.current = null
      }
    },
    [release],
  )

  // ---------------------------------------------------------------- gestures

  const beginMove = useCallback(
    (event: ReactPointerEvent, refs: readonly SelectionRef[]) => {
      const { plan } = useEditorStore.getState()
      const roomIds = new Set(refs.filter((r) => r.kind === 'room').map((r) => r.id))
      const itemIds = new Set(refs.filter((r) => r.kind === 'item').map((r) => r.id))
      const openingIds = new Set(refs.filter((r) => r.kind === 'opening').map((r) => r.id))

      const rooms = plan.rooms.filter((room) => roomIds.has(room.id))
      const items = plan.items.filter((item) => itemIds.has(item.id) && !item.locked)
      const openings = plan.openings.filter(
        (opening) => openingIds.has(opening.id) && !roomIds.has(opening.roomId),
      )
      if (rooms.length + items.length + openings.length === 0) return

      const points: Vec2[] = [
        ...rooms.flatMap((room) => roomOuterRing(room)),
        ...items.flatMap((item) => itemCorners(item)),
      ]
      const bounds = points.length > 0 ? polygonBounds(points) : null
      const anchors: Vec2[] = bounds
        ? [
            { x: bounds.x, y: bounds.y },
            { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
          ]
        : []

      drag.current = {
        kind: 'move',
        startWorld: worldPoint(event),
        origin: {
          rooms: rooms.map((room) => ({ id: room.id, points: room.points.map((p) => ({ ...p })) })),
          items: items.map((item) => ({ id: item.id, center: { ...item.center } })),
          openings: openings.map((opening) => ({ id: opening.id, offset: opening.offset })),
        },
        anchors,
        bounds,
        excluded: new Set([...roomIds, ...itemIds]),
        moved: false,
      }
      useEditorStore.getState().beginBatch()
      capture(event)
    },
    [capture, worldPoint],
  )

  const scene = useMemo<SceneHandlers>(
    () => ({
      startMove: (ref, event) => {
        const store = useEditorStore.getState()
        // Let the canvas handle the event when a placement tool is armed.
        if (event.button !== 0 || spaceHeld || store.tool !== 'select') return
        event.stopPropagation()

        const alreadySelected = store.selection.some(
          (candidate) => candidate.kind === ref.kind && candidate.id === ref.id,
        )
        if (event.shiftKey) {
          store.toggleSelection(ref)
          if (alreadySelected) return
        } else if (!alreadySelected) {
          store.select(ref)
        }

        const refs = useEditorStore.getState().selection
        // A lone opening re-hosts to whichever wall you drag it onto.
        if (refs.length === 1 && refs[0]?.kind === 'opening') {
          drag.current = { kind: 'opening', openingId: refs[0].id }
          useEditorStore.getState().beginBatch()
          capture(event)
          return
        }
        beginMove(event, refs)
      },

      startItemResize: (itemId, handle, event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        const item = useEditorStore.getState().plan.items.find((candidate) => candidate.id === itemId)
        if (!item || item.locked) return
        drag.current = { kind: 'resize', itemId, handle, start: itemSnapshot(item) }
        useEditorStore.getState().beginBatch()
        capture(event)
      },

      startItemRotate: (itemId, event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        const item = useEditorStore.getState().plan.items.find((candidate) => candidate.id === itemId)
        if (!item || item.locked) return
        const pointer = worldPoint(event)
        drag.current = {
          kind: 'rotate',
          itemId,
          center: item.center,
          pointerAngle: toDegrees(Math.atan2(pointer.y - item.center.y, pointer.x - item.center.x)),
          startRotation: item.rotation,
        }
        useEditorStore.getState().beginBatch()
        capture(event)
      },

      startVertexDrag: (roomId, index, event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        const store = useEditorStore.getState()
        store.selectVertex(roomId, index)
        drag.current = { kind: 'vertex', roomId, index }
        store.beginBatch()
        capture(event)
      },

      startVertexInsert: (roomId, edgeIndex, at, event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        const store = useEditorStore.getState()
        store.beginBatch()
        store.insertRoomVertex(roomId, edgeIndex, snapPoint(at, snapContext(new Set([roomId]))).delta)
        store.selectVertex(roomId, edgeIndex + 1)
        // The inserted point follows the pointer immediately, so this works as
        // either a click-to-add or a drag-to-add control.
        drag.current = { kind: 'vertex', roomId, index: edgeIndex + 1 }
        capture(event)
      },

      removeVertex: (roomId, index, event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        const store = useEditorStore.getState()
        store.removeRoomVertex(roomId, index)
        store.clearSelection()
      },

      startWallDrag: (roomId, edgeIndex, event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        const store = useEditorStore.getState()
        const room = store.plan.rooms.find((candidate) => candidate.id === roomId)
        const edge = room && roomEdge(room, edgeIndex)
        if (!room || !edge) return
        const topology = analyzeWallTopology(store.plan)
        const shared = sharedWallForEdge(topology, roomId, edgeIndex)
        const otherSide = shared?.fullEdgeMatch
          ? otherSideOfSharedWall(shared, roomId)
          : undefined
        const connectedRoom = otherSide &&
          store.plan.rooms.find((candidate) => candidate.id === otherSide.roomId)
        drag.current = {
          kind: 'wall',
          roomId,
          edgeIndex,
          startWorld: worldPoint(event),
          startPoints: room.points.map((point) => ({ ...point })),
          normal: edge.normal,
          connected: otherSide && connectedRoom
            ? {
                ...otherSide,
                startPoints: connectedRoom.points.map((point) => ({ ...point })),
              }
            : null,
        }
        store.beginBatch()
        capture(event)
      },

      startOpeningDrag: (openingId, event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        useEditorStore.getState().select({ kind: 'opening', id: openingId })
        drag.current = { kind: 'opening', openingId }
        useEditorStore.getState().beginBatch()
        capture(event)
      },

      startOpeningResize: (openingId, handle, event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        const store = useEditorStore.getState()
        store.select({ kind: 'opening', id: openingId })
        drag.current = { kind: 'opening-resize', openingId, handle }
        store.beginBatch()
        capture(event)
      },

      insertVertex: (roomId, edgeIndex, at) => {
        const store = useEditorStore.getState()
        const snapped = snapPoint(at, snapContext(new Set([roomId]))).delta
        store.insertRoomVertex(roomId, edgeIndex, snapped)
      },

      hover: (ref) => useEditorStore.getState().setHover(ref),
    }),
    [beginMove, capture, snapContext, spaceHeld, worldPoint],
  )

  // ------------------------------------------------------------- svg events

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      const store = useEditorStore.getState()
      const world = worldPoint(event)

      if (event.button === 1 || spaceHeld) {
        drag.current = { kind: 'pan', last: localPoint(event), moved: false, clearOnClick: false }
        capture(event)
        return
      }
      if (event.button !== 0) return

      switch (store.tool) {
        case 'room': {
          const origin = snapPoint(world, snapContext()).delta
          drag.current = { kind: 'draw-room', origin }
          patchPreview({ draftRoom: { ...origin, width: 0, height: 0 } })
          capture(event)
          return
        }
        case 'measure': {
          const anchor = measureCycle.current
          const at = snapPoint(world, snapContext()).delta
          if (anchor) {
            // A second click completes the line from the first dot. The next
            // click will begin a fresh measurement.
            drag.current = { kind: 'measure', origin: anchor.origin, completesAnchor: true, moved: false }
            patchPreview({ measure: { a: anchor.origin, b: at } })
          } else {
            drag.current = { kind: 'measure', origin: at, completesAnchor: false, moved: false }
            patchPreview({ measure: { a: at, b: at } })
          }
          capture(event)
          return
        }
        case 'item': {
          const template = store.itemTemplate
          if (!template) return
          const center = placementCenter(world, template.width, template.depth, snapContext())
          const item = createItem(template, center)
          store.commit((plan) => void plan.items.push(item))
          if (!event.shiftKey) {
            store.setTool('select')
            store.select({ kind: 'item', id: item.id })
          }
          return
        }
        case 'opening': {
          const kind = store.openingKind
          const template = getOpeningTemplate(kind)
          const placement = resolveOpeningPlacement(
            store.plan,
            world,
            template.width,
            store.settings,
            OPENING_SNAP_DISTANCE,
          )
          if (!placement) return
          const opening = createOpening(
            kind,
            placement.roomId,
            placement.edgeIndex,
            placement.offset,
            template.width,
          )
          store.commit((plan) => void plan.openings.push(opening))
          if (!event.shiftKey) {
            store.setTool('select')
            store.select({ kind: 'opening', id: opening.id })
          }
          return
        }

        default: {
          if (event.shiftKey) {
            drag.current = { kind: 'marquee', origin: world, additive: true }
          } else {
            drag.current = {
              kind: 'pan',
              last: localPoint(event),
              moved: false,
              clearOnClick: true,
            }
          }
          capture(event)
        }
      }
    },
    [capture, localPoint, patchPreview, snapContext, spaceHeld, worldPoint],
  )

  /** Ghost previews follow the cursor while a placement tool is armed. */
  const updateToolPreview = useCallback(
    (event: ReactPointerEvent) => {
      const store = useEditorStore.getState()
      const world = worldPoint(event)

      if (store.tool === 'item' && store.itemTemplate) {
        const template = store.itemTemplate
        patchPreview({
          itemGhost: {
            center: placementCenter(world, template.width, template.depth, snapContext()),
            width: template.width,
            depth: template.depth,
            rotation: 0,
            glyphKey: template.glyph,
            imageId: template.imageId,
          },
          openingGhost: null,
        })
        return
      }
      if (store.tool === 'opening') {
        const template = getOpeningTemplate(store.openingKind)
        patchPreview({
          openingGhost: resolveOpeningPlacement(
            store.plan,
            world,
            template.width,
            store.settings,
            OPENING_SNAP_DISTANCE,
          ),
          itemGhost: null,
        })
        return
      }
      setPreview((current) =>
        current.itemGhost || current.openingGhost
          ? { ...current, itemGhost: null, openingGhost: null }
          : current,
      )
    },
    [patchPreview, snapContext, worldPoint],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const store = useEditorStore.getState()
      const state = drag.current

      if (!state) {
        updateToolPreview(event)
        return
      }

      const world = worldPoint(event)

      switch (state.kind) {
        case 'pan': {
          const point = localPoint(event)
          const didMove = point.x !== state.last.x || point.y !== state.last.y
          if (!state.moved && didMove) store.clearSelection()
          store.panBy(point.x - state.last.x, point.y - state.last.y)
          drag.current = {
            kind: 'pan',
            last: point,
            moved: state.moved || didMove,
            clearOnClick: state.clearOnClick,
          }
          return
        }

        case 'marquee': {
          patchPreview({ marquee: rectFromPoints(state.origin, world) })
          return
        }

        case 'move': {
          const raw = sub(world, state.startWorld)
          const proposed = event.shiftKey ? lockAxis(raw) : raw
          if (
            !state.moved &&
            Math.hypot(proposed.x, proposed.y) * store.viewport.scale < DRAG_THRESHOLD_PX
          ) {
            return
          }
          state.moved = true
          const movingRooms = state.origin.rooms.flatMap((snapshot) => {
            const room = store.plan.rooms.find((candidate) => candidate.id === snapshot.id)
            return room ? [{ ...room, points: snapshot.points }] : []
          })
          const wallSnap = store.settings.snapToObjects && movingRooms.length > 0
            ? snapRoomsToWalls(
                store.plan,
                movingRooms,
                proposed,
                7 / store.viewport.scale,
              )
            : null
          const snapped = wallSnap
            ? { delta: wallSnap.delta, guides: guidesForSharedWalls(wallSnap.walls) }
            : snapMove({
                ...snapContext(state.excluded),
                anchors: state.anchors,
                bounds: state.bounds,
                delta: proposed,
              })
          const { delta, guides } = snapped
          store.commit(moveRecipe(state.origin, delta))
          patchPreview({ guides })
          return
        }

        case 'resize': {
          const next = resizeItemBox(state.start, state.handle, world, {
            symmetric: event.altKey,
            keepAspect: event.shiftKey,
            snapStep: store.settings.snapToGrid ? store.settings.gridStep : 0,
          })
          store.updateItem(state.itemId, next)
          patchPreview({
            sizeHint: { at: next.center, width: next.width, height: next.depth },
          })
          return
        }

        case 'rotate': {
          const angle = toDegrees(
            Math.atan2(world.y - state.center.y, world.x - state.center.x),
          )
          const raw = state.startRotation + (angle - state.pointerAngle)
          store.updateItem(state.itemId, {
            rotation: ((event.altKey ? raw : roundTo(raw, 15)) % 360 + 360) % 360,
          })
          return
        }

        case 'vertex': {
          const context = snapContext(new Set([state.roomId]))
          const wallSnap = snapVertexToWalls(world, context)
          const { delta, guides } = wallSnap ?? snapPoint(world, context)
          const room = store.plan.rooms.find((candidate) => candidate.id === state.roomId)
          const point =
            !wallSnap && room && store.settings.snapToGrid
              ? snapRoomVertexToRightAngle(
                  delta,
                  room.points,
                  state.index,
                  WALL_ANGLE_SNAP_TOLERANCE_PX / store.viewport.scale,
                )
              : delta
          store.moveRoomVertex(state.roomId, state.index, point)
          patchPreview({ guides })
          return
        }

        case 'wall': {
          const push = wallPushDistance(sub(world, state.startWorld), state.normal)
          const room = store.plan.rooms.find((candidate) => candidate.id === state.roomId)
          if (!room) return
          const count = state.startPoints.length
          const startA = state.startPoints[state.edgeIndex]
          const startB = state.startPoints[(state.edgeIndex + 1) % count]
          if (!startA || !startB) return
          const excluded = new Set([state.roomId])
          if (state.connected) excluded.add(state.connected.roomId)
          const wallSnap = store.settings.snapToObjects
            ? snapWallPushToWalls(
                store.plan,
                state.roomId,
                state.edgeIndex,
                state.startPoints,
                push,
                7 / store.viewport.scale,
                excluded,
              )
            : null
          const snapped = wallSnap
            ? wallSnap.push
            : store.settings.snapToGrid
              ? snapWallPush(startA, state.normal, push, store.settings.gridStep)
              : push
          const shift = { x: state.normal.x * snapped, y: state.normal.y * snapped }
          store.commit((plan) => {
            const target = plan.rooms.find((candidate) => candidate.id === state.roomId)
            if (!target) return
            const first = target.points[state.edgeIndex]
            const second = target.points[(state.edgeIndex + 1) % count]
            if (!first || !second) return
            first.x = startA.x + shift.x
            first.y = startA.y + shift.y
            second.x = startB.x + shift.x
            second.y = startB.y + shift.y

            const connected = state.connected
            if (!connected) return
            const neighbour = plan.rooms.find((candidate) => candidate.id === connected.roomId)
            if (!neighbour) return
            const neighbourCount = connected.startPoints.length
            const neighbourA = connected.startPoints[connected.edgeIndex]
            const neighbourB = connected.startPoints[(connected.edgeIndex + 1) % neighbourCount]
            const targetA = neighbour.points[connected.edgeIndex]
            const targetB = neighbour.points[(connected.edgeIndex + 1) % neighbourCount]
            if (!neighbourA || !neighbourB || !targetA || !targetB) return
            targetA.x = neighbourA.x + shift.x
            targetA.y = neighbourA.y + shift.y
            targetB.x = neighbourB.x + shift.x
            targetB.y = neighbourB.y + shift.y
          })
          patchPreview({ guides: wallSnap ? guidesForSharedWalls(wallSnap.walls) : [] })
          return
        }

        case 'opening': {
          const opening = store.plan.openings.find((candidate) => candidate.id === state.openingId)
          if (!opening) return
          const placement = resolveOpeningPlacement(
            store.plan,
            world,
            opening.width,
            store.settings,
            Infinity,
            { roomId: opening.roomId, edgeIndex: opening.edgeIndex },
          )
          if (!placement) return
          store.updateOpening(state.openingId, placement)
          return
        }

        case 'opening-resize': {
          const opening = store.plan.openings.find((candidate) => candidate.id === state.openingId)
          const room = opening && store.plan.rooms.find((candidate) => candidate.id === opening.roomId)
          const edge = room && opening && roomEdge(room, opening.edgeIndex)
          if (!opening || !edge) return
          const fixed =
            state.handle === 'start'
              ? opening.offset + opening.width / 2
              : opening.offset - opening.width / 2
          const at = dot(sub(world, edge.a), edge.direction)
          const moving = clamp(
            at,
            state.handle === 'start' ? 0 : fixed + 8,
            state.handle === 'start' ? fixed - 8 : edge.length,
          )
          store.updateOpening(state.openingId, {
            width: Math.abs(fixed - moving),
            offset: (fixed + moving) / 2,
          })
          return
        }

        case 'draw-room': {
          const corner = snapPoint(world, snapContext()).delta
          patchPreview({ draftRoom: rectFromPoints(state.origin, corner) })
          return
        }

        case 'measure': {
          const end = snapPoint(world, snapContext()).delta
          if (!state.completesAnchor && !state.moved) {
            const moved = Math.hypot(end.x - state.origin.x, end.y - state.origin.y) * store.viewport.scale >= DRAG_THRESHOLD_PX
            if (!moved) return
            drag.current = { ...state, moved: true }
          }
          patchPreview({ measure: { a: state.origin, b: end } })
          return
        }
      }
    },
    [localPoint, patchPreview, snapContext, updateToolPreview, worldPoint],
  )

  const finishDrag = useCallback(
    (event: ReactPointerEvent) => {
      const store = useEditorStore.getState()
      const state = drag.current
      drag.current = null
      if (!state) return
      release(event.pointerId)

      switch (state.kind) {
        case 'pan': {
          if (state.clearOnClick && !state.moved) store.clearSelection()
          return
        }
        case 'marquee': {
          const marquee = rectFromPoints(state.origin, worldPoint(event))
          if (marquee.width > 1 || marquee.height > 1) {
            const hits = entitiesInRect(store.plan, marquee)
            store.setSelection(
              state.additive ? mergeRefs(store.selection, hits) : hits,
            )
          }
          patchPreview({ marquee: null })
          return
        }
        case 'draw-room': {
          const draft = rectFromPoints(state.origin, snapPoint(worldPoint(event), snapContext()).delta)
          patchPreview({ draftRoom: null })
          if (draft.width >= MIN_ROOM_SIZE && draft.height >= MIN_ROOM_SIZE) {
            const room = createRoomFromRect(
              draft,
              nextRoomName(store.plan.rooms),
              store.settings.wallThickness,
            )
            store.addRoom(room)
            store.setTool('select')
            store.select({ kind: 'room', id: room.id })
          }
          return
        }
        case 'measure': {
          const end = snapPoint(worldPoint(event), snapContext()).delta
          if (state.completesAnchor || state.moved) {
            patchPreview({ measure: { a: state.origin, b: end } })
            measureCycle.current = null
          } else {
            patchPreview({ measure: { a: state.origin, b: state.origin } })
            measureCycle.current = { origin: state.origin }
          }
          return
        }
        default: {
          store.endBatch()
          patchPreview({ guides: [], sizeHint: null })
        }
      }
    },
    [patchPreview, release, snapContext, worldPoint],
  )

  // React registers wheel listeners passively, so bind our own to allow
  // preventDefault (pinch-zoom must not scroll the page).
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault()
      const store = useEditorStore.getState()
      if (event.ctrlKey || event.metaKey) {
        store.zoomAt(localPoint(event), Math.exp(-event.deltaY * 0.0035))
        return
      }
      store.panBy(-event.deltaX, -event.deltaY)
    }
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [hostRef, localPoint])

  const onDoubleClick = useCallback(
    (event: ReactMouseEvent) => {
      const store = useEditorStore.getState()
      if (store.tool !== 'select') return
      const world = worldPoint(event)
      const hit = findNearestWall(store.plan, world, 14 / store.viewport.scale)
      if (hit) {
        store.insertRoomVertex(hit.wall.roomId, hit.wall.index, snapPoint(world, snapContext()).delta)
      }
    },
    [snapContext, worldPoint],
  )

  const cursor = useMemo(() => {
    if (drag.current?.kind === 'pan') return 'grabbing'
    if (spaceHeld) return 'grab'
    if (tool === 'select' && shiftHeld) return 'crosshair'
    if (tool === 'select') return 'move'
    return 'crosshair'
  }, [shiftHeld, spaceHeld, tool])

  return {
    preview,
    scene,
    cursor,
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onDoubleClick,
  }
}

// ---------------------------------------------------------------- helpers

function frameForTouches(points: ReadonlyMap<number, Vec2>) {
  const [a, b] = [...points.values()]
  if (!a || !b) return null
  return {
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    distance: Math.hypot(b.x - a.x, b.y - a.y),
  }
}

function dragUsesHistoryBatch(state: DragState) {
  return !['pan', 'marquee', 'draw-room', 'measure'].includes(state.kind)
}

function guidesForSharedWalls(walls: readonly SharedWall[]): SnapGuide[] {
  return walls.map((wall) => ({ axis: 'segment', a: wall.a, b: wall.b }))
}

/** Align a room vertex with a neighbour to form a horizontal or vertical wall. */
function snapRoomVertexToRightAngle(
  point: Vec2,
  points: readonly Vec2[],
  index: number,
  tolerance: number,
): Vec2 {
  const previous = points[(index - 1 + points.length) % points.length]
  const next = points[(index + 1) % points.length]
  if (!previous || !next) return point

  const candidates = [
    { x: previous.x, y: point.y },
    { x: point.x, y: previous.y },
    { x: next.x, y: point.y },
    { x: point.x, y: next.y },
  ]
  let closest = point
  let distance = tolerance
  for (const candidate of candidates) {
    const gap = Math.hypot(candidate.x - point.x, candidate.y - point.y)
    if (gap < distance) {
      closest = candidate
      distance = gap
    }
  }
  return closest
}

function moveRecipe(origin: MoveOrigin, delta: Vec2) {
  return (plan: Plan) => {
    for (const snapshot of origin.rooms) {
      const room = plan.rooms.find((candidate) => candidate.id === snapshot.id)
      if (!room) continue
      room.points = snapshot.points.map((point) => ({
        x: point.x + delta.x,
        y: point.y + delta.y,
      }))
    }
    for (const snapshot of origin.items) {
      const item = plan.items.find((candidate) => candidate.id === snapshot.id)
      if (item) item.center = { x: snapshot.center.x + delta.x, y: snapshot.center.y + delta.y }
    }
    for (const snapshot of origin.openings) {
      const opening = plan.openings.find((candidate) => candidate.id === snapshot.id)
      if (!opening) continue
      const room = plan.rooms.find((candidate) => candidate.id === opening.roomId)
      const edge = room && roomEdge(room, opening.edgeIndex)
      if (!edge) continue
      opening.offset = clamp(
        snapshot.offset + dot(delta, edge.direction),
        opening.width / 2,
        maxOpeningOffset(edge.length, opening.width),
      )
    }
  }
}

/** Grid-align the wall line itself rather than the drag distance. */
function snapWallPush(start: Vec2, normal: Vec2, push: number, step: number): number {
  const along = dot(start, normal)
  return roundTo(along + push, step) - along
}

function entitiesInRect(plan: Plan, marquee: Rect): SelectionRef[] {
  const refs: SelectionRef[] = []
  for (const room of plan.rooms) {
    if (rectsIntersect(marquee, polygonBounds(roomOuterRing(room)))) {
      refs.push({ kind: 'room', id: room.id })
    }
  }
  for (const item of plan.items) {
    if (rectsIntersect(marquee, polygonBounds(itemCorners(item)))) {
      refs.push({ kind: 'item', id: item.id })
    }
  }
  return refs
}

function mergeRefs(current: readonly SelectionRef[], added: readonly SelectionRef[]) {
  const merged = [...current]
  for (const ref of added) {
    if (!merged.some((candidate) => candidate.kind === ref.kind && candidate.id === ref.id)) {
      merged.push(ref)
    }
  }
  return merged
}
