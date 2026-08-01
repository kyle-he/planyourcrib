import { getGlyph, usesCustomFootprint } from '@/editor/glyphs'
import type { ItemTemplate } from '@/model/catalog'

export interface ItemArtProps {
  template: ItemTemplate
  height?: number
}

/**
 * Catalog thumbnail. Reuses the exact same glyphs as the canvas, scaled to fit,
 * so the palette always matches what lands in the plan.
 */
export function ItemArt({ template, height = 40 }: ItemArtProps) {
  const { width, depth } = template
  const pad = Math.max(width, depth) * 0.06
  return (
    <svg
      className="catalog-card__art"
      height={height}
      viewBox={`${-width / 2 - pad} ${-depth / 2 - pad} ${width + pad * 2} ${depth + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {!usesCustomFootprint(template.glyph) && (
        <rect
          x={-width / 2}
          y={-depth / 2}
          width={width}
          height={depth}
          rx={1.5}
          fill={template.color}
          stroke="currentColor"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {getGlyph(template.glyph)({ w: width, h: depth, fill: template.color })}
    </svg>
  )
}
