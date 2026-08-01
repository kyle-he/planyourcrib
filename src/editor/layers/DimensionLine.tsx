import { memo } from 'react'
import { normalize, sub, toDegrees, type Vec2 } from '@/core/geometry'

export interface DimensionLineProps {
  /** Screen-space endpoints. */
  a: Vec2
  b: Vec2
  label: string
  /** Screen-space unit vector the dimension is pushed along. */
  direction: Vec2
  /** Distance in pixels from the measured edge. */
  offset?: number
  color?: string
  emphasis?: boolean
}

const TICK = 4
const LABEL_GAP = 9

/** Architectural dimension line: witness lines, end ticks and a centred label. */
export const DimensionLine = memo(function DimensionLine({
  a,
  b,
  label,
  direction,
  offset = 20,
  color = 'var(--dimension)',
  emphasis = false,
}: DimensionLineProps) {
  const shift = { x: direction.x * offset, y: direction.y * offset }
  const start = { x: a.x + shift.x, y: a.y + shift.y }
  const end = { x: b.x + shift.x, y: b.y + shift.y }
  const along = normalize(sub(end, start))
  if (!Number.isFinite(along.x) || (along.x === 0 && along.y === 0)) return null

  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  let angle = toDegrees(Math.atan2(along.y, along.x))
  if (angle > 90 || angle < -90) angle += 180

  const tick = { x: along.x * TICK, y: along.y * TICK }
  const perpendicular = { x: -along.y * TICK, y: along.x * TICK }

  return (
    <g stroke={color} strokeWidth={1} fill="none" shapeRendering="geometricPrecision">
      {/* Witness lines back to the measured edge. */}
      <line x1={a.x + shift.x * 0.15} y1={a.y + shift.y * 0.15} x2={start.x} y2={start.y} opacity={0.45} />
      <line x1={b.x + shift.x * 0.15} y1={b.y + shift.y * 0.15} x2={end.x} y2={end.y} opacity={0.45} />
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
      <line
        x1={start.x - tick.x + perpendicular.x}
        y1={start.y - tick.y + perpendicular.y}
        x2={start.x + tick.x - perpendicular.x}
        y2={start.y + tick.y - perpendicular.y}
      />
      <line
        x1={end.x - tick.x + perpendicular.x}
        y1={end.y - tick.y + perpendicular.y}
        x2={end.x + tick.x - perpendicular.x}
        y2={end.y + tick.y - perpendicular.y}
      />
      <text
        x={mid.x}
        y={mid.y}
        transform={`rotate(${angle} ${mid.x} ${mid.y}) translate(0 ${-LABEL_GAP})`}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={emphasis ? 12 : 11}
        fontWeight={emphasis ? 650 : 550}
        fill={emphasis ? 'var(--dimension-strong)' : color}
        stroke="var(--surface-paper)"
        strokeWidth={3.5}
        paintOrder="stroke"
        style={{ pointerEvents: 'none' }}
      >
        {label}
      </text>
    </g>
  )
})
