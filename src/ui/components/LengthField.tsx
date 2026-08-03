import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { clamp } from '@/core/geometry'
import { cmFromInches, parseLength, UNIT_SHORT, type UnitSystem } from '@/core/units'

export interface LengthFieldProps {
  label?: string
  /** Value in inches. */
  value: number
  unit: UnitSystem
  onChange: (inches: number) => void
  min?: number
  max?: number
  disabled?: boolean
  /** Called around a scrub gesture so callers can group undo history. */
  onScrubStart?: () => void
  onScrubEnd?: () => void
}

/** One nudge of the arrow keys / scrub drag, expressed in inches. */
function stepFor(unit: UnitSystem): number {
  return unit === 'cm' || unit === 'm' ? 1 / 2.54 : 1
}

export function LengthField({
  label,
  value,
  unit,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  disabled = false,
  onScrubStart,
  onScrubEnd,
}: LengthFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [feetDraft, setFeetDraft] = useState<string | null>(null)
  const [inchesDraft, setInchesDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const feetRef = useRef<HTMLInputElement>(null)
  const inchesRef = useRef<HTMLInputElement>(null)
  const formatted = formatUnitValue(value, unit)
  const absoluteValue = Math.abs(value)
  const wholeFeet = Math.floor(absoluteValue / 12)
  const displayedFeet = `${value < 0 ? '-' : ''}${wholeFeet}`
  const remainingInches = absoluteValue - wholeFeet * 12

  // Drop a stale draft if the value changes underneath us (undo, drag, ...).
  useEffect(() => {
    if (
      document.activeElement !== inputRef.current &&
      document.activeElement !== feetRef.current &&
      document.activeElement !== inchesRef.current
    ) {
      setDraft(null)
      setFeetDraft(null)
      setInchesDraft(null)
      setInvalid(false)
    }
  }, [formatted])

  const apply = (next: number) => onChange(clamp(next, min, max))

  const commitDraft = (): boolean => {
    if (draft === null) return true
    const parsed = parseLength(draft, unit)
    if (parsed === null) {
      setInvalid(true)
      return false
    }
    setInvalid(false)
    setDraft(null)
    apply(parsed)
    return true
  }

  const imperialValue = (): number | null => {
    const feetText = feetDraft === null ? displayedFeet : feetDraft.trim()
    const feet = Number(feetText)
    const inches = inchesDraft === null ? remainingInches : Number(inchesDraft.trim())
    if (!Number.isFinite(feet) || !Number.isFinite(inches) || inches < 0) return null
    const magnitude = Math.abs(feet) * 12 + inches
    return feetText.startsWith('-') ? -magnitude : magnitude
  }

  const commitImperial = (): boolean => {
    const parsed = imperialValue()
    if (parsed === null) {
      setInvalid(true)
      return false
    }
    setInvalid(false)
    setFeetDraft(null)
    setInchesDraft(null)
    apply(parsed)
    return true
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (commitDraft()) inputRef.current?.blur()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(null)
      setInvalid(false)
      inputRef.current?.blur()
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const base = draft === null ? value : parseLength(draft, unit) ?? value
      const step = stepFor(unit) * (event.shiftKey ? 10 : 1)
      setDraft(null)
      apply(base + (event.key === 'ArrowUp' ? step : -step))
    }
  }

  const handleImperialKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    part: 'feet' | 'inches',
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (commitImperial()) event.currentTarget.blur()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setFeetDraft(null)
      setInchesDraft(null)
      setInvalid(false)
      event.currentTarget.blur()
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const direction = event.key === 'ArrowUp' ? 1 : -1
      const amount = (part === 'feet' ? 12 : 1) * (event.shiftKey ? 10 : 1)
      setFeetDraft(null)
      setInchesDraft(null)
      apply((imperialValue() ?? value) + direction * amount)
    }
  }

  const handleScrub = (event: PointerEvent<HTMLSpanElement>) => {
    if (disabled || event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startValue = value
    const step = stepFor(unit)
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    onScrubStart?.()

    const move = (moveEvent: globalThis.PointerEvent) => {
      const multiplier = moveEvent.shiftKey ? 4 : 1
      apply(startValue + (moveEvent.clientX - startX) * step * multiplier)
    }
    const up = () => {
      target.releasePointerCapture(event.pointerId)
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      onScrubEnd?.()
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  const labelElement = label && (
    <span
      className="field__label"
      style={{ cursor: disabled ? 'default' : 'ew-resize', width: 'fit-content' }}
      onPointerDown={handleScrub}
      title="Drag to adjust"
    >
      {label}
    </span>
  )

  if (unit === 'ftin') {
    return (
      <div className="field">
        {labelElement}
        <div className={`length-field__parts${invalid ? ' is-invalid' : ''}`}>
          <label className="length-field__part">
            <input
              ref={feetRef}
              className="input input--numeric"
              value={feetDraft ?? displayedFeet}
              disabled={disabled}
              inputMode="decimal"
              aria-label={`${label ?? 'Length'} in feet`}
              onChange={(event) => {
                setFeetDraft(event.target.value)
                setInvalid(false)
              }}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => {
                if (!commitImperial()) {
                  setFeetDraft(null)
                  setInchesDraft(null)
                  setInvalid(false)
                }
              }}
              onKeyDown={(event) => handleImperialKeyDown(event, 'feet')}
            />
            <span>ft</span>
          </label>
          <label className="length-field__part">
            <input
              ref={inchesRef}
              className="input input--numeric"
              value={inchesDraft ?? formatDecimal(remainingInches)}
              disabled={disabled}
              inputMode="decimal"
              aria-label={`${label ?? 'Length'} in inches`}
              onChange={(event) => {
                setInchesDraft(event.target.value)
                setInvalid(false)
              }}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => {
                if (!commitImperial()) {
                  setFeetDraft(null)
                  setInchesDraft(null)
                  setInvalid(false)
                }
              }}
              onKeyDown={(event) => handleImperialKeyDown(event, 'inches')}
            />
            <span>in</span>
          </label>
        </div>
      </div>
    )
  }

  return (
    <div className="field">
      {labelElement}
      <label className={`length-field__part${invalid ? ' is-invalid' : ''}`}>
        <input
          ref={inputRef}
          className="input input--numeric"
          value={draft ?? formatted}
          disabled={disabled}
          inputMode="decimal"
          spellCheck={false}
          aria-label={label}
          onChange={(event) => {
            setDraft(event.target.value)
            setInvalid(false)
          }}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={() => {
            if (!commitDraft()) {
              setDraft(null)
              setInvalid(false)
            }
          }}
          onKeyDown={handleKeyDown}
        />
        <span>{UNIT_SHORT[unit]}</span>
      </label>
    </div>
  )
}

function formatDecimal(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

function formatUnitValue(value: number, unit: UnitSystem): string {
  if (unit === 'cm') return formatDecimal(cmFromInches(value))
  if (unit === 'm') return (cmFromInches(value) / 100).toFixed(3).replace(/\.?0+$/, '')
  return formatDecimal(value)
}
