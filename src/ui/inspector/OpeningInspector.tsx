import { OPENING_TEMPLATES, getOpeningTemplate } from '@/model/catalog'
import { findRoom, maxOpeningOffset, roomEdge } from '@/model/derive'
import type { Opening, OpeningKind } from '@/model/types'
import { usePlan, useUnit } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { Button } from '../components/Button'
import { Field, Toggle } from '../components/Field'
import { LengthField } from '../components/LengthField'

export function OpeningInspector({ opening }: { opening: Opening }) {
  const unit = useUnit()
  const plan = usePlan()
  const updateOpening = useEditorStore((state) => state.updateOpening)
  const deleteEntities = useEditorStore((state) => state.deleteEntities)
  const beginBatch = useEditorStore((state) => state.beginBatch)
  const endBatch = useEditorStore((state) => state.endBatch)

  const room = findRoom(plan, opening.roomId)
  const edge = room ? roomEdge(room, opening.edgeIndex) : undefined
  const template = getOpeningTemplate(opening.kind)
  const scrub = { onScrubStart: beginBatch, onScrubEnd: endBatch }
  const maxWidth = edge ? Math.max(8, edge.length - 2) : 240

  return (
    <div className="stack">
      <Field label="Type">
        <select
          className="select"
          value={opening.kind}
          onChange={(event) => {
            const kind = event.target.value as OpeningKind
            // Changing the style should not resize or reposition an opening.
            updateOpening(opening.id, { kind })
          }}
        >
          {OPENING_TEMPLATES.map((option) => (
            <option key={option.kind} value={option.kind}>
              {option.name}
            </option>
          ))}
        </select>
      </Field>

      <LengthField
        label="Width"
        value={opening.width}
        unit={unit}
        min={8}
        max={maxWidth}
        onChange={(width) => updateOpening(opening.id, { width })}
        {...scrub}
      />

      <LengthField
        label="Distance along wall"
        value={opening.offset}
        unit={unit}
        min={opening.width / 2}
        max={edge ? maxOpeningOffset(edge.length, opening.width) : 1e6}
        onChange={(offset) => updateOpening(opening.id, { offset })}
        {...scrub}
      />

      {template.hinged && (
        <>
          <Toggle
            label="Hinge on far side"
            checked={opening.flipHinge}
            onChange={(flipHinge) => updateOpening(opening.id, { flipHinge })}
          />
          <Toggle
            label="Swing into room"
            checked={opening.flipInward}
            onChange={(flipInward) => updateOpening(opening.id, { flipInward })}
          />
        </>
      )}

      <Button
        icon="trash"
        variant="danger"
        block
        onClick={() => deleteEntities([{ kind: 'opening', id: opening.id }])}
      >
        Delete {template.hinged ? 'door' : 'window'}
      </Button>
    </div>
  )
}
