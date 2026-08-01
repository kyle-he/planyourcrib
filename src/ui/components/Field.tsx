import type { ReactNode } from 'react'

export function Field({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <label className="field">
      {label && <span className="field__label">{label}</span>}
      {children}
    </label>
  )
}

export interface SegmentedProps<T extends string> {
  value: T
  options: readonly { value: T; label: string; title?: string }[]
  onChange: (value: T) => void
}

export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          title={option.title}
          className={`segmented__option${option.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="toggle">
      <span className="toggle__label">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      <span className={`toggle__track${checked ? ' is-on' : ''}`}>
        <span className="toggle__knob" />
      </span>
    </label>
  )
}

export interface SwatchesProps {
  value: string
  colors: readonly string[]
  onChange: (color: string) => void
}

export function Swatches({ value, colors, onChange }: SwatchesProps) {
  return (
    <div className="swatches">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          title={color}
          className={`swatch${color.toLowerCase() === value.toLowerCase() ? ' is-active' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}
