import { Modal } from './components/Modal'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl'

const GROUPS: readonly { title: string; items: readonly [string, string[]][] }[] = [
  {
    title: 'Tools',
    items: [
      ['Select', ['S']],
      ['Draw room', ['R']],
      ['Create wall', ['L']],
      ['Place door', ['D']],
      ['Place window', ['W']],
      ['Measure', ['M']],
      ['Cancel / clear selection', ['Esc']],
    ],
  },
  {
    title: 'Editing',
    items: [
      ['Undo', [MOD, 'Z']],
      ['Redo', [MOD, '⇧', 'Z']],
      ['Delete selection', ['Del']],
      ['Duplicate', [MOD, 'D']],
      ['Copy / cut / paste', [MOD, 'C/X/V']],
      ['Select all', [MOD, 'A']],
      ['Nudge', ['←', '→', '↑', '↓']],
      ['Nudge further / finer', ['⇧', 'or', '⌥']],
      ['Rotate 90°', ['Q', 'E']],
      ['Send back / bring front', ['[', ']']],
    ],
  },
  {
    title: 'View',
    items: [
      ['Pan', ['Space', 'drag']],
      ['Zoom', [MOD, 'scroll']],
      ['Zoom in / out', [MOD, '+/−']],
      ['Fit plan', ['F']],
      ['Reset view', [MOD, '0']],
      ['Toggle grid / snapping', ['G', '⇧G']],
    ],
  },
  {
    title: 'While dragging',
    items: [
      ['Constrain to one axis', ['⇧']],
      ['Resize from centre', ['⌥']],
      ['Keep aspect ratio', ['⇧']],
      ['Free rotation (no 15° steps)', ['⌥']],
    ],
  },
]

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <div className="shortcut-list">
        {GROUPS.map((group) => (
          <div key={group.title} style={{ display: 'contents' }}>
            <div className="shortcut-group">{group.title}</div>
            {group.items.map(([label, keys]) => (
              <div key={label} style={{ display: 'contents' }}>
                <span className="shortcut-list__label">{label}</span>
                <span className="shortcut-list__keys">
                  {keys.map((key, index) => (
                    <kbd key={index} className="kbd">
                      {key}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  )
}
