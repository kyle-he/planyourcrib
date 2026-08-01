/**
 * Unit handling.
 *
 * The document stores every length as a plain number of INCHES. Units only ever
 * matter at the presentation boundary (formatting for display, parsing user
 * input), so the rest of the app never has to think about them.
 */

export type UnitSystem = 'ftin' | 'in' | 'cm' | 'm'

export const UNIT_LABELS: Record<UnitSystem, string> = {
  ftin: 'ft / in',
  in: 'inches',
  cm: 'centimeters',
  m: 'meters',
}

export const UNIT_SHORT: Record<UnitSystem, string> = {
  ftin: `ft'in"`,
  in: 'in',
  cm: 'cm',
  m: 'm',
}

const CM_PER_INCH = 2.54

/** Trim trailing zeros from a fixed-decimal string: 3.50 -> 3.5, 4.00 -> 4 */
function trimDecimals(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.?0+$/, '')
}

/** Human-readable length, e.g. `12 ft 6.5 in`, `150 in`, `381 cm`, `3.81 m`. */
export function formatLength(inches: number, unit: UnitSystem): string {
  switch (unit) {
    case 'ftin': {
      const sign = inches < 0 ? '-' : ''
      const abs = Math.abs(inches)
      const feet = Math.floor(abs / 12)
      const rest = abs - feet * 12
      if (feet === 0) return `${sign}${trimDecimals(rest, 2)} in`
      if (rest < 0.005) return `${sign}${feet} ft`
      return `${sign}${feet} ft ${trimDecimals(rest, 2)} in`
    }
    case 'in':
      return `${trimDecimals(inches, 2)} in`
    case 'cm':
      return `${trimDecimals(inches * CM_PER_INCH, 1)} cm`
    case 'm':
      return `${trimDecimals((inches * CM_PER_INCH) / 100, 3)} m`
  }
}

/** Compact form for dense labels (drops the unit suffix where unambiguous). */
export function formatLengthCompact(inches: number, unit: UnitSystem): string {
  if (unit === 'cm') return trimDecimals(inches * CM_PER_INCH, 0)
  if (unit === 'm') return trimDecimals((inches * CM_PER_INCH) / 100, 2)
  return formatLength(inches, unit)
}

export function formatArea(squareInches: number, unit: UnitSystem): string {
  if (unit === 'cm' || unit === 'm') {
    const squareMeters = squareInches * (CM_PER_INCH / 100) ** 2
    return `${trimDecimals(squareMeters, 2)} m²`
  }
  return `${trimDecimals(squareInches / 144, 1)} ft²`
}

const NUMBER = String.raw`\d*\.?\d+`
const PATTERNS = {
  // 12' 6 1/2"  |  12'6  |  12'
  feetInches: new RegExp(
    String.raw`^(${NUMBER})\s*(?:'|ft|feet)\s*(?:(${NUMBER})\s*(?:(${NUMBER})\s*/\s*(${NUMBER}))?\s*(?:"|in|inch|inches)?)?$`,
    'i',
  ),
  // 6 1/2" | 1/2" | 6"
  inches: new RegExp(
    String.raw`^(?:(${NUMBER})\s+)?(?:(${NUMBER})\s*/\s*(${NUMBER}))?\s*(?:"|in|inch|inches)$`,
    'i',
  ),
  metric: new RegExp(String.raw`^(${NUMBER})\s*(mm|cm|m)$`, 'i'),
  // Plain imperial entry: `12 6.5` means 12 feet, 6.5 inches.
  feetInchesPlain: new RegExp(String.raw`^(${NUMBER})\s+(${NUMBER})$`),
  // Bare "6 1/2" or "1/2" or "6.5"
  bare: new RegExp(String.raw`^(?:(${NUMBER})\s+)?(?:(${NUMBER})\s*/\s*(${NUMBER}))?$`),
} as const

function num(value: string | undefined): number {
  return value === undefined ? 0 : Number(value)
}

/**
 * Parse a user-typed length into inches. Explicit units in the string always
 * win; otherwise the value is interpreted in `unit`. Returns null when the
 * input isn't a length so callers can reject the edit and restore the field.
 */
export function parseLength(raw: string, unit: UnitSystem): number | null {
  const text = raw.trim().replace(/[\u2032\u2019]/g, "'").replace(/[\u2033\u201D]/g, '"')
  if (!text) return null

  const feetMatch = PATTERNS.feetInches.exec(text)
  if (feetMatch) {
    const [, feet, whole, fracNum, fracDen] = feetMatch
    const fraction = fracDen && Number(fracDen) !== 0 ? num(fracNum) / Number(fracDen) : 0
    return num(feet) * 12 + num(whole) + fraction
  }

  const inchMatch = PATTERNS.inches.exec(text)
  if (inchMatch) {
    const [, whole, fracNum, fracDen] = inchMatch
    if (whole === undefined && fracNum === undefined) return null
    const fraction = fracDen && Number(fracDen) !== 0 ? num(fracNum) / Number(fracDen) : 0
    return num(whole) + fraction
  }

  const metricMatch = PATTERNS.metric.exec(text)
  if (metricMatch) {
    const value = num(metricMatch[1])
    const suffix = (metricMatch[2] ?? 'cm').toLowerCase()
    const cm = suffix === 'mm' ? value / 10 : suffix === 'm' ? value * 100 : value
    return cm / CM_PER_INCH
  }

  const plainFeetInches = PATTERNS.feetInchesPlain.exec(text)
  if (plainFeetInches && unit === 'ftin') {
    return num(plainFeetInches[1]) * 12 + num(plainFeetInches[2])
  }

  const bare = PATTERNS.bare.exec(text)
  if (bare) {
    const [, whole, fracNum, fracDen] = bare
    if (whole === undefined && fracNum === undefined) return null
    const fraction = fracDen && Number(fracDen) !== 0 ? num(fracNum) / Number(fracDen) : 0
    const value = num(whole) + fraction
    if (unit === 'cm') return value / CM_PER_INCH
    if (unit === 'm') return (value * 100) / CM_PER_INCH
    return value
  }

  return null
}

/** Grid/snap step in inches that feels natural for the active unit system. */
export function defaultGridStep(unit: UnitSystem): number {
  return unit === 'cm' || unit === 'm' ? 10 / CM_PER_INCH : 6
}

/** Heavier grid line every foot (imperial) or metre (metric). */
export function gridMajorStep(unit: UnitSystem, minorStep: number): number {
  const natural = unit === 'cm' || unit === 'm' ? 100 / CM_PER_INCH : 12
  return minorStep >= natural ? minorStep * 4 : natural
}

export const inchesFromCm = (cm: number) => cm / CM_PER_INCH
export const cmFromInches = (inches: number) => inches * CM_PER_INCH
