import { memo } from 'react'
import { expandRect } from '@/core/geometry'
import type { Viewport } from '@/state/types'
import { visibleWorldRect } from '@/state/transform'

const MIN_LINE_SPACING_PX = 5

export interface GridLayerProps {
  viewport: Viewport
  /** Minor grid step in inches. */
  step: number
  /** Heavier grid step in inches. */
  major: number
}

/**
 * Infinite grid drawn as two SVG patterns over the visible world rect. Line
 * widths are divided by the zoom so they stay hairline-thin at any scale.
 */
export const GridLayer = memo(function GridLayer({ viewport, step, major }: GridLayerProps) {
  const area = expandRect(visibleWorldRect(viewport), major * 2)
  const showMinor = step * viewport.scale >= MIN_LINE_SPACING_PX
  const showMajor = major * viewport.scale >= MIN_LINE_SPACING_PX
  const hairline = 1 / viewport.scale

  return (
    <g className="grid-layer" pointerEvents="none">
      <defs>
        <pattern id="grid-minor" width={step} height={step} patternUnits="userSpaceOnUse">
          <path
            d={`M ${step} 0 L 0 0 0 ${step}`}
            fill="none"
            stroke="var(--grid-minor)"
            strokeWidth={hairline}
          />
        </pattern>
        <pattern id="grid-major" width={major} height={major} patternUnits="userSpaceOnUse">
          <path
            d={`M ${major} 0 L 0 0 0 ${major}`}
            fill="none"
            stroke="var(--grid-major)"
            strokeWidth={hairline * 1.25}
          />
        </pattern>
      </defs>
      {showMinor && (
        <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="url(#grid-minor)" />
      )}
      {showMajor && (
        <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="url(#grid-major)" />
      )}
    </g>
  )
})
