import { memo } from 'react'
import { distance, type Vec2 } from '@/core/geometry'
import { formatLength, type UnitSystem } from '@/core/units'
import { getOpeningTemplate } from '@/model/catalog'
import { openingFrame } from '@/model/derive'
import type { GlyphKey } from '@/model/catalog'
import type { OpeningKind, Plan } from '@/model/types'
import { useImageAsset } from '@/state/imageAssets'
import { worldToScreen } from '@/state/transform'
import type { Viewport } from '@/state/types'
import { getGlyph, usesCustomFootprint } from '../glyphs'
import type { PreviewState } from '../interactions/types'
import { DimensionLine } from './DimensionLine'

export interface PreviewLayerProps {
  preview: PreviewState
  plan: Plan
  viewport: Viewport
  unit: UnitSystem
  openingKind: OpeningKind
}

/**
 * Everything transient: marquee, draft room, measuring tape, snap guides and
 * placement ghosts. Drawn in screen space; world geometry is scaled inline so
 * ghosts can reuse the same inch-based glyphs as real items.
 */
export const PreviewLayer = memo(function PreviewLayer({
  preview,
  plan,
  viewport,
  unit,
  openingKind,
}: PreviewLayerProps) {
  const toScreen = (point: Vec2) => worldToScreen(viewport, point)

  return (
    <g className="preview-layer" pointerEvents="none">
      {preview.guides.map((guide, index) => {
        if (guide.axis === 'segment') {
          const from = toScreen(guide.a)
          const to = toScreen(guide.b)
          return (
            <line
              key={index}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--snap-guide)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          )
        }
        const isVertical = guide.axis === 'x'
        const from = toScreen(
          isVertical ? { x: guide.position, y: guide.from } : { x: guide.from, y: guide.position },
        )
        const to = toScreen(
          isVertical ? { x: guide.position, y: guide.to } : { x: guide.to, y: guide.position },
        )
        return (
          <line
            key={index}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="var(--snap-guide)"
            strokeWidth={1}
            strokeDasharray="5 4"
          />
        )
      })}

      {preview.marquee && (
        <rect
          {...screenRect(preview.marquee, viewport)}
          fill="var(--accent)"
          fillOpacity={0.08}
          stroke="var(--accent)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}

      {preview.draftRoom && (
        <>
          <rect
            {...screenRect(preview.draftRoom, viewport)}
            fill="var(--accent)"
            fillOpacity={0.06}
            stroke="var(--accent)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <DimensionLine
            a={toScreen({ x: preview.draftRoom.x, y: preview.draftRoom.y })}
            b={toScreen({
              x: preview.draftRoom.x + preview.draftRoom.width,
              y: preview.draftRoom.y,
            })}
            direction={{ x: 0, y: -1 }}
            offset={16}
            label={formatLength(preview.draftRoom.width, unit)}
            emphasis
          />
          <DimensionLine
            a={toScreen({
              x: preview.draftRoom.x + preview.draftRoom.width,
              y: preview.draftRoom.y,
            })}
            b={toScreen({
              x: preview.draftRoom.x + preview.draftRoom.width,
              y: preview.draftRoom.y + preview.draftRoom.height,
            })}
            direction={{ x: 1, y: 0 }}
            offset={16}
            label={formatLength(preview.draftRoom.height, unit)}
            emphasis
          />
        </>
      )}

      {preview.measure && (
        <MeasureTape a={preview.measure.a} b={preview.measure.b} viewport={viewport} unit={unit} />
      )}

      {preview.itemGhost && (
        <ItemGhost ghost={preview.itemGhost} viewport={viewport} unit={unit} />
      )}

      {preview.openingGhost && (
        <OpeningGhost
          plan={plan}
          viewport={viewport}
          kind={openingKind}
          placement={preview.openingGhost}
        />
      )}
    </g>
  )
})

function screenRect(
  rect: { x: number; y: number; width: number; height: number },
  viewport: Viewport,
) {
  const topLeft = worldToScreen(viewport, rect)
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: rect.width * viewport.scale,
    height: rect.height * viewport.scale,
  }
}

function MeasureTape({
  a,
  b,
  viewport,
  unit,
}: {
  a: Vec2
  b: Vec2
  viewport: Viewport
  unit: UnitSystem
}) {
  const start = worldToScreen(viewport, a)
  const end = worldToScreen(viewport, b)
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const length = distance(a, b)

  return (
    <g>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="var(--snap-guide)"
        strokeWidth={1.5}
      />
      {[start, end].map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={3.5}
          fill="var(--surface-panel)"
          stroke="var(--snap-guide)"
          strokeWidth={1.5}
        />
      ))}
      <text
        x={mid.x}
        y={mid.y - 10}
        textAnchor="middle"
        fontSize={12}
        fontWeight={650}
        fill="var(--snap-guide)"
        stroke="var(--surface-paper)"
        strokeWidth={4}
        paintOrder="stroke"
      >
        {formatLength(length, unit)}
      </text>
    </g>
  )
}

function ItemGhost({
  ghost,
  viewport,
  unit,
}: {
  ghost: NonNullable<PreviewState['itemGhost']>
  viewport: Viewport
  unit: UnitSystem
}) {
  const center = worldToScreen(viewport, ghost.center)
  const glyphKey = ghost.glyphKey as GlyphKey
  const Glyph = getGlyph(glyphKey)
  const image = useImageAsset(ghost.imageId)
  return (
    <g opacity={0.72}>
      <g
        transform={`translate(${center.x} ${center.y}) scale(${viewport.scale}) rotate(${ghost.rotation})`}
        color="var(--accent)"
      >
        {(image || !usesCustomFootprint(glyphKey)) && (
          <rect
            x={-ghost.width / 2}
            y={-ghost.depth / 2}
            width={ghost.width}
            height={ghost.depth}
            rx={1.5}
            fill="var(--accent-soft)"
            stroke="var(--accent)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {image ? (
          <image
            href={image.url}
            x={-ghost.width / 2}
            y={-ghost.depth / 2}
            width={ghost.width}
            height={ghost.depth}
            preserveAspectRatio="none"
          />
        ) : (
          <Glyph w={ghost.width} h={ghost.depth} fill="var(--accent-soft)" outlineWidth={1.5} />
        )}
      </g>
      <text
        x={center.x}
        y={center.y - (ghost.depth / 2) * viewport.scale - 10}
        textAnchor="middle"
        fontSize={11}
        fontWeight={620}
        fill="var(--accent)"
        stroke="var(--surface-paper)"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        {`${formatLength(ghost.width, unit)} × ${formatLength(ghost.depth, unit)}`}
      </text>
    </g>
  )
}

function OpeningGhost({
  plan,
  viewport,
  kind,
  placement,
}: {
  plan: Plan
  viewport: Viewport
  kind: OpeningKind
  placement: NonNullable<PreviewState['openingGhost']>
}) {
  const frame = openingFrame(plan, {
    id: 'ghost',
    kind,
    width: getOpeningTemplate(kind).width,
    flipHinge: false,
    flipInward: true,
    ...placement,
  })
  if (!frame) return null
  const start = worldToScreen(viewport, frame.start)
  const end = worldToScreen(viewport, frame.end)
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke="var(--accent)"
      strokeWidth={Math.max(3, frame.thickness * viewport.scale)}
      strokeLinecap="butt"
      opacity={0.6}
    />
  )
}
