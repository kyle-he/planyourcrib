import type { ReactNode } from 'react'
import type { GlyphKey } from '@/model/catalog'

/**
 * Item artwork. Every glyph draws inside a box centred on the origin spanning
 * (-w/2, -h/2) to (w/2, h/2), in inches, with the item's "back" at -y. Strokes
 * use non-scaling-stroke so detail stays legible at any zoom, and the same
 * glyphs are reused for the catalog thumbnails.
 */
export interface GlyphProps {
  w: number
  h: number
  fill?: string
  outlineWidth?: number
}

type Glyph = (props: GlyphProps) => ReactNode

const DETAIL = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
  vectorEffect: 'non-scaling-stroke',
} as const

const SOFT = { ...DETAIL, opacity: 0.55 } as const

/** Inset rectangle helper. */
function box(w: number, h: number, inset: number, radius = 1) {
  return {
    x: -w / 2 + inset,
    y: -h / 2 + inset,
    width: Math.max(0, w - inset * 2),
    height: Math.max(0, h - inset * 2),
    rx: radius,
  }
}

const GLYPHS: Record<GlyphKey, Glyph> = {
  box: () => null,

  bed: ({ w, h }) => {
    const headboard = Math.min(5, h * 0.08)
    const pillowH = Math.min(14, h * 0.2)
    const pillowW = (w - headboard * 3) / 2
    return (
      <g>
        <line x1={-w / 2} y1={-h / 2 + headboard} x2={w / 2} y2={-h / 2 + headboard} {...DETAIL} />
        {w > 45 ? (
          <>
            <rect
              {...DETAIL}
              x={-w / 2 + headboard}
              y={-h / 2 + headboard + 2}
              width={pillowW}
              height={pillowH}
              rx={3}
            />
            <rect
              {...DETAIL}
              x={headboard / 2}
              y={-h / 2 + headboard + 2}
              width={pillowW}
              height={pillowH}
              rx={3}
            />
          </>
        ) : (
          <rect
            {...DETAIL}
            x={-w / 2 + headboard}
            y={-h / 2 + headboard + 2}
            width={w - headboard * 2}
            height={pillowH}
            rx={3}
          />
        )}
        <line
          x1={-w / 2}
          y1={-h / 2 + h * 0.42}
          x2={w / 2}
          y2={-h / 2 + h * 0.42}
          {...SOFT}
        />
        <line x1={-w / 2} y1={h / 2 - 4} x2={w / 2} y2={h / 2 - 4} {...SOFT} />
      </g>
    )
  },

  sofa: ({ w, h }) => {
    const back = h * 0.28
    const arm = Math.min(8, w * 0.12)
    const seats = w > 70 ? 3 : w > 46 ? 2 : 1
    const seatW = (w - arm * 2) / seats
    return (
      <g>
        <line x1={-w / 2} y1={-h / 2 + back} x2={w / 2} y2={-h / 2 + back} {...DETAIL} />
        <line x1={-w / 2 + arm} y1={-h / 2 + back} x2={-w / 2 + arm} y2={h / 2} {...DETAIL} />
        <line x1={w / 2 - arm} y1={-h / 2 + back} x2={w / 2 - arm} y2={h / 2} {...DETAIL} />
        {Array.from({ length: seats - 1 }, (_, index) => {
          const x = -w / 2 + arm + seatW * (index + 1)
          return <line key={index} x1={x} y1={-h / 2 + back} x2={x} y2={h / 2 - 2} {...SOFT} />
        })}
      </g>
    )
  },

  sectional: ({ w, h, fill = 'none', outlineWidth = 1.1 }) => {
    const arm = 30
    return (
      <g>
        <path
          {...DETAIL}
          fill={fill}
          strokeWidth={outlineWidth}
          d={`M ${-w / 2} ${-h / 2} H ${w / 2} V ${h / 2} H ${w / 2 - arm} V ${h / 2 - arm} H ${-w / 2} Z`}
        />
        <path
          {...DETAIL}
          d={`M ${-w / 2} ${h / 2 - arm} L ${w / 2 - arm} ${h / 2 - arm} L ${w / 2 - arm} ${h / 2}`}
        />
        <line x1={-w / 2} y1={-h / 2 + 9} x2={w / 2} y2={-h / 2 + 9} {...DETAIL} />
        <line x1={w / 2 - 9} y1={-h / 2} x2={w / 2 - 9} y2={h / 2 - arm} {...SOFT} />
      </g>
    )
  },

  armchair: ({ w, h }) => (
    <g>
      <line x1={-w / 2} y1={-h / 2 + h * 0.26} x2={w / 2} y2={-h / 2 + h * 0.26} {...DETAIL} />
      <line x1={-w / 2 + w * 0.2} y1={-h / 2 + h * 0.26} x2={-w / 2 + w * 0.2} y2={h / 2} {...DETAIL} />
      <line x1={w / 2 - w * 0.2} y1={-h / 2 + h * 0.26} x2={w / 2 - w * 0.2} y2={h / 2} {...DETAIL} />
    </g>
  ),

  chair: ({ w, h }) => (
    <g>
      <line x1={-w / 2 + 1} y1={-h / 2 + h * 0.22} x2={w / 2 - 1} y2={-h / 2 + h * 0.22} {...DETAIL} />
      <rect {...SOFT} {...box(w, h, 3, 2)} />
    </g>
  ),

  stool: ({ w, h }) => (
    <g>
      <ellipse {...DETAIL} cx={0} cy={0} rx={w / 2 - 1} ry={h / 2 - 1} />
      <ellipse {...SOFT} cx={0} cy={0} rx={w / 4} ry={h / 4} />
    </g>
  ),

  tableRect: ({ w, h }) => <rect {...SOFT} {...box(w, h, Math.min(3, w / 8), 1)} />,

  tableRound: ({ w, h }) => (
    <g>
      <ellipse {...DETAIL} cx={0} cy={0} rx={w / 2} ry={h / 2} />
      <ellipse {...SOFT} cx={0} cy={0} rx={w / 2 - 3} ry={h / 2 - 3} />
    </g>
  ),

  desk: ({ w, h }) => (
    <g>
      <line x1={-w / 2} y1={h / 2 - h * 0.22} x2={w / 2} y2={h / 2 - h * 0.22} {...SOFT} />
      <rect {...DETAIL} x={w / 2 - 18} y={-h / 2 + 2} width={16} height={h - 4} rx={1} />
      <line x1={w / 2 - 18} y1={0} x2={w / 2 - 2} y2={0} {...SOFT} />
    </g>
  ),

  deskL: ({ w, h, fill = 'none', outlineWidth = 1.1 }) => {
    const arm = 30
    return (
      <g>
        <path
          {...DETAIL}
          fill={fill}
          strokeWidth={outlineWidth}
          d={`M ${-w / 2} ${-h / 2} H ${-w / 2 + arm} V ${h / 2 - arm} H ${w / 2} V ${h / 2} H ${-w / 2} Z`}
        />
        <path
          {...DETAIL}
          d={`M ${-w / 2 + arm} ${-h / 2} L ${-w / 2 + arm} ${h / 2 - arm} L ${w / 2} ${h / 2 - arm}`}
        />
      </g>
    )
  },

  nightstand: ({ w, h }) => (
    <g>
      <rect {...DETAIL} {...box(w, h, 2, 1)} />
      <line x1={-w / 2 + 2} y1={0} x2={w / 2 - 2} y2={0} {...SOFT} />
      <circle {...DETAIL} cx={0} cy={h / 2 - 5} r={1.4} />
    </g>
  ),

  dresser: ({ w, h }) => {
    const drawers = Math.max(2, Math.round(w / 22))
    return (
      <g>
        <line x1={-w / 2} y1={h / 2 - h * 0.3} x2={w / 2} y2={h / 2 - h * 0.3} {...SOFT} />
        {Array.from({ length: drawers - 1 }, (_, index) => {
          const x = -w / 2 + (w / drawers) * (index + 1)
          return <line key={index} x1={x} y1={-h / 2} x2={x} y2={h / 2} {...SOFT} />
        })}
      </g>
    )
  },

  wardrobe: ({ w, h }) => (
    <g>
      <line x1={0} y1={-h / 2} x2={0} y2={h / 2} {...DETAIL} />
      <circle {...DETAIL} cx={-3} cy={h / 2 - 5} r={1.3} />
      <circle {...DETAIL} cx={3} cy={h / 2 - 5} r={1.3} />
      <line x1={-w / 2 + 3} y1={-h / 2 + 4} x2={w / 2 - 3} y2={-h / 2 + 4} {...SOFT} />
    </g>
  ),

  bookcase: ({ w, h }) => {
    const shelves = Math.max(2, Math.round(w / 18))
    return (
      <g>
        {Array.from({ length: shelves - 1 }, (_, index) => {
          const x = -w / 2 + (w / shelves) * (index + 1)
          return <line key={index} x1={x} y1={-h / 2} x2={x} y2={h / 2} {...DETAIL} />
        })}
        <line x1={-w / 2} y1={h / 2 - 2} x2={w / 2} y2={h / 2 - 2} {...SOFT} />
      </g>
    )
  },

  tv: ({ w, h }) => (
    <g>
      <line x1={-w / 2 + 2} y1={0} x2={w / 2 - 2} y2={0} {...DETAIL} />
      <line x1={0} y1={-h / 2} x2={0} y2={h / 2} {...SOFT} />
    </g>
  ),

  lamp: ({ w, h }) => (
    <g>
      <ellipse {...DETAIL} cx={0} cy={0} rx={w / 2 - 1} ry={h / 2 - 1} />
      <line x1={-w / 4} y1={-h / 4} x2={w / 4} y2={h / 4} {...SOFT} />
      <line x1={w / 4} y1={-h / 4} x2={-w / 4} y2={h / 4} {...SOFT} />
    </g>
  ),

  plant: ({ w, h }) => (
    <g>
      <ellipse {...DETAIL} cx={0} cy={0} rx={w / 2 - 1} ry={h / 2 - 1} />
      <path {...DETAIL} d={`M 0 ${h / 4} C ${-w / 3} 0 ${-w / 4} ${-h / 3} 0 ${-h / 3}`} />
      <path {...DETAIL} d={`M 0 ${h / 4} C ${w / 3} 0 ${w / 4} ${-h / 3} 0 ${-h / 3}`} />
    </g>
  ),

  rug: ({ w, h }) => (
    <rect
      {...DETAIL}
      {...box(w, h, 4, 1)}
      strokeDasharray="4 3"
      opacity={0.6}
    />
  ),

  piano: ({ w, h }) => (
    <g>
      <line x1={-w / 2} y1={h / 2 - h * 0.35} x2={w / 2} y2={h / 2 - h * 0.35} {...DETAIL} />
      {Array.from({ length: Math.round(w / 6) }, (_, index) => {
        const x = -w / 2 + 3 + index * 6
        return <line key={index} x1={x} y1={h / 2 - h * 0.35} x2={x} y2={h / 2} {...SOFT} />
      })}
    </g>
  ),

  crib: ({ w, h }) => (
    <g>
      <rect {...DETAIL} {...box(w, h, 3, 1)} />
      {Array.from({ length: Math.round(w / 8) }, (_, index) => {
        const x = -w / 2 + 5 + index * 8
        return <line key={index} x1={x} y1={-h / 2} x2={x} y2={-h / 2 + 3} {...SOFT} />
      })}
    </g>
  ),

  fridge: ({ w, h }) => {
    const inset = 3
    const gap = 1
    const doorW = (w - inset * 2 - gap) / 2
    const doorH = h - inset * 2 - 4
    const doorY = -h / 2 + inset + 2
    const leftDoorX = -w / 2 + inset
    const rightDoorX = gap / 2
    const handleY1 = doorY + 5
    const handleY2 = doorY + doorH - 5
    return (
      <g>
        <line x1={-w / 2 + 2} y1={-h / 2 + 4} x2={w / 2 - 2} y2={-h / 2 + 4} {...SOFT} />
        <rect {...SOFT} x={leftDoorX} y={doorY} width={doorW} height={doorH} rx={1} />
        <rect {...SOFT} x={rightDoorX} y={doorY} width={doorW} height={doorH} rx={1} />
        <line x1={-gap / 2 - 2} y1={handleY1} x2={-gap / 2 - 2} y2={handleY2} {...DETAIL} />
        <line x1={gap / 2 + 2} y1={handleY1} x2={gap / 2 + 2} y2={handleY2} {...DETAIL} />
        <line x1={-w / 2 + 3} y1={h / 2 - 4} x2={w / 2 - 3} y2={h / 2 - 4} {...SOFT} />
      </g>
    )
  },

  fridgeSingle: ({ w, h }) => {
    const inset = 3
    const doorY = -h / 2 + inset + 2
    const doorH = h - inset * 2 - 4
    const handleX = w / 2 - inset - 4
    return (
      <g>
        <line x1={-w / 2 + 2} y1={-h / 2 + 4} x2={w / 2 - 2} y2={-h / 2 + 4} {...SOFT} />
        <rect {...SOFT} x={-w / 2 + inset} y={doorY} width={w - inset * 2} height={doorH} rx={1} />
        <line x1={handleX} y1={doorY + 5} x2={handleX} y2={doorY + doorH - 5} {...DETAIL} />
        <line x1={-w / 2 + 3} y1={h / 2 - 4} x2={w / 2 - 3} y2={h / 2 - 4} {...SOFT} />
      </g>
    )
  },

  range: ({ w, h }) => {
    const r = Math.min(w, h) * 0.16
    const dx = w * 0.22
    const dy = h * 0.18
    return (
      <g>
        <line x1={-w / 2} y1={-h / 2 + h * 0.16} x2={w / 2} y2={-h / 2 + h * 0.16} {...SOFT} />
        {[
          [-dx, -dy + 2],
          [dx, -dy + 2],
          [-dx, dy + 1],
          [dx, dy + 1],
        ].map(([cx, cy], index) => (
          <circle key={index} {...DETAIL} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    )
  },

  dishwasher: ({ w, h }) => (
    <g>
      <rect {...DETAIL} {...box(w, h, 3, 1)} />
      <line x1={-w / 2 + 3} y1={h / 2 - 6} x2={w / 2 - 3} y2={h / 2 - 6} {...SOFT} />
    </g>
  ),

  microwave: ({ w, h }) => (
    <g>
      <rect {...DETAIL} x={-w / 2 + 2} y={-h / 2 + 2} width={w * 0.62} height={h - 4} rx={1} />
      <line x1={w / 2 - 6} y1={-h / 2 + 4} x2={w / 2 - 6} y2={h / 2 - 4} {...SOFT} />
    </g>
  ),

  radiator: ({ w, h }) => {
    const fins = Math.max(3, Math.round(w / 4))
    const inset = Math.min(1.5, h * 0.2)
    return (
      <g>
        <rect {...DETAIL} {...box(w, h, inset, 1)} />
        {Array.from({ length: fins - 1 }, (_, index) => {
          const x = -w / 2 + ((index + 1) * w) / fins
          return <line key={index} x1={x} y1={-h / 2 + inset + 1} x2={x} y2={h / 2 - inset - 1} {...SOFT} />
        })}
      </g>
    )
  },

  sink: ({ w, h }) => (
    <g>
      <rect {...DETAIL} x={-w / 2 + 3} y={-h / 2 + 5} width={w - 6} height={h - 8} rx={2} />
      <circle {...DETAIL} cx={0} cy={-h / 2 + 2.5} r={1.6} />
      <circle {...SOFT} cx={0} cy={2} r={1.6} />
    </g>
  ),

  counter: ({ w, h }) => (
    <g>
      <line x1={-w / 2} y1={h / 2 - 2} x2={w / 2} y2={h / 2 - 2} {...SOFT} />
      <line x1={-w / 2} y1={-h / 2 + h * 0.75} x2={w / 2} y2={-h / 2 + h * 0.75} {...SOFT} />
    </g>
  ),

  island: ({ w, h }) => (
    <g>
      <rect {...SOFT} {...box(w, h, 3, 1)} />
      <rect {...DETAIL} x={-14} y={-h / 2 + 6} width={28} height={h * 0.4} rx={2} />
    </g>
  ),

  toilet: ({ w, h }) => (
    <g>
      <rect {...DETAIL} x={-w / 2 + 1} y={-h / 2 + 1} width={w - 2} height={h * 0.24} rx={1} />
      <ellipse {...DETAIL} cx={0} cy={h * 0.1} rx={w * 0.36} ry={h * 0.3} />
    </g>
  ),

  tub: ({ w, h }) => (
    <g>
      <rect {...DETAIL} {...box(w, h, 3, 4)} />
      <circle {...DETAIL} cx={-w / 2 + 8} cy={0} r={1.8} />
      <line x1={-w / 2 + 2} y1={-h / 2 + 1} x2={-w / 2 + 2} y2={h / 2 - 1} {...SOFT} />
    </g>
  ),

  shower: ({ w, h }) => (
    <g>
      <path {...DETAIL} d={`M ${-w / 2} ${h / 2} A ${w} ${h} 0 0 0 ${w / 2} ${-h / 2}`} />
      <circle {...DETAIL} cx={-w / 2 + 6} cy={-h / 2 + 6} r={2} />
      <line x1={-w / 2} y1={-h / 2} x2={w / 2} y2={h / 2} {...SOFT} />
    </g>
  ),

  vanity: ({ w, h }) => (
    <g>
      <line x1={-w / 2} y1={h / 2 - h * 0.22} x2={w / 2} y2={h / 2 - h * 0.22} {...SOFT} />
      {(w > 48 ? [-w / 4, w / 4] : [0]).map((cx) => (
        <g key={cx}>
          <ellipse {...DETAIL} cx={cx} cy={0} rx={h * 0.3} ry={h * 0.28} />
          <circle {...DETAIL} cx={cx} cy={-h / 2 + 3} r={1.4} />
        </g>
      ))}
    </g>
  ),

  washer: ({ w, h }) => (
    <g>
      <line x1={-w / 2} y1={-h / 2 + h * 0.18} x2={w / 2} y2={-h / 2 + h * 0.18} {...SOFT} />
      <circle {...DETAIL} cx={0} cy={h * 0.08} r={Math.min(w, h) * 0.3} />
      <circle {...SOFT} cx={0} cy={h * 0.08} r={Math.min(w, h) * 0.16} />
    </g>
  ),

  dryer: ({ w, h }) => (
    <g>
      <line x1={-w / 2} y1={-h / 2 + h * 0.18} x2={w / 2} y2={-h / 2 + h * 0.18} {...SOFT} />
      <circle {...DETAIL} cx={0} cy={h * 0.08} r={Math.min(w, h) * 0.3} />
      <line
        x1={-Math.min(w, h) * 0.2}
        y1={h * 0.08}
        x2={Math.min(w, h) * 0.2}
        y2={h * 0.08}
        {...SOFT}
      />
    </g>
  ),

  waterHeater: ({ w, h, fill = 'none', outlineWidth = 1.1 }) => (
    <g>
      <ellipse
        {...DETAIL}
        fill={fill}
        strokeWidth={outlineWidth}
        cx={0}
        cy={0}
        rx={w / 2 - 1}
        ry={h / 2 - 1}
      />
      <ellipse {...SOFT} cx={0} cy={0} rx={w / 2 - 5} ry={h / 2 - 5} />
    </g>
  ),

  stairs: ({ w, h }) => {
    const treads = Math.max(3, Math.round(h / 11))
    const step = h / treads
    return (
      <g>
        {Array.from({ length: treads - 1 }, (_, index) => {
          const y = -h / 2 + step * (index + 1)
          return <line key={index} x1={-w / 2} y1={y} x2={w / 2} y2={y} {...DETAIL} />
        })}
        <path
          {...DETAIL}
          d={`M 0 ${h / 2 - 4} L 0 ${-h / 2 + 4} M ${-3} ${-h / 2 + 9} L 0 ${-h / 2 + 4} L 3 ${-h / 2 + 9}`}
          opacity={0.8}
        />
      </g>
    )
  },

  column: ({ w, h }) => (
    <g>
      <line x1={-w / 2} y1={-h / 2} x2={w / 2} y2={h / 2} {...DETAIL} />
      <line x1={w / 2} y1={-h / 2} x2={-w / 2} y2={h / 2} {...DETAIL} />
    </g>
  ),

  fireplace: ({ w, h }) => (
    <g>
      <path
        {...DETAIL}
        d={`M ${-w * 0.28} ${h / 2} L ${-w * 0.28} ${-h / 2 + h * 0.4} A ${w * 0.28} ${h * 0.4} 0 0 1 ${w * 0.28} ${-h / 2 + h * 0.4} L ${w * 0.28} ${h / 2}`}
      />
    </g>
  ),

  /** Stand-in for an image item; the bitmap itself is painted by ItemsLayer. */
  image: ({ w, h }) => {
    const unit = Math.min(w, h)
    const base = h / 2 - unit * 0.14
    return (
      <g>
        <circle {...SOFT} cx={-w / 2 + unit * 0.2} cy={-h / 2 + unit * 0.2} r={unit * 0.07} />
        <path
          {...SOFT}
          d={`M ${-w / 2 + unit * 0.1} ${base} L ${-w * 0.08} ${base - unit * 0.3} L ${w * 0.06} ${base - unit * 0.12} L ${w * 0.22} ${base - unit * 0.36} L ${w / 2 - unit * 0.1} ${base}`}
        />
      </g>
    )
  },
}

export function getGlyph(key: GlyphKey): Glyph {
  return GLYPHS[key] ?? GLYPHS.box
}

const CUSTOM_FOOTPRINTS = new Set<GlyphKey>(['sectional', 'deskL', 'waterHeater'])

export function usesCustomFootprint(key: GlyphKey): boolean {
  return CUSTOM_FOOTPRINTS.has(key)
}
