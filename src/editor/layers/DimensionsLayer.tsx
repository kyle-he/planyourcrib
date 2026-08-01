import { memo } from 'react'
import { polygonCentroid, rectsIntersect, type Rect, type Vec2 } from '@/core/geometry'
import { formatLength, type UnitSystem } from '@/core/units'
import { itemCorners, roomEdges, type WallEdge } from '@/model/derive'
import type { Item, Plan, Room } from '@/model/types'
import { analyzeWallTopology, roomEdgeKey } from '@/model/wallTopology'
import { worldToScreen } from '@/state/transform'
import type { Viewport } from '@/state/types'
import { DimensionLine } from './DimensionLine'

export interface DimensionsLayerProps {
  plan: Plan
  viewport: Viewport
  unit: UnitSystem
  showRoomDimensions: boolean
  /** Selected rooms receive stronger labels but do not hide other dimensions. */
  measuredRooms: readonly Room[]
  /** Items to annotate (normally just the selection). */
  measuredItems: readonly Item[]
}

/**
 * Dimension annotations live in screen space so text and offsets stay a
 * constant size regardless of zoom.
 */
export const DimensionsLayer = memo(function DimensionsLayer({
  plan,
  viewport,
  unit,
  showRoomDimensions,
  measuredRooms,
  measuredItems,
}: DimensionsLayerProps) {
  const toScreen = (point: Vec2) => worldToScreen(viewport, point)
  const measuredRoomIds = new Set(measuredRooms.map((room) => room.id))
  const roomDimensions = collectRoomDimensions(plan, viewport, unit, measuredRoomIds)

  return (
    <g className="dimensions-layer" pointerEvents="none">
      {showRoomDimensions &&
        roomDimensions.map(({ room, edge, label }) => (
          <g
            key={`${room.id}:${edge.index}`}
            data-dimension-room={room.id}
            data-dimension-edge={edge.index}
          >
            <DimensionLine
              a={toScreen(edge.a)}
              b={toScreen(edge.b)}
              direction={edge.normal}
              offset={room.wallThickness * viewport.scale + 18}
              label={label}
              emphasis={measuredRoomIds.has(room.id)}
            />
          </g>
        ))}

      {measuredItems.map((item) => (
        <ItemDimensions key={item.id} item={item} viewport={viewport} unit={unit} />
      ))}
    </g>
  )
})

interface RoomDimensionCandidate {
  room: Room
  edge: WallEdge
  key: string
  label: string
  labelBounds: Rect
  priority: number
}

function collectRoomDimensions(
  plan: Plan,
  viewport: Viewport,
  unit: UnitSystem,
  selectedRoomIds: ReadonlySet<string>,
): RoomDimensionCandidate[] {
  const candidates = plan.rooms.flatMap((room) => {
    return roomEdges(room).flatMap((edge) => {
      const label = formatLength(edge.length, unit)
      return [{
        room,
        edge,
        key: roomEdgeKey(room.id, edge.index),
        label,
        labelBounds: dimensionLabelBounds(room, edge, label, viewport),
        priority: dimensionSidePriority(room, edge, viewport) * 2 +
          (selectedRoomIds.has(room.id) ? 0 : 1),
      }]
    })
  })

  const hiddenMergedEdges = new Set<string>()
  for (const shared of analyzeWallTopology(plan).sharedWalls) {
    const firstKey = roomEdgeKey(shared.first.roomId, shared.first.edgeIndex)
    const secondKey = roomEdgeKey(shared.second.roomId, shared.second.edgeIndex)
    // A shared wall is already communicated by the joined wall rendering.
    // Suppress both participating dimensions, including partial wall merges.
    hiddenMergedEdges.add(firstKey)
    hiddenMergedEdges.add(secondKey)
  }

  // Every ordinary edge starts visible. Cull only merged walls or labels
  // whose actual screen-space boxes touch, with top/left winning collisions.
  candidates.sort((a, b) => a.priority - b.priority)
  const accepted: RoomDimensionCandidate[] = []
  for (const candidate of candidates) {
    if (hiddenMergedEdges.has(candidate.key)) continue
    if (accepted.some((current) => rectsIntersect(current.labelBounds, candidate.labelBounds))) continue
    accepted.push(candidate)
  }
  return accepted
}

/** Priority order for collisions: top, left, bottom, right. */
function dimensionSidePriority(room: Room, edge: WallEdge, viewport: Viewport): number {
  const roomCenter = worldToScreen(viewport, polygonCentroid(room.points))
  const label = dimensionLabelCenter(room, edge, viewport)
  const dx = label.x - roomCenter.x
  const dy = label.y - roomCenter.y
  if (Math.abs(dy) >= Math.abs(dx)) return dy <= 0 ? 0 : 2
  return dx <= 0 ? 1 : 3
}

function dimensionLabelCenter(room: Room, edge: WallEdge, viewport: Viewport): Vec2 {
  const a = worldToScreen(viewport, edge.a)
  const b = worldToScreen(viewport, edge.b)
  const offset = room.wallThickness * viewport.scale + 18
  return {
    x: (a.x + b.x) / 2 + edge.normal.x * offset,
    y: (a.y + b.y) / 2 + edge.normal.y * offset,
  }
}

function dimensionLabelBounds(
  room: Room,
  edge: WallEdge,
  label: string,
  viewport: Viewport,
): Rect {
  const center = dimensionLabelCenter(room, edge, viewport)
  const a = worldToScreen(viewport, edge.a)
  const b = worldToScreen(viewport, edge.b)
  const angle = Math.atan2(b.y - a.y, b.x - a.x)
  const width = label.length * 6.5 + 8
  const height = 16
  const boxWidth = Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height + 6
  const boxHeight = Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height + 6
  return {
    x: center.x - boxWidth / 2,
    y: center.y - boxHeight / 2,
    width: boxWidth,
    height: boxHeight,
  }
}

function ItemDimensions({
  item,
  viewport,
  unit,
}: {
  item: Item
  viewport: Viewport
  unit: UnitSystem
}) {
  const [topLeft, topRight, bottomRight, bottomLeft] = itemCorners(item)
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null

  const toScreen = (point: Vec2) => worldToScreen(viewport, point)
  // Annotate the front and right sides: an item's back is usually against a
  // wall, where the dimension line would collide with the wall graphics.
  const down = unitVector(bottomLeft, topLeft)
  const right = unitVector(topRight, topLeft)

  return (
    <>
      <DimensionLine
        a={toScreen(bottomLeft)}
        b={toScreen(bottomRight)}
        direction={down}
        offset={16}
        label={formatLength(item.width, unit)}
        emphasis
      />
      <DimensionLine
        a={toScreen(topRight)}
        b={toScreen(bottomRight)}
        direction={right}
        offset={16}
        label={formatLength(item.depth, unit)}
        emphasis
      />
    </>
  )
}

/** Unit vector pointing from `to` towards `from` (i.e. away from the shape). */
function unitVector(from: Vec2, to: Vec2): Vec2 {
  const dx = from.x - to.x
  const dy = from.y - to.y
  const length = Math.hypot(dx, dy) || 1
  return { x: dx / length, y: dy / length }
}
