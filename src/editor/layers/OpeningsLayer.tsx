import { memo } from 'react'
import { findRoom, openingFrame } from '@/model/derive'
import type { Opening, OpeningKind, Plan } from '@/model/types'
import {
  analyzeWallTopology,
  otherSideOfSharedWall,
  sharedWallAtPoint,
  type WallTopology,
} from '@/model/wallTopology'
import { usePlan } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { useScene } from '../EditorContext'

/**
 * Openings are drawn *over* the wall band: a gap filled with the floor colour
 * erases the wall, then the door/window symbol is drawn on top. This avoids
 * boolean geometry while producing a conventional floor-plan look.
 */
export const OpeningsLayer = memo(function OpeningsLayer() {
  const plan = usePlan()
  const topology = analyzeWallTopology(plan)
  return (
    <g className="openings-layer">
      {plan.openings.map((opening) => (
        <OpeningShape key={opening.id} plan={plan} opening={opening} topology={topology} />
      ))}
    </g>
  )
})

function OpeningShape({
  plan,
  opening,
  topology,
}: {
  plan: Plan
  opening: Opening
  topology: WallTopology
}) {
  const scene = useScene()
  const selected = useEditorStore((state) =>
    state.selection.some((ref) => ref.kind === 'opening' && ref.id === opening.id),
  )
  const hovered = useEditorStore(
    (state) => state.hover?.kind === 'opening' && state.hover.id === opening.id,
  )

  const frame = openingFrame(plan, opening)
  const room = findRoom(plan, opening.roomId)
  if (!frame || !room) return null

  const sharedWall = sharedWallAtPoint(
    topology,
    opening.roomId,
    opening.edgeIndex,
    frame.center,
  )
  const otherSide = sharedWall && otherSideOfSharedWall(sharedWall, opening.roomId)
  const otherRoom = otherSide && findRoom(plan, otherSide.roomId)
  const width = frame.width
  const thickness = sharedWall?.thickness ?? frame.thickness
  const half = width / 2
  const accent = selected ? 'var(--accent)' : hovered ? 'var(--accent-hover)' : 'var(--wall-stroke)'

  return (
    <g
      transform={`translate(${frame.center.x} ${frame.center.y}) rotate(${frame.angleDegrees})`}
      onPointerDown={(event) => scene.startMove({ kind: 'opening', id: opening.id }, event)}
      onPointerEnter={() => scene.hover({ kind: 'opening', id: opening.id })}
      onPointerLeave={() => scene.hover(null)}
      style={{ cursor: 'pointer' }}
    >
      {/* Erase the wall across the opening. Shared doorways carry each room's
          floor to the wall center instead of painting one room over the other. */}
      {otherRoom ? (
        <>
          <rect x={-half} y={0} width={width} height={thickness / 2} fill={room.floor} />
          <rect
            x={-half}
            y={-thickness / 2}
            width={width}
            height={thickness / 2}
            fill={otherRoom.floor}
          />
        </>
      ) : (
        <rect x={-half} y={-thickness / 2} width={width} height={thickness} fill={room.floor} />
      )}
      {/* Jambs. */}
      <line
        x1={-half}
        y1={-thickness / 2}
        x2={-half}
        y2={thickness / 2}
        stroke={accent}
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={half}
        y1={-thickness / 2}
        x2={half}
        y2={thickness / 2}
        stroke={accent}
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
      <OpeningSymbol
        kind={opening.kind}
        width={width}
        thickness={thickness}
        flipHinge={opening.flipHinge}
        flipInward={opening.flipInward}
        color={accent}
      />
      {/* Generous invisible hit area. */}
      <rect
        x={-half}
        y={-thickness}
        width={width}
        height={thickness * 2}
        fill="transparent"
        stroke="none"
      />
    </g>
  )
}

interface SymbolProps {
  kind: OpeningKind
  width: number
  thickness: number
  flipHinge: boolean
  flipInward: boolean
  color: string
}

const STROKE = {
  fill: 'none',
  strokeWidth: 1.2,
  strokeLinecap: 'round',
  vectorEffect: 'non-scaling-stroke',
} as const

function OpeningSymbol({ kind, width, thickness, flipHinge, flipInward, color }: SymbolProps) {
  const half = width / 2
  // Local +y points into the host room (see openingFrame).
  const swing = flipInward ? 1 : -1

  switch (kind) {
    case 'window':
      return (
        <g stroke={color} {...STROKE}>
          <line x1={-half} y1={0} x2={half} y2={0} />
          <line x1={-half} y1={-thickness / 2} x2={half} y2={-thickness / 2} />
          <line x1={-half} y1={thickness / 2} x2={half} y2={thickness / 2} />
        </g>
      )

    case 'bay-window': {
      const depth = Math.min(width * 0.22, 24) * swing
      return (
        <g stroke={color} {...STROKE}>
          <path
            d={`M ${-half} 0 L ${-half + width * 0.2} ${depth} L ${half - width * 0.2} ${depth} L ${half} 0`}
          />
          <line x1={-half} y1={0} x2={half} y2={0} opacity={0.4} />
        </g>
      )
    }

    case 'archway':
      return (
        <g stroke={color} {...STROKE}>
          <line x1={-half} y1={0} x2={half} y2={0} strokeDasharray="6 4" opacity={0.7} />
        </g>
      )

    case 'sliding-door': {
      const panel = width / 2
      const offset = thickness * 0.28
      return (
        <g stroke={color} {...STROKE}>
          <line x1={-half} y1={-offset} x2={-half + panel} y2={-offset} strokeWidth={2.2} />
          <line x1={half - panel} y1={offset} x2={half} y2={offset} strokeWidth={2.2} />
        </g>
      )
    }

    case 'pocket-door':
      return (
        <g stroke={color} {...STROKE}>
          <line x1={-half} y1={0} x2={half * 0.2} y2={0} strokeWidth={2.2} />
          <line x1={half * 0.2} y1={0} x2={half} y2={0} strokeDasharray="4 3" opacity={0.5} />
        </g>
      )

    case 'double-door': {
      const leaf = width / 2
      return (
        <g stroke={color} {...STROKE}>
          <DoorLeaf hinge={-half} direction={1} leaf={leaf} swing={swing} />
          <DoorLeaf hinge={half} direction={-1} leaf={leaf} swing={swing} />
        </g>
      )
    }

    case 'door':
    default: {
      const hinge = flipHinge ? half : -half
      return (
        <g stroke={color} {...STROKE}>
          <DoorLeaf hinge={hinge} direction={flipHinge ? -1 : 1} leaf={width} swing={swing} />
        </g>
      )
    }
  }
}

/** A door panel plus its swing arc, hinged at `hinge` on the wall centerline. */
function DoorLeaf({
  hinge,
  direction,
  leaf,
  swing,
}: {
  hinge: number
  direction: 1 | -1
  leaf: number
  swing: number
}) {
  const tipY = swing * leaf
  const closedX = hinge + direction * leaf
  const sweep = direction * swing > 0 ? 1 : 0
  return (
    <g>
      <line x1={hinge} y1={0} x2={hinge} y2={tipY} strokeWidth={2} />
      <path
        d={`M ${closedX} 0 A ${leaf} ${leaf} 0 0 ${sweep} ${hinge} ${tipY}`}
        opacity={0.55}
      />
    </g>
  )
}
