import { memo } from 'react'
import { expandRect } from '@/core/geometry'
import type { Viewport } from '@/state/types'
import { visibleWorldRect } from '@/state/transform'

export interface GridLayerProps {
  viewport: Viewport
  /** Exact grid cell size in inches. */
  step: number
  /** Number of ordinary cells between emphasized superlines. */
  superlineEvery: number
}

/**
 * Infinite grid drawn at the exact configured step. Zoom changes only the
 * apparent size of each cell; it never adds or removes subdivisions. Line
 * widths are divided by the zoom so they stay hairline-thin.
 */
export const GridLayer = memo(function GridLayer({ viewport, step, superlineEvery }: GridLayerProps) {
  const superStep = step * superlineEvery
  const area = expandRect(visibleWorldRect(viewport), superStep * 2)
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
        <pattern id="grid-super" width={superStep} height={superStep} patternUnits="userSpaceOnUse">
          <path
            d={`M ${superStep} 0 L 0 0 0 ${superStep}`}
            fill="none"
            stroke="var(--grid-major)"
            strokeWidth={hairline * 1.4}
          />
        </pattern>
      </defs>
      <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="url(#grid-step)" />
      <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="url(#grid-super)" />
    </g>
  )
})
