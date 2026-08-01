import {
  add,
  distance,
  midpoint,
  normalize,
  normalizeDegrees,
  scale,
  sub,
  toDegrees,
  toRadians,
} from '@/core/geometry'
import { formatLength } from '@/core/units'
import type { Wall } from '@/model/types'
import { useUnit } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { Button } from '../components/Button'
import { LengthField } from '../components/LengthField'
import { NumberField } from '../components/NumberField'
import { Readout } from './Readout'

export function WallInspector({ wall }: { wall: Wall }) {
  const unit = useUnit()
  const updateWall = useEditorStore((state) => state.updateWall)
  const rotateEntities = useEditorStore((state) => state.rotateEntities)
  const deleteEntities = useEditorStore((state) => state.deleteEntities)
  const beginBatch = useEditorStore((state) => state.beginBatch)
  const endBatch = useEditorStore((state) => state.endBatch)
  const length = distance(wall.a, wall.b)
  const direction = normalize(sub(wall.b, wall.a))
  const rotation = normalizeDegrees(toDegrees(Math.atan2(direction.y, direction.x)))
  const center = midpoint(wall.a, wall.b)
  const scrub = { onScrubStart: beginBatch, onScrubEnd: endBatch }
  const ref = { kind: 'wall' as const, id: wall.id }

  const setRotation = (degrees: number) => {
    const radians = toRadians(normalizeDegrees(degrees))
    const half = length / 2
    const offset = { x: Math.cos(radians) * half, y: Math.sin(radians) * half }
    updateWall(wall.id, { a: sub(center, offset), b: add(center, offset) })
  }

  return (
    <div className="stack">
      <LengthField
        label="Length"
        value={length}
        unit={unit}
        min={8}
        onChange={(next) => updateWall(wall.id, { b: add(wall.a, scale(direction, next)) })}
        {...scrub}
      />
      <LengthField
        label="Thickness"
        value={wall.thickness}
        unit={unit}
        min={1}
        onChange={(thickness) => updateWall(wall.id, { thickness })}
        {...scrub}
      />
      <div className="row item-inspector__rotation" style={{ alignItems: 'flex-end' }}>
        <NumberField
          label="Rotation"
          value={rotation}
          suffix="°"
          step={15}
          scrubbable
          min={-360}
          max={360}
          onChange={setRotation}
          {...scrub}
        />
        <Button
          icon="rotate"
          className="item-inspector__rotate"
          title="Rotate clockwise by 90° (E)"
          onClick={() => rotateEntities([ref], 90)}
        >
          Rotate 90°
        </Button>
      </div>
      <Readout label="Wall length" value={formatLength(length, unit)} />
      <Button
        icon="trash"
        variant="danger"
        block
        onClick={() => deleteEntities([ref])}
      >
        Delete wall
      </Button>
    </div>
  )
}
