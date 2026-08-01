import { memo } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { midpoint, type Vec2 } from '@/core/geometry'
import { itemCorners, openingFrame, roomEdges, roomRing, wallCorners } from '@/model/derive'
import type { Item, Opening, Plan, Room, Wall } from '@/model/types'
import { worldToScreen } from '@/state/transform'
import type { Viewport } from '@/state/types'
import { useScene } from '../EditorContext'
import type { ResizeHandle } from '../interactions/types'

export interface SelectionLayerProps {
  plan: Plan
  viewport: Viewport
  rooms: readonly Room[]
  walls: readonly Wall[]
  items: readonly Item[]
  openings: readonly Opening[]
  selectedVertex: { roomId: string; index: number } | null
}

const HANDLE = 9
const ROTATE_DISTANCE = 26
const MIN_WALL_HANDLE_PX = 34
const ADD_CORNER_OFFSET = 16

export const SelectionLayer = memo(function SelectionLayer({
  plan,
  viewport,
  rooms,
  walls,
  items,
  openings,
  selectedVertex,
}: SelectionLayerProps) {
  const single = rooms.length + walls.length + items.length + openings.length === 1

  return (
    <g className="selection-layer">
      {items.map((item) => (
        <ItemSelection key={item.id} item={item} viewport={viewport} showHandles={single} />
      ))}
      {rooms.map((room) => (
        <RoomSelection
          key={room.id}
          room={room}
          viewport={viewport}
          showHandles={single || selectedVertex?.roomId === room.id}
          showWallControls={single && !selectedVertex}
          selectedVertex={selectedVertex}
        />
      ))}
      {walls.map((wall) => (
        <WallSelection key={wall.id} wall={wall} viewport={viewport} showHandles={single} />
      ))}
      {openings.map((opening) => (
        <OpeningSelection key={opening.id} plan={plan} opening={opening} viewport={viewport} />
      ))}
    </g>
  )
})

function WallSelection({
  wall,
  viewport,
  showHandles,
}: {
  wall: Wall
  viewport: Viewport
  showHandles: boolean
}) {
  const scene = useScene()
  const corners = wallCorners(wall).map((point) => worldToScreen(viewport, point))
  const endpoints = [wall.a, wall.b].map((point) => worldToScreen(viewport, point))

  return (
    <g>
      <polygon
        points={corners.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        pointerEvents="none"
      />
      {showHandles && endpoints.map((point, index) => (
        <circle
          key={index}
          data-wall-endpoint={`${wall.id}:${index === 0 ? 'a' : 'b'}`}
          cx={point.x}
          cy={point.y}
          r={5.5}
          fill="var(--surface-panel)"
          stroke="var(--accent)"
          strokeWidth={1.5}
          style={{ cursor: 'crosshair' }}
          onPointerDown={(event) => scene.startWallEndpointDrag(wall.id, index === 0 ? 'a' : 'b', event)}
        >
          <title>Drag to move this endpoint</title>
        </circle>
      ))}
    </g>
  )
}

function ItemSelection({
  item,
  viewport,
  showHandles,
}: {
  item: Item
  viewport: Viewport
  showHandles: boolean
}) {
  const scene = useScene()
  const corners = itemCorners(item).map((point) => worldToScreen(viewport, point))
  const [topLeft, topRight, bottomRight, bottomLeft] = corners
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null

  const points = corners.map((point) => `${point.x},${point.y}`).join(' ')
  if (!showHandles || item.locked) {
    return (
      <polygon
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeDasharray={item.locked ? '4 3' : undefined}
        pointerEvents="none"
      />
    )
  }

  const top = midpoint(topLeft, topRight)
  const bottom = midpoint(bottomLeft, bottomRight)
  const left = midpoint(topLeft, bottomLeft)
  const right = midpoint(topRight, bottomRight)

  // Rotate handle sits beyond the top edge, along the item's own "up".
  const upX = top.x - bottom.x
  const upY = top.y - bottom.y
  const upLength = Math.hypot(upX, upY) || 1
  const rotateAt = {
    x: top.x + (upX / upLength) * ROTATE_DISTANCE,
    y: top.y + (upY / upLength) * ROTATE_DISTANCE,
  }

  const handles: { at: Vec2; handle: ResizeHandle }[] = [
    { at: topLeft, handle: 'nw' },
    { at: top, handle: 'n' },
    { at: topRight, handle: 'ne' },
    { at: right, handle: 'e' },
    { at: bottomRight, handle: 'se' },
    { at: bottom, handle: 's' },
    { at: bottomLeft, handle: 'sw' },
    { at: left, handle: 'w' },
  ]

  return (
    <g>
      <polygon
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        pointerEvents="none"
      />
      <line
        x1={top.x}
        y1={top.y}
        x2={rotateAt.x}
        y2={rotateAt.y}
        stroke="var(--accent)"
        strokeWidth={1}
        pointerEvents="none"
      />
      <circle
        data-item-rotate={item.id}
        cx={rotateAt.x}
        cy={rotateAt.y}
        r={5.5}
        fill="var(--surface-panel)"
        stroke="var(--accent)"
        strokeWidth={1.5}
        style={{ cursor: 'grab' }}
        onPointerDown={(event) => scene.startItemRotate(item.id, event)}
      />
      {handles.map(({ at, handle }) => (
        <rect
          key={handle}
          x={at.x - HANDLE / 2}
          y={at.y - HANDLE / 2}
          width={HANDLE}
          height={HANDLE}
          rx={1.5}
          fill="var(--surface-panel)"
          stroke="var(--accent)"
          strokeWidth={1.5}
          style={{ cursor: cursorForHandle(handle, item.rotation) }}
          onPointerDown={(event) => scene.startItemResize(item.id, handle, event)}
        />
      ))}
    </g>
  )
}

function RoomSelection({
  room,
  viewport,
  showHandles,
  showWallControls,
  selectedVertex,
}: {
  room: Room
  viewport: Viewport
  showHandles: boolean
  showWallControls: boolean
  selectedVertex: { roomId: string; index: number } | null
}) {
  const scene = useScene()
  const ring = roomRing(room)
  const screen = ring.map((point) => worldToScreen(viewport, point))

  if (!showHandles) {
    return (
      <polygon
        points={screen.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        pointerEvents="none"
      />
    )
  }

  const edges = roomEdges(room)

  return (
    <g>
      {showWallControls && edges.map((edge) => {
        if (edge.length * viewport.scale < MIN_WALL_HANDLE_PX) return null
        const center = worldToScreen(viewport, midpoint(edge.a, edge.b))
        const addAt = {
          x: center.x + edge.normal.x * ADD_CORNER_OFFSET,
          y: center.y + edge.normal.y * ADD_CORNER_OFFSET,
        }
        return (
          <g key={`wall-${edge.index}`}>
            <rect
              x={center.x - 9}
              y={center.y - 4}
              width={18}
              height={8}
              rx={3}
              fill="var(--surface-panel)"
              stroke="var(--accent)"
              strokeWidth={1.5}
              transform={`rotate(${edge.angleDegrees} ${center.x} ${center.y})`}
              style={{ cursor: cursorForWall(edge.angleDegrees) }}
              onPointerDown={(event) => scene.startWallDrag(room.id, edge.index, event)}
            >
              <title>Drag to move this wall</title>
            </rect>
            <circle
              cx={addAt.x}
              cy={addAt.y}
              r={7}
              fill="var(--accent)"
              style={{ cursor: 'copy' }}
              onPointerDown={(event) =>
                scene.startVertexInsert(room.id, edge.index, midpoint(edge.a, edge.b), event)
              }
            >
              <title>Click to add a corner, or drag to place it</title>
            </circle>
            <path
              d={`M ${addAt.x - 3} ${addAt.y} H ${addAt.x + 3} M ${addAt.x} ${addAt.y - 3} V ${addAt.y + 3}`}
              fill="none"
              stroke="var(--text-inverse)"
              strokeWidth={1.5}
              strokeLinecap="round"
              pointerEvents="none"
            />
          </g>
        )
      })}
      {screen.map((point, index) => {
        const isSelected = selectedVertex?.roomId === room.id && selectedVertex.index === index
        const removeAt = { x: point.x + 15, y: point.y - 15 }
        return (
          <g key={`vertex-${index}`}>
            <g
              className={`room-vertex${isSelected ? ' room-vertex--selected' : ''}`}
              style={{ cursor: 'pointer' }}
              onPointerDown={(event: ReactPointerEvent) => {
                if (event.altKey) scene.removeVertex(room.id, index, event)
                else scene.startVertexDrag(room.id, index, event)
              }}
            >
              <circle
                className="room-vertex__target"
                cx={point.x}
                cy={point.y}
                r={isSelected ? 6 : 5}
                fill={isSelected ? 'var(--accent)' : 'var(--surface-panel)'}
                stroke="var(--accent)"
                strokeWidth={1.5}
              />
              <circle
                className="room-vertex__cue"
                cx={point.x}
                cy={point.y}
                r={1.75}
                fill={isSelected ? 'var(--surface-panel)' : 'var(--accent)'}
                pointerEvents="none"
              />
              <title>Click to select, then drag to move this corner</title>
            </g>
            {isSelected && ring.length > 3 && (
              <g
                style={{ cursor: 'pointer' }}
                onPointerDown={(event) => scene.removeVertex(room.id, index, event)}
              >
                <circle
                  cx={removeAt.x}
                  cy={removeAt.y}
                  r={7}
                  fill="var(--danger)"
                  stroke="var(--surface-panel)"
                  strokeWidth={1.5}
                />
                <path
                  d={`M ${removeAt.x - 2.5} ${removeAt.y - 2.5} L ${removeAt.x + 2.5} ${removeAt.y + 2.5} M ${removeAt.x + 2.5} ${removeAt.y - 2.5} L ${removeAt.x - 2.5} ${removeAt.y + 2.5}`}
                  stroke="var(--text-inverse)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
                <title>Delete this corner</title>
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}

function OpeningSelection({
  plan,
  opening,
  viewport,
}: {
  plan: Plan
  opening: Opening
  viewport: Viewport
}) {
  const scene = useScene()
  const frame = openingFrame(plan, opening)
  if (!frame) return null
  const start = worldToScreen(viewport, frame.start)
  const end = worldToScreen(viewport, frame.end)
  const cursor = cursorForOpeningResize(frame.tangent)
  return (
    <g>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="var(--accent)"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.75}
        pointerEvents="none"
      />
      {[start, end].map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={5}
          fill="var(--surface-panel)"
          stroke="var(--accent)"
          strokeWidth={1.5}
          style={{ cursor }}
          onPointerDown={(event) =>
            scene.startOpeningResize(opening.id, index === 0 ? 'start' : 'end', event)
          }
        >
          <title>Drag to resize {opening.kind.includes('door') ? 'door' : 'window'}</title>
        </circle>
      ))}
    </g>
  )
}

const HANDLE_ANGLES: Record<ResizeHandle, number> = {
  n: 0,
  ne: 45,
  e: 90,
  se: 135,
  s: 180,
  sw: 225,
  w: 270,
  nw: 315,
}

const CURSORS = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize']

/** Pick a resize cursor that matches the handle's on-screen orientation. */
function cursorForHandle(handle: ResizeHandle, rotation: number): string {
  const angle = ((HANDLE_ANGLES[handle] + rotation) % 180 + 180) % 180
  return CURSORS[Math.round(angle / 45) % 4] ?? 'pointer'
}

function cursorForWall(angleDegrees: number): string {
  // CURSORS is indexed by the orientation of the edge being resized: an
  // east-west edge gets a north-south cursor, and vice versa. Using the wall's
  // normal here rotates that relationship a second time.
  const angle = ((angleDegrees % 180) + 180) % 180
  return CURSORS[Math.round(angle / 45) % 4] ?? 'move'
}

function cursorForOpeningResize(tangent: Vec2): string {
  return Math.abs(tangent.x) >= Math.abs(tangent.y) ? 'ew-resize' : 'ns-resize'
}
