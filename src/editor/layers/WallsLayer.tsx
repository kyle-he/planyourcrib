import { memo } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { wallCorners } from '@/model/derive'
import type { Wall } from '@/model/types'
import { usePlan } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { useScene } from '../EditorContext'

export const WallsLayer = memo(function WallsLayer() {
  const plan = usePlan()
  return (
    <g className="walls-layer">
      {plan.walls.map((wall) => <FreestandingWall key={wall.id} wall={wall} />)}
    </g>
  )
})

function FreestandingWall({ wall }: { wall: Wall }) {
  const scene = useScene()
  const selected = useEditorStore((state) =>
    state.selection.some((ref) => ref.kind === 'wall' && ref.id === wall.id),
  )
  const hovered = useEditorStore(
    (state) => state.hover?.kind === 'wall' && state.hover.id === wall.id,
  )
  const points = wallCorners(wall).map((point) => `${point.x},${point.y}`).join(' ')
  const startMove = (event: ReactPointerEvent<SVGElement>) =>
    scene.startMove({ kind: 'wall', id: wall.id }, event)

  return (
    <g
      data-freestanding-wall={wall.id}
      aria-label="Freestanding wall"
      onPointerDown={startMove}
      onPointerEnter={() => scene.hover({ kind: 'wall', id: wall.id })}
      onPointerLeave={() => scene.hover(null)}
      style={{ cursor: 'pointer' }}
    >
      <polygon
        points={points}
        fill="var(--wall-fill)"
        stroke={selected ? 'var(--accent)' : hovered ? 'var(--accent-border)' : 'none'}
        strokeWidth={selected ? 1.5 : 1}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={wall.a.x}
        y1={wall.a.y}
        x2={wall.b.x}
        y2={wall.b.y}
        stroke="transparent"
        strokeWidth={12}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  )
}
