import { CATEGORIES } from '@/model/catalog'
import type { Item } from '@/model/types'
import { useUnit } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { Button } from '../components/Button'
import { Field, Swatches, Toggle } from '../components/Field'
import { LengthField } from '../components/LengthField'
import { NumberField } from '../components/NumberField'

const ITEM_COLORS = [
  ...CATEGORIES.map((category) => category.tint),
  '#dfe3ea',
  '#e6dfd3',
  '#d9e4dd',
  '#f0e2e2',
]

export function ItemInspector({ item }: { item: Item }) {
  const unit = useUnit()
  const updateItem = useEditorStore((state) => state.updateItem)
  const rotateEntities = useEditorStore((state) => state.rotateEntities)
  const deleteEntities = useEditorStore((state) => state.deleteEntities)
  const beginBatch = useEditorStore((state) => state.beginBatch)
  const endBatch = useEditorStore((state) => state.endBatch)

  const scrub = { onScrubStart: beginBatch, onScrubEnd: endBatch }
  const ref = { kind: 'item' as const, id: item.id }

  return (
    <div className="stack">
      <Field label="Name">
        <input
          className="input"
          value={item.name}
          spellCheck={false}
          onChange={(event) => updateItem(item.id, { name: event.target.value })}
        />
      </Field>

      <div className="grid-2">
        <LengthField
          label="Width"
          value={item.width}
          unit={unit}
          min={2}
          disabled={item.locked}
          onChange={(width) => updateItem(item.id, { width })}
          {...scrub}
        />
        <LengthField
          label="Depth"
          value={item.depth}
          unit={unit}
          min={2}
          disabled={item.locked}
          onChange={(depth) => updateItem(item.id, { depth })}
          {...scrub}
        />
      </div>

      <div className="grid-2">
        <LengthField
          label="X"
          value={item.center.x}
          unit={unit}
          min={-1e6}
          disabled={item.locked}
          onChange={(x) => updateItem(item.id, { center: { ...item.center, x } })}
          {...scrub}
        />
        <LengthField
          label="Y"
          value={item.center.y}
          unit={unit}
          min={-1e6}
          disabled={item.locked}
          onChange={(y) => updateItem(item.id, { center: { ...item.center, y } })}
          {...scrub}
        />
      </div>

      <div className="row item-inspector__rotation" style={{ alignItems: 'flex-end' }}>
        <NumberField
          label="Rotation"
          value={item.rotation}
          suffix="°"
          step={15}
          scrubbable
          min={-360}
          max={360}
          disabled={item.locked}
          onChange={(rotation) => updateItem(item.id, { rotation: ((rotation % 360) + 360) % 360 })}
          {...scrub}
        />
        <Button
          icon="rotate"
          className="item-inspector__rotate"
          title="Rotate clockwise by 90° (E)"
          disabled={item.locked}
          onClick={() => rotateEntities([ref], 90)}
        >
          Rotate 90°
        </Button>
      </div>

      {/* An image covers its own footprint, so a fill colour would never show. */}
      {!item.imageId && (
        <Field label="Colour">
          <Swatches
            value={item.color}
            colors={ITEM_COLORS}
            onChange={(color) => updateItem(item.id, { color })}
          />
        </Field>
      )}

      <Toggle
        label="Lock position"
        checked={item.locked}
        onChange={(locked) => updateItem(item.id, { locked })}
      />

      <Button icon="trash" variant="danger" block onClick={() => deleteEntities([ref])}>
        Delete item
      </Button>
    </div>
  )
}
