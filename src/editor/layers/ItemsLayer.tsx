import { memo } from 'react'
import { getItemTemplate } from '@/model/catalog'
import type { Item } from '@/model/types'
import { useImageAsset } from '@/state/imageAssets'
import { usePlan } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { useScene } from '../EditorContext'
import { getGlyph, usesCustomFootprint } from '../glyphs'

export const ItemsLayer = memo(function ItemsLayer() {
  const plan = usePlan()
  return (
    <g className="items-layer">
      {plan.items.map((item) => (
        <ItemShape key={item.id} item={item} />
      ))}
    </g>
  )
})

function ItemShape({ item }: { item: Item }) {
  const scene = useScene()
  const selected = useEditorStore((state) =>
    state.selection.some((ref) => ref.kind === 'item' && ref.id === item.id),
  )
  const hovered = useEditorStore(
    (state) => state.hover?.kind === 'item' && state.hover.id === item.id,
  )

  const template = getItemTemplate(item.templateId)
  const glyphKey = template?.glyph ?? 'box'
  const Glyph = getGlyph(glyphKey)
  const image = useImageAsset(item.imageId)
  const outline = selected
    ? 'var(--accent)'
    : hovered
      ? 'var(--accent-hover)'
      : 'rgba(28, 32, 42, 0.62)'
  const strokeWidth = selected ? 1.6 : 1.1
  const footprint = {
    x: -item.width / 2,
    y: -item.depth / 2,
    width: item.width,
    height: item.depth,
    rx: 1.5,
    vectorEffect: 'non-scaling-stroke',
  } as const

  return (
    <g
      data-plan-item={item.id}
      transform={`translate(${item.center.x} ${item.center.y}) rotate(${item.rotation})`}
      onPointerDown={(event) => scene.startMove({ kind: 'item', id: item.id }, event)}
      onPointerEnter={() => scene.hover({ kind: 'item', id: item.id })}
      onPointerLeave={() => scene.hover(null)}
      style={{ cursor: item.locked ? 'default' : 'pointer' }}
    >
      {image ? (
        // The bitmap paints first so its own border sits on top of it.
        <>
          <image
            href={image.url}
            x={-item.width / 2}
            y={-item.depth / 2}
            width={item.width}
            height={item.depth}
            preserveAspectRatio="none"
          />
          {(selected || hovered) && (
            <rect {...footprint} fill="none" stroke={outline} strokeWidth={strokeWidth} />
          )}
        </>
      ) : (
        <>
          {!usesCustomFootprint(glyphKey) && (
            <rect
              {...footprint}
              fill={item.color}
              stroke={outline}
              strokeWidth={strokeWidth}
              // A dashed frame marks an image whose file is missing.
              strokeDasharray={item.imageId ? '4 3' : undefined}
            />
          )}
          <g color={outline} opacity={0.85}>
            <Glyph w={item.width} h={item.depth} fill={item.color} outlineWidth={strokeWidth} />
          </g>
        </>
      )}
    </g>
  )
}
