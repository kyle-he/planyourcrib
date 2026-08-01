import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
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
  scrubbable?: boolean
  /** Called around a scrub gesture so callers can group undo history. */
  onScrubStart?: () => void
  onScrubEnd?: () => void
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
  scrubbable = false,
  onScrubStart,
  onScrubEnd,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suppressClick = useRef(false)
  const formatted = String(Math.round(value * 10) / 10)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(null)
  }, [formatted])

  const apply = (next: number) => {
    if (!Number.isFinite(next)) return
    onChange(clamp(next, min, max))
  }

  const commit = () => {
    if (draft === null) return
    const parsed = Number.parseFloat(draft.trim())
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

  const handlePointerDown = (event: PointerEvent<HTMLInputElement>) => {
    if (!scrubbable || disabled || event.button !== 0) return
    const input = event.currentTarget
    const pointerId = event.pointerId
    const startX = event.clientX
    const startValue = value
    let moved = false
    input.setPointerCapture(pointerId)

    const move = (moveEvent: globalThis.PointerEvent) => {
      const movement = moveEvent.clientX - startX
      if (!moved && Math.abs(movement) < 3) return
      if (!moved) {
        moved = true
        setDraft(null)
        onScrubStart?.()
      }
      moveEvent.preventDefault()
      apply(startValue + movement * (moveEvent.shiftKey ? 5 : 1))
    }
    const finish = () => {
      if (input.hasPointerCapture(pointerId)) input.releasePointerCapture(pointerId)
      input.removeEventListener('pointermove', move)
      input.removeEventListener('pointerup', finish)
      input.removeEventListener('pointercancel', finish)
      if (moved) {
        suppressClick.current = true
        onScrubEnd?.()
      }
    }

    input.addEventListener('pointermove', move)
    input.addEventListener('pointerup', finish)
    input.addEventListener('pointercancel', finish)
  }

  return (
    <div className="field">
      {label && <span className="field__label">{label}</span>}
      <label className={suffix ? 'number-field__control' : undefined}>
        <input
          ref={inputRef}
          className={`input input--numeric${scrubbable ? ' input--scrubbable' : ''}`}
          value={draft ?? formatted}
          disabled={disabled}
          inputMode="decimal"
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onClick={(event) => {
            if (!suppressClick.current) return
            suppressClick.current = false
            event.preventDefault()
            event.currentTarget.blur()
          }}
        />
        {suffix && <span>{suffix}</span>}
      </label>
    </div>
  )
}
