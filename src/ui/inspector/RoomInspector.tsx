import { formatArea, formatLength } from '@/core/units'
import { polygonPerimeter } from '@/core/geometry'
import { roomArea, roomRect } from '@/model/derive'
import type { Room } from '@/model/types'
import { useUnit } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { Button } from '../components/Button'
import { Field, Swatches } from '../components/Field'
import { LengthField } from '../components/LengthField'
import { Readout } from './Readout'

const FLOOR_COLORS = [
  '#ffffff',
  '#f8f5f0',
  '#f2efe8',
  '#eff2f5',
  '#e9eef0',
  '#f7efe4',
  '#ece4d8',
  '#e8eaee',
]

export function RoomInspector({ room }: { room: Room }) {
  const unit = useUnit()
  const updateRoom = useEditorStore((state) => state.updateRoom)
  const setRoomRect = useEditorStore((state) => state.setRoomRect)
  const deleteEntities = useEditorStore((state) => state.deleteEntities)
  const beginBatch = useEditorStore((state) => state.beginBatch)
  const endBatch = useEditorStore((state) => state.endBatch)

  const rect = roomRect(room)
  const scrub = { onScrubStart: beginBatch, onScrubEnd: endBatch }

  return (
    <div className="stack">
      <Field label="Name" className="inspector-name-field">
        <input
          className="input"
          value={room.name}
          spellCheck={false}
          onChange={(event) => updateRoom(room.id, { name: event.target.value })}
        />
      </Field>

      {rect ? (
        <div className="grid-2">
          <LengthField
            label="Width"
            value={rect.width}
            unit={unit}
            min={12}
            onChange={(width) => setRoomRect(room.id, { ...rect, width })}
            {...scrub}
          />
          <LengthField
            label="Height"
            value={rect.height}
            unit={unit}
            min={12}
            onChange={(height) => setRoomRect(room.id, { ...rect, height })}
            {...scrub}
          />
        </div>
      ) : (
        <p className="catalog-card__size" style={{ textAlign: 'left' }}>
          Drag the corner and wall handles on the plan to reshape this room.
        </p>
      )}

      <Field label="Floor">
        <Swatches
          value={room.floor}
          colors={FLOOR_COLORS}
          onChange={(floor) => updateRoom(room.id, { floor })}
        />
      </Field>

      <div>
        <Readout label="Area" value={formatArea(roomArea(room), unit)} />
        <Readout label="Perimeter" value={formatLength(polygonPerimeter(room.points), unit)} />
      </div>

      <Button
        icon="trash"
        variant="danger"
        block
        onClick={() => deleteEntities([{ kind: 'room', id: room.id }])}
      >
        Delete room
      </Button>
    </div>
  )
}
