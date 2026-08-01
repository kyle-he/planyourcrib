import { memo } from 'react'
import { expandRect } from '@/core/geometry'
import type { Viewport } from '@/state/types'
import { visibleWorldRect } from '@/state/transform'

export interface GridLayerProps {
  viewport: Viewport
  /** Exact grid cell size in inches. */
  step: number
}

/**
 * Infinite grid drawn at the exact configured step. Zoom changes only the
 * apparent size of each cell; it never adds or removes subdivisions. Line
 * widths are divided by the zoom so they stay hairline-thin.
 */
export const GridLayer = memo(function GridLayer({ viewport, step }: GridLayerProps) {
  const area = expandRect(visibleWorldRect(viewport), step * 2)
  const hairline = 1 / viewport.scale

  return (
    <g className="grid-layer" pointerEvents="none">
      <defs>
        <pattern id="grid-step" width={step} height={step} patternUnits="userSpaceOnUse">
          <path
            d={`M ${step} 0 L 0 0 0 ${step}`}
            fill="none"
            stroke="var(--grid-minor)"
            strokeWidth={hairline}
          />
        </pattern>
      </defs>
      <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="url(#grid-step)" />
    </g>
  )
})
