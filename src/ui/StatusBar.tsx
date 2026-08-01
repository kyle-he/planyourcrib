import { formatLength } from '@/core/units'
import { useResolvedSelection, useSettings, useTool, useUnit } from '@/state/selectors'
import { Icon } from './components/Icon'

const TOOL_HINTS: Record<string, string> = {
  select: 'Drag empty space to pan · Shift-drag to marquee · Shift-click to multi-select',
  room: 'Drag on the plan to draw a room',
  opening: 'Click a wall to place · Shift-click to keep placing',
  item: 'Click the plan to place · Shift-click to keep placing · Esc to cancel',
  measure: 'Click to set a start, click again to finish · Drag to measure · Esc to clear',
}

export function StatusBar() {
  const tool = useTool()
  const unit = useUnit()
  const settings = useSettings()
  const selection = useResolvedSelection()
  const count = selection.rooms.length + selection.items.length + selection.openings.length
  const hint = TOOL_HINTS[tool] ?? ''

  return (
    <footer className="statusbar">
      <span className="statusbar__item statusbar__hint" title={hint}>
        {hint}
      </span>
      <span className="statusbar__spacer" />
      {count > 0 && <span className="statusbar__item">{count} selected</span>}
      <span className="statusbar__item" title="Grid and snap step">
        <Icon name="grid" size={13} />
        {formatLength(settings.gridStep, unit)}
      </span>
    </footer>
  )
}
