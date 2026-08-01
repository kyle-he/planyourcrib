import { useEffect, useRef } from 'react'
import { formatArea } from '@/core/units'
import { roomArea } from '@/model/derive'
import { usePlan, useUnit } from '@/state/selectors'
import { Button } from './components/Button'
import { DisplaySettings } from './inspector/DisplaySettings'
import { Readout } from './inspector/Readout'

export function SettingsMenu({
  onClose,
  onShowShortcuts,
}: {
  onClose: () => void
  onShowShortcuts: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const plan = usePlan()
  const unit = useUnit()
  const totalArea = plan.rooms.reduce((sum, room) => sum + roomArea(room), 0)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div ref={ref} className="settings-popover" role="dialog" aria-label="Plan settings">
      <div className="settings-popover__header">Settings</div>
      {/* Only this part scrolls, so the title and footer stay put. */}
      <div className="settings-popover__body">
        <section className="settings-popover__section">
          <div className="settings-popover__title">Display</div>
          <DisplaySettings />
        </section>
        <section className="settings-popover__section">
          <div className="settings-popover__title">Plan summary</div>
          <Readout label="Rooms" value={String(plan.rooms.length)} />
          <Readout label="Freestanding walls" value={String(plan.walls.length)} />
          <Readout label="Doors & windows" value={String(plan.openings.length)} />
          <Readout label="Furniture" value={String(plan.items.length)} />
          <Readout label="Total floor area" value={formatArea(totalArea, unit)} />
        </section>
      </div>
      <div className="settings-popover__footer">
        <Button
          icon="keyboard"
          variant="ghost"
          block
          onClick={() => {
            onClose()
            onShowShortcuts()
          }}
        >
          Keyboard shortcuts
        </Button>
      </div>
    </div>
  )
}
