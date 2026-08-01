import { UNIT_SHORT, type UnitSystem } from '@/core/units'
import { useSettings, useUnit } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { Field, Segmented, Toggle } from '../components/Field'
import { LengthField } from '../components/LengthField'

const UNIT_OPTIONS: readonly { value: UnitSystem; label: string }[] = [
  { value: 'ftin', label: 'ft / in' },
  { value: 'in', label: UNIT_SHORT.in },
  { value: 'cm', label: UNIT_SHORT.cm },
  { value: 'm', label: UNIT_SHORT.m },
]

export function DisplaySettings() {
  const settings = useSettings()
  const unit = useUnit()
  const updateSettings = useEditorStore((state) => state.updateSettings)
  const setWallThickness = useEditorStore((state) => state.setWallThickness)
  const beginBatch = useEditorStore((state) => state.beginBatch)
  const endBatch = useEditorStore((state) => state.endBatch)

  return (
    <div className="stack">
      <Field label="Units">
        <Segmented
          value={settings.unit}
          options={UNIT_OPTIONS}
          onChange={(nextUnit) => updateSettings({ unit: nextUnit })}
        />
      </Field>

      <LengthField
        label="Grid & snap step"
        value={settings.gridStep}
        unit={unit}
        min={0.25}
        max={120}
        onChange={(gridStep) => updateSettings({ gridStep })}
      />

      <LengthField
        label="Wall thickness"
        value={settings.wallThickness}
        unit={unit}
        min={1}
        max={24}
        onChange={setWallThickness}
        onScrubStart={beginBatch}
        onScrubEnd={endBatch}
      />

      <div>
        <Toggle
          label="Show grid"
          checked={settings.showGrid}
          onChange={(showGrid) => updateSettings({ showGrid })}
        />
        <Toggle
          label="Movement snapping"
          checked={settings.snapToGrid && settings.snapToObjects}
          onChange={(enabled) => updateSettings({
            snapToGrid: enabled,
            snapToObjects: enabled,
          })}
        />
        <Toggle
          label="Rotation snapping"
          checked={settings.snapRotation}
          onChange={(snapRotation) => updateSettings({ snapRotation })}
        />
        <Toggle
          label="Wall dimensions"
          checked={settings.showDimensions}
          onChange={(showDimensions) => updateSettings({ showDimensions })}
        />
        <Toggle
          label="Room names"
          checked={settings.showNames}
          onChange={(showNames) => updateSettings({ showNames })}
        />
        <Toggle
          label="Room areas"
          checked={settings.showAreas}
          onChange={(showAreas) => updateSettings({ showAreas })}
        />
      </div>
    </div>
  )
}
