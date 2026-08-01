import { memo } from 'react'
import { formatArea, type UnitSystem } from '@/core/units'
import { roomArea, roomCentroid } from '@/model/derive'
import type { Plan } from '@/model/types'
import { worldToScreen } from '@/state/transform'
import type { Viewport } from '@/state/types'

export interface LabelsLayerProps {
  plan: Plan
  viewport: Viewport
  unit: UnitSystem
  showNames: boolean
  showAreas: boolean
}

export const LabelsLayer = memo(function LabelsLayer({
  plan,
  viewport,
  unit,
  showNames,
  showAreas,
}: LabelsLayerProps) {
  if (!showNames && !showAreas) return null

  return (
    <g className="labels-layer" pointerEvents="none" textAnchor="middle">
      {plan.rooms.map((room) => {
        const center = worldToScreen(viewport, roomCentroid(room))
        return (
          <g key={room.id}>
            {showNames && (
              <text
                x={center.x}
                y={center.y}
                fontSize={13}
                fontWeight={620}
                fill="var(--text-primary)"
                stroke="var(--surface-paper)"
                strokeWidth={4}
                paintOrder="stroke"
              >
                {room.name}
              </text>
            )}
            {showAreas && (
              <text
                x={center.x}
                y={center.y + (showNames ? 15 : 0)}
                fontSize={11}
                fontWeight={520}
                fill="var(--text-tertiary)"
                stroke="var(--surface-paper)"
                strokeWidth={3.5}
                paintOrder="stroke"
              >
                {formatArea(roomArea(room), unit)}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
})
