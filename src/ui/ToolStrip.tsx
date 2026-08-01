import { useEditorStore } from '@/state/store'
import type { ToolId } from '@/state/types'
import { Icon, type IconName } from './components/Icon'

interface ToolButton {
  id: string
  label: string
  icon: IconName
  hint: string
  tool: ToolId
}

const TOOLS: readonly ToolButton[] = [
  { id: 'select', label: 'Select (S)', icon: 'cursor', hint: 'Select and move (S)', tool: 'select' },
  { id: 'room', label: 'Create room (R)', icon: 'room', hint: 'Create a room (R)', tool: 'room' },
  { id: 'measure', label: 'Measure (M)', icon: 'ruler', hint: 'Measure a distance (M)', tool: 'measure' },
]

export function ToolStrip() {
  const tool = useEditorStore((state) => state.tool)
  const setTool = useEditorStore((state) => state.setTool)

  const isActive = (button: ToolButton) => button.tool === tool

  return (
    <div className="toolstrip" role="toolbar" aria-label="Tools">
      {TOOLS.map((button) => (
        <button
          key={button.id}
          type="button"
          title={button.hint}
          aria-pressed={isActive(button)}
          className={`tool${isActive(button) ? ' is-active' : ''}`}
          onClick={() => setTool(button.tool)}
        >
          <Icon name={button.icon} size={17} />
          <span>{button.label}</span>
        </button>
      ))}
    </div>
  )
}
