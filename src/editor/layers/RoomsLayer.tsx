import { memo } from 'react'
import type { Vec2 } from '@/core/geometry'
import { roomEdges, roomRing } from '@/model/derive'
import type { Room } from '@/model/types'
import { analyzeWallTopology, roomEdgeKey } from '@/model/wallTopology'
import { usePlan } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { useScene } from '../EditorContext'

const toPath = (points: readonly Vec2[]): string =>
  points.length === 0
    ? ''
    : `M ${points.map((point) => `${round(point.x)} ${round(point.y)}`).join(' L ')} Z`

const round = (value: number) => Math.round(value * 100) / 100

/** Floors first, then wall bands, so neighbouring rooms share clean wall lines. */
export const RoomsLayer = memo(function RoomsLayer() {
  const plan = usePlan()
  const topology = analyzeWallTopology(plan)
  const hiddenDuplicateEdges = new Set<string>()
  const sharedEdgeCounts = new Map<string, number>()
  for (const shared of topology.sharedWalls) {
    const firstKey = roomEdgeKey(shared.first.roomId, shared.first.edgeIndex)
    const secondKey = roomEdgeKey(shared.second.roomId, shared.second.edgeIndex)
    sharedEdgeCounts.set(firstKey, (sharedEdgeCounts.get(firstKey) ?? 0) + 1)
    sharedEdgeCounts.set(secondKey, (sharedEdgeCounts.get(secondKey) ?? 0) + 1)
    if (shared.fullEdgeMatch) {
      // Both rooms describe the same wall band. Render its first copy only.
      hiddenDuplicateEdges.add(secondKey)
    }
  }
  return (
    <g className="rooms-layer">
      {plan.rooms.map((room) => (
        <RoomFloor key={room.id} room={room} />
      ))}
      {plan.rooms.map((room) => (
        <RoomWalls
          key={room.id}
          room={room}
          hiddenEdges={hiddenDuplicateEdges}
          sharedEdgeCounts={sharedEdgeCounts}
        />
      ))}
    </g>
  )
})

function RoomFloor({ room }: { room: Room }) {
  const scene = useScene()
  const selected = useEditorStore((state) =>
    state.selection.some((ref) => ref.kind === 'room' && ref.id === room.id),
  )
  const hovered = useEditorStore(
    (state) => state.hover?.kind === 'room' && state.hover.id === room.id,
  )

  return (
    <path
      d={toPath(roomRing(room))}
      fill={room.floor}
      stroke={selected ? 'var(--accent)' : hovered ? 'var(--accent-border)' : 'none'}
      strokeWidth={selected ? 1.5 : 1}
      vectorEffect="non-scaling-stroke"
      onPointerDown={(event) => scene.startMove({ kind: 'room', id: room.id }, event)}
      onPointerEnter={() => scene.hover({ kind: 'room', id: room.id })}
      onPointerLeave={() => scene.hover(null)}
      style={{ cursor: 'pointer' }}
    />
  )
}

function RoomWalls({
  room,
  hiddenEdges,
  sharedEdgeCounts,
}: {
  room: Room
  hiddenEdges: ReadonlySet<string>
  sharedEdgeCounts: ReadonlyMap<string, number>
}) {
  const scene = useScene()
  const edges = roomEdges(room)
  return (
    <g>
      {edges.map((edge) => {
        if (hiddenEdges.has(roomEdgeKey(room.id, edge.index))) return null
        return (
          <path
            key={edge.index}
            data-wall-room={room.id}
            data-wall-edge={edge.index}
            data-wall-shared-count={sharedEdgeCounts.get(roomEdgeKey(room.id, edge.index)) ?? 0}
            d={toPath([edge.a, edge.b, edge.outerB, edge.outerA])}
            fill="var(--wall-fill)"
            stroke="none"
            onPointerDown={(event) => scene.startMove({ kind: 'room', id: room.id }, event)}
            onPointerEnter={() => scene.hover({ kind: 'room', id: room.id })}
            onPointerLeave={() => scene.hover(null)}
            style={{ cursor: 'pointer' }}
          />
        )
      })}
    </g>
  )
}
