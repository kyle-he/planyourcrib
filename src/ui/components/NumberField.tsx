import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { clamp } from '@/core/geometry'

export interface NumberFieldProps {
  label?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
}

export function NumberField({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  suffix = '',
  disabled = false,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const formatted = `${Math.round(value * 10) / 10}${suffix}`

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(null)
  }, [formatted])

  const apply = (next: number) => {
    if (!Number.isFinite(next)) return
    onChange(clamp(next, min, max))
  }

  const commit = () => {
    if (draft === null) return
    const parsed = Number.parseFloat(draft.replace(suffix, '').trim())
    setDraft(null)
    if (Number.isFinite(parsed)) apply(parsed)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
      inputRef.current?.blur()
    } else if (event.key === 'Escape') {
      setDraft(null)
      inputRef.current?.blur()
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const delta = step * (event.shiftKey ? 5 : 1) * (event.key === 'ArrowUp' ? 1 : -1)
      setDraft(null)
      apply(value + delta)
    }
  }

  return (
    <div className="field">
      {label && <span className="field__label">{label}</span>}
      <input
        ref={inputRef}
        className="input input--numeric"
        value={draft ?? formatted}
        disabled={disabled}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
