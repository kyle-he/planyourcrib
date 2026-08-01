/* oxlint-disable react/only-export-components -- SVG primitives live with the glyph registry. */
import type { CSSProperties, ReactNode } from 'react'
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

const SOFT = { ...DETAIL } as const

const STACKED = {
  ...DETAIL,
  strokeWidth: 1.15,
  fill: 'var(--glyph-inset, #d3d7df)',
} as const

/**
 * Bird's-eye depth rule: physical height, not screen position, controls visual
 * size. Low layers stay inset; taller layers draw later, larger, and may exceed
 * the exact footprint by a small amount. The footprint itself never changes.
 */
const HIGH_DETAIL = { ...DETAIL, strokeWidth: 1.2 } as const

interface RaisedRectProps {
  x: number
  y: number
  width: number
  height: number
  rx: number
  fill: string
  lift?: 1 | 2
}

/** Raised pieces stay light; inset pieces use STACKED's darker flat tone. */
function RaisedRect(props: RaisedRectProps) {
  return (
    <rect
      {...HIGH_DETAIL}
      x={props.x}
      y={props.y}
      width={props.width}
      height={props.height}
      rx={props.rx}
      fill={props.fill}
    />
  )
}

interface RaisedEllipseProps {
  cx: number
  cy: number
  rx: number
  ry: number
  fill: string
  lift?: 1 | 2
}

/** Flat elliptical counterpart for high round surfaces and shades. */
function RaisedEllipse(props: RaisedEllipseProps) {
  return (
    <ellipse
      {...HIGH_DETAIL}
      cx={props.cx}
      cy={props.cy}
      rx={props.rx}
      ry={props.ry}
      fill={props.fill}
    />
  )
}

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

  bed: ({ w, h, fill = 'none' }) => {
    const edge = Math.min(3, w * 0.06)
    const headboardH = Math.min(8, h * 0.11)
    const pillowH = Math.min(15, h * 0.2)
    const pillowGap = Math.min(2, w * 0.035)
    const pillowCount = w > 45 ? 2 : 1
    const pillowW = (w - edge * 2 - pillowGap * (pillowCount - 1)) / pillowCount
    const duvetY = -h / 2 + headboardH + pillowH + 5
    const pillowOverhang = Math.min(0.8, w * 0.015)
    const headboardOverhang = Math.min(0.7, w * 0.012)
    return (
      <g>
        <line {...DETAIL} x1={-w / 2} y1={duvetY} x2={w / 2} y2={duvetY} />
        <line {...DETAIL} x1={-w / 2} y1={h / 2} x2={w / 2} y2={h / 2} />
        {Array.from({ length: pillowCount }, (_, index) => (
            <RaisedRect
              key={index}
              x={-w / 2 + edge + index * (pillowW + pillowGap) - pillowOverhang}
              y={-h / 2 + headboardH + 2 - pillowOverhang}
              width={pillowW + pillowOverhang * 2}
              height={pillowH + pillowOverhang * 2}
              rx={Math.min(4, pillowH * 0.28)}
              fill={fill}
              lift={1}
            />
        ))}
        <RaisedRect
          x={-w / 2 - headboardOverhang}
          y={-h / 2 - headboardOverhang}
          width={w + headboardOverhang * 2}
          height={headboardH + headboardOverhang * 2}
          rx={Math.min(4, headboardH / 2)}
          fill={fill}
          lift={2}
        />
      </g>
    )
  },

  sofa: ({ w, h, fill = 'none' }) => {
    const back = h * 0.31
    const arm = Math.min(9, w * 0.13)
    const seats = w > 70 ? 3 : w > 46 ? 2 : 1
    const edge = Math.min(2, h * 0.055)
    const seatGap = Math.min(1.2, w * 0.018)
    const seatY = -h / 2 + back * 0.7
    const seatW = (w - arm * 2 - edge * 2 - seatGap * (seats - 1)) / seats
    const seatH = h / 2 - edge - seatY
    const armOverhang = Math.min(0.7, h * 0.02)
    const backOverhang = Math.min(0.9, h * 0.026)
    return (
      <g>
        {Array.from({ length: seats }, (_, index) => (
          <rect
            {...STACKED}
            key={index}
            x={-w / 2 + arm + edge + index * (seatW + seatGap)}
            y={seatY}
            width={seatW}
            height={seatH}
            rx={Math.min(4, seatH * 0.14)}
          />
        ))}
        <RaisedRect
          x={-w / 2 - armOverhang}
          y={-h / 2 + back * 0.2 - armOverhang}
          width={arm + edge + armOverhang * 2}
          height={h - back * 0.2 - edge + armOverhang * 2}
          rx={Math.min(4, arm * 0.42)}
          fill={fill}
          lift={1}
        />
        <RaisedRect
          x={w / 2 - arm - edge - armOverhang}
          y={-h / 2 + back * 0.2 - armOverhang}
          width={arm + edge + armOverhang * 2}
          height={h - back * 0.2 - edge + armOverhang * 2}
          rx={Math.min(4, arm * 0.42)}
          fill={fill}
          lift={1}
        />
        <RaisedRect
          x={-w / 2 - backOverhang}
          y={-h / 2 - backOverhang}
          width={w + backOverhang * 2}
          height={back + edge + backOverhang * 2}
          rx={Math.min(5, back * 0.42)}
          fill={fill}
          lift={2}
        />
      </g>
    )
  },

  sectional: ({ w, h, fill = 'none', outlineWidth = 1.1 }) => {
    const arm = 30
    const edge = 2
    const back = 9
    const topDepth = h - arm
    const seatY = -h / 2 + back * 0.72
    const seatH = topDepth - back * 0.72 - edge
    const straightW = w - arm - edge * 2
    const seatGap = 1.2
    const seats = 3
    const seatW = (straightW - seatGap * (seats - 1)) / seats
    const highOverhang = 0.8
    return (
      <g>
        <path
          {...DETAIL}
          fill={fill}
          strokeWidth={outlineWidth}
          d={`M ${-w / 2} ${-h / 2} H ${w / 2} V ${h / 2} H ${w / 2 - arm} V ${h / 2 - arm} H ${-w / 2} Z`}
        />
        {Array.from({ length: seats }, (_, index) => (
          <rect
            {...STACKED}
            key={index}
            x={-w / 2 + edge + index * (seatW + seatGap)}
            y={seatY}
            width={seatW}
            height={seatH}
            rx={4}
          />
        ))}
        <rect
          {...STACKED}
          x={w / 2 - arm + edge}
          y={seatY}
          width={arm - edge * 2}
          height={h / 2 - edge - seatY}
          rx={4}
        />
        <RaisedRect
          x={-w / 2 - highOverhang}
          y={-h / 2 - highOverhang}
          width={w + highOverhang * 2}
          height={back + edge + highOverhang * 2}
          rx={4}
          fill={fill}
          lift={2}
        />
        <RaisedRect
          x={w / 2 - back - edge - highOverhang}
          y={-h / 2 - highOverhang}
          width={back + edge + highOverhang * 2}
          height={h + highOverhang * 2}
          rx={4}
          fill={fill}
          lift={2}
        />
      </g>
    )
  },

  armchair: ({ w, h, fill = 'none' }) => {
    const edge = Math.min(2, w * 0.06)
    const arm = w * 0.2
    const back = h * 0.29
    const highOverhang = Math.min(0.7, w * 0.022)
    return (
      <g>
        <rect
          {...STACKED}
          x={-w / 2 + arm}
          y={-h / 2 + back * 0.72}
          width={w - arm * 2}
          height={h - back * 0.72 - edge}
          rx={Math.min(4, w * 0.1)}
        />
        <RaisedRect x={-w / 2 - highOverhang} y={-h / 2 + 1} width={arm + edge + highOverhang} height={h - 2 + highOverhang} rx={3} fill={fill} lift={1} />
        <RaisedRect x={w / 2 - arm - edge} y={-h / 2 + 1} width={arm + edge + highOverhang} height={h - 2 + highOverhang} rx={3} fill={fill} lift={1} />
        <RaisedRect x={-w / 2 - highOverhang} y={-h / 2 - highOverhang} width={w + highOverhang * 2} height={back + edge + highOverhang * 2} rx={4} fill={fill} lift={2} />
      </g>
    )
  },

  chair: ({ w, h, fill = 'none' }) => {
    const edge = Math.min(2, w * 0.08)
    const backH = h * 0.25
    const backOverhang = Math.min(0.65, w * 0.035)
    return (
      <g>
        <rect {...STACKED} {...box(w, h, edge + 1, 3)} />
        <RaisedRect
          x={-w / 2 - backOverhang}
          y={-h / 2 - backOverhang}
          width={w + backOverhang * 2}
          height={backH + edge + backOverhang * 2}
          rx={Math.min(3, backH / 2)}
          fill={fill}
          lift={2}
        />
      </g>
    )
  },

  stool: ({ w, h, fill = 'none' }) => {
    const overhang = Math.min(0.55, Math.min(w, h) * 0.035)
    return (
      <g>
        <ellipse {...SOFT} cx={0} cy={0} rx={w / 4} ry={h / 4} />
        <RaisedEllipse cx={0} cy={0} rx={w / 2 + overhang} ry={h / 2 + overhang} fill={fill} lift={1} />
      </g>
    )
  },

  tableRect: ({ w, h, fill = 'none' }) => {
    const inset = Math.min(3, w / 8, h / 8)
    const overhang = Math.min(0.65, Math.min(w, h) * 0.025)
    return (
      <g>
        <rect {...SOFT} {...box(w, h, inset, Math.min(4, h * 0.12))} />
        <RaisedRect
          x={-w / 2 - overhang}
          y={-h / 2 - overhang}
          width={w + overhang * 2}
          height={h + overhang * 2}
          rx={Math.min(4, h * 0.12)}
          fill={fill}
          lift={1}
        />
      </g>
    )
  },

  tableRound: ({ w, h, fill = 'none' }) => {
    const overhang = Math.min(0.65, Math.min(w, h) * 0.025)
    return (
      <g>
        <ellipse {...SOFT} cx={0} cy={0} rx={w / 2 - 3} ry={h / 2 - 3} />
        <RaisedEllipse
          cx={0}
          cy={0}
          rx={w / 2 + overhang}
          ry={h / 2 + overhang}
          fill={fill}
          lift={1}
        />
      </g>
    )
  },

  sideTable: ({ w, h, fill = 'none' }) => {
    const overhang = Math.min(0.65, Math.min(w, h) * 0.025)
    const insetRadius = Math.max(0, Math.min(w, h) / 2 - Math.min(1.5, Math.min(w, h) * 0.07))
    return (
      <g>
        <RaisedRect
          x={-w / 2 - overhang}
          y={-h / 2 - overhang}
          width={w + overhang * 2}
          height={h + overhang * 2}
          rx={Math.min(2, Math.min(w, h) * 0.09)}
          fill={fill}
          lift={1}
        />
        <circle
          {...STACKED}
          cx={0}
          cy={0}
          r={insetRadius}
        />
      </g>
    )
  },

  desk: ({ w, h, fill = 'none' }) => {
    const overhang = Math.min(0.55, h * 0.02)
    const trayW = Math.min(11, w * 0.18)
    const trayX = w / 2 - trayW
    const grommetInset = Math.min(6, h * 0.2)
    return (
      <g>
        <RaisedRect
          x={-w / 2 - overhang}
          y={-h / 2 - overhang}
          width={w + overhang * 2}
          height={h + overhang * 2}
          rx={2}
          fill={fill}
        />
        <line {...DETAIL} x1={trayX} y1={-h / 2} x2={trayX} y2={h / 2} />
        <circle
          {...DETAIL}
          cx={-w / 2 + grommetInset}
          cy={-h / 2 + grommetInset}
          r={1.4}
          fill="var(--glyph-accent, #aeb5c1)"
        />
      </g>
    )
  },

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
      <line {...DETAIL} x1={-w / 2} y1={0} x2={w / 2} y2={0} />
      <line {...DETAIL} x1={-3} y1={-h / 4} x2={3} y2={-h / 4} />
      <line {...DETAIL} x1={-3} y1={h / 4} x2={3} y2={h / 4} />
    </g>
  ),

  dresser: ({ w, h }) => (
    <g>
      <line {...DETAIL} x1={-w / 6} y1={-h / 2} x2={-w / 6} y2={h / 2} />
      <line {...DETAIL} x1={w / 6} y1={-h / 2} x2={w / 6} y2={h / 2} />
      <line {...DETAIL} x1={-w / 2} y1={-h / 6} x2={w / 2} y2={-h / 6} />
    </g>
  ),

  tvStand: ({ w, h }) => {
    const rearSeam = -h / 2 + Math.min(4, h * 0.22)
    const frontSeam = h / 2 - Math.min(4, h * 0.22)
    const slotHalf = Math.min(7, w * 0.12)
    return (
      <g>
        <line {...DETAIL} x1={-w / 2} y1={rearSeam} x2={w / 2} y2={rearSeam} />
        <line {...DETAIL} x1={-w / 2} y1={frontSeam} x2={w / 2} y2={frontSeam} />
        <line {...DETAIL} x1={-slotHalf} y1={0} x2={slotHalf} y2={0} />
      </g>
    )
  },

  wardrobe: ({ h }) => (
    <g>
      <line {...DETAIL} x1={0} y1={-h / 2} x2={0} y2={h / 2} />
      <line {...DETAIL} x1={-3} y1={-3} x2={-3} y2={3} />
      <line {...DETAIL} x1={3} y1={-3} x2={3} y2={3} />
    </g>
  ),

  bookcase: ({ w, h }) => {
    const shelves = Math.max(2, Math.round(w / 18))
    return (
      <g>
        {Array.from({ length: shelves - 1 }, (_, index) => {
          const x = -w / 2 + ((index + 1) * w) / shelves
          return <line {...DETAIL} key={index} x1={x} y1={-h / 2} x2={x} y2={h / 2} />
        })}
      </g>
    )
  },

  tv: ({ w, h }) => (
    <g>
      <line x1={-w / 2 + 2} y1={0} x2={w / 2 - 2} y2={0} {...DETAIL} />
      <line x1={0} y1={-h / 2} x2={0} y2={h / 2} {...SOFT} />
    </g>
  ),

  lamp: ({ w, h, fill = 'none' }) => {
    const overhang = Math.min(0.8, Math.min(w, h) * 0.05)
    return (
      <g>
        <ellipse {...SOFT} cx={0} cy={0} rx={w * 0.2} ry={h * 0.2} />
        <RaisedEllipse
          cx={0}
          cy={0}
          rx={w / 2 + overhang}
          ry={h / 2 + overhang}
          fill={fill}
          lift={2}
        />
        <line x1={-w / 4} y1={-h / 4} x2={w / 4} y2={h / 4} {...SOFT} />
        <line x1={w / 4} y1={-h / 4} x2={-w / 4} y2={h / 4} {...SOFT} />
      </g>
    )
  },

  plant: ({ w, h, fill = 'none' }) => {
    const overhang = Math.min(0.8, Math.min(w, h) * 0.04)
    const spikes = 14
    const outerX = w / 2 + overhang
    const outerY = h / 2 + overhang
    const innerX = outerX * 0.78
    const innerY = outerY * 0.78
    const canopy = Array.from({ length: spikes * 2 }, (_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI) / spikes
      const rx = index % 2 === 0 ? outerX : innerX
      const ry = index % 2 === 0 ? outerY : innerY
      const x = Math.cos(angle) * rx
      const y = Math.sin(angle) * ry
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
    return (
      <g>
        <ellipse {...STACKED} cx={0} cy={0} rx={w * 0.27} ry={h * 0.27} />
        <path {...HIGH_DETAIL} d={`${canopy} Z`} fill={fill} />
        <circle {...SOFT} cx={0} cy={0} r={Math.min(w, h) * 0.1} />
      </g>
    )
  },

  rug: ({ w, h }) => (
    <g>
      <rect {...STACKED} {...box(w, h, 3, Math.min(5, h * 0.08))} />
      <rect {...SOFT} {...box(w, h, 7, Math.min(4, h * 0.07))} strokeDasharray="4 3" />
    </g>
  ),

  piano: ({ w, h }) => {
    const keyboardY = h / 2 - h * 0.35
    const keyboardInset = Math.min(4, w * 0.07)
    const keyboardW = w - keyboardInset * 2
    const whiteKeys = Math.max(6, Math.round(keyboardW / 5))
    const keyW = keyboardW / whiteKeys
    return (
      <g>
        <line x1={-w / 2} y1={-h / 2 + 1} x2={w / 2} y2={-h / 2 + 1} {...DETAIL} />
        <line x1={-w / 2} y1={keyboardY} x2={w / 2} y2={keyboardY} {...DETAIL} />
        {Array.from({ length: whiteKeys + 1 }, (_, index) => {
          const x = -keyboardW / 2 + index * keyW
          return <line key={index} x1={x} y1={keyboardY} x2={x} y2={h / 2} {...SOFT} />
        })}
      </g>
    )
  },

  crib: ({ w, h }) => {
    const edge = 3
    const bars = Math.max(4, Math.round((w - edge * 2) / 8))
    return (
      <g>
        <line {...DETAIL} x1={-w / 2} y1={-h / 2 + edge} x2={w / 2} y2={-h / 2 + edge} />
        <line {...DETAIL} x1={-w / 2} y1={h / 2 - edge} x2={w / 2} y2={h / 2 - edge} />
        {Array.from({ length: bars }, (_, index) => {
          const x = -w / 2 + edge + ((index + 0.5) * (w - edge * 2)) / bars
          return <line key={index} x1={x} y1={-h / 2 + edge} x2={x} y2={h / 2 - edge} {...SOFT} />
        })}
      </g>
    )
  },

  fridge: ({ w, h }) => {
    const inset = 3
    const gap = 1
    const doorH = h - inset * 2 - 4
    const doorY = -h / 2 + inset + 2
    const handleY1 = doorY + 5
    const handleY2 = doorY + doorH - 5
    return (
      <g>
        <line x1={-w / 2} y1={-h / 2 + 4} x2={w / 2} y2={-h / 2 + 4} {...SOFT} />
        <line x1={0} y1={doorY} x2={0} y2={doorY + doorH} {...SOFT} />
        <line x1={-gap / 2 - 2} y1={handleY1} x2={-gap / 2 - 2} y2={handleY2} {...DETAIL} />
        <line x1={gap / 2 + 2} y1={handleY1} x2={gap / 2 + 2} y2={handleY2} {...DETAIL} />
        <line x1={-w / 2} y1={h / 2 - 4} x2={w / 2} y2={h / 2 - 4} {...SOFT} />
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
        <line x1={-w / 2} y1={-h / 2 + 4} x2={w / 2} y2={-h / 2 + 4} {...SOFT} />
        <line x1={handleX} y1={doorY + 5} x2={handleX} y2={doorY + doorH - 5} {...DETAIL} />
        <line x1={-w / 2} y1={h / 2 - 4} x2={w / 2} y2={h / 2 - 4} {...SOFT} />
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
      <line x1={-w / 2} y1={-h / 2 + 4} x2={w / 2} y2={-h / 2 + 4} {...SOFT} />
      <line x1={-w / 2} y1={h / 2 - 6} x2={w / 2} y2={h / 2 - 6} {...SOFT} />
    </g>
  ),

  microwave: ({ w, h }) => {
    const pad = Math.min(3, w * 0.125, h * 0.19)
    const frameX = -w / 2 + pad
    const frameY = -h / 2 + pad
    const frameW = w - pad * 2
    const frameH = h - pad * 2
    const controlsW = Math.min(6, frameW * 0.3)
    const dividerX = frameX + frameW - controlsW
    const controlsX = dividerX + controlsW / 2
    const buttonOffset = Math.min(2.2, frameH * 0.22)
    return (
      <g>
        <rect
          {...STACKED}
          x={frameX}
          y={frameY}
          width={frameW - controlsW}
          height={frameH}
          rx={1}
        />
        <rect {...DETAIL} x={frameX} y={frameY} width={frameW} height={frameH} rx={1} fill="none" />
        <line {...DETAIL} x1={dividerX} y1={frameY} x2={dividerX} y2={frameY + frameH} />
        <circle {...DETAIL} cx={controlsX} cy={-buttonOffset} r={1.1} fill="none" />
        <circle {...DETAIL} cx={controlsX} cy={buttonOffset} r={1.1} fill="none" />
      </g>
    )
  },

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

  sink: ({ w, h, fill = 'none' }) => (
    <g>
      <rect {...STACKED} x={-w / 2 + 3} y={-h / 2 + 3} width={w - 6} height={h - 6} rx={3} />
      <circle {...HIGH_DETAIL} cx={0} cy={-h / 2 + 2.2} r={2.2} fill={fill} />
      <circle {...SOFT} cx={0} cy={2} r={1.5} fill="none" />
    </g>
  ),

  counter: ({ w, h }) => {
    const parts = Math.max(2, Math.round(w / 24))
    return (
      <g>
        {Array.from({ length: parts - 1 }, (_, index) => {
          const x = -w / 2 + ((index + 1) * w) / parts
          return <line {...SOFT} key={index} x1={x} y1={-h / 2} x2={x} y2={h / 2} />
        })}
      </g>
    )
  },

  island: ({ h }) => (
    <g>
      <line {...SOFT} x1={0} y1={-h / 2} x2={0} y2={h / 2} />
      <rect {...DETAIL} x={-14} y={-h / 2 + 4} width={28} height={h * 0.4} rx={1} />
    </g>
  ),

  toilet: ({ w, h }) => (
    <g>
      <ellipse {...STACKED} cx={0} cy={h * 0.1} rx={w * 0.36} ry={h * 0.3} />
      <RaisedRect
        x={-w / 2 - 0.5}
        y={-h / 2 - 0.5}
        width={w + 1}
        height={h * 0.24 + 1}
        rx={2}
        fill="var(--glyph-inset, #d3d7df)"
        lift={2}
      />
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

  vanity: ({ w, h }) => {
    const basins = w > 48 ? [-w / 4, w / 4] : [0]
    return (
      <g>
        {basins.length === 2 && <line {...SOFT} x1={0} y1={-h / 2} x2={0} y2={h / 2} />}
        {basins.map((cx) => (
          <g key={cx}>
            <ellipse {...DETAIL} cx={cx} cy={1} rx={h * 0.29} ry={h * 0.27} fill="none" />
            <circle {...HIGH_DETAIL} cx={cx} cy={-h / 2 + 1.8} r={1.8} fill="none" />
          </g>
        ))}
      </g>
    )
  },

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
  const Glyph = GLYPHS[key] ?? GLYPHS.box
  return (props) => {
    const base = props.fill && props.fill !== 'none' ? props.fill : '#eceef2'
    const style = {
      '--glyph-inset': `color-mix(in srgb, ${base} 78%, #1c202a)`,
      '--glyph-accent': `color-mix(in srgb, ${base} 62%, #1c202a)`,
    } as CSSProperties
    return <g style={style}>{Glyph(props)}</g>
  }
}

const CUSTOM_FOOTPRINTS = new Set<GlyphKey>([
  'sectional',
  'deskL',
  'tableRound',
  'sideTable',
  'stool',
  'lamp',
  'plant',
  'waterHeater',
])

export function usesCustomFootprint(key: GlyphKey): boolean {
  return CUSTOM_FOOTPRINTS.has(key)
}
