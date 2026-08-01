/**
 * Pure 2D geometry helpers. Everything here is unit-agnostic and side-effect
 * free so it can be unit tested and reused by any renderer.
 */

export interface Vec2 {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const vec = (x: number, y: number): Vec2 => ({ x, y })
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k })
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x
export const length = (a: Vec2): number => Math.hypot(a.x, a.y)
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.y - a.y)
export const midpoint = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
export const equals = (a: Vec2, b: Vec2, epsilon = 1e-6): boolean =>
  Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon

export function normalize(a: Vec2): Vec2 {
  const len = length(a)
  return len < 1e-9 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len }
}

/** Rotate by `radians` around the origin (or `origin` when supplied). */
export function rotate(point: Vec2, radians: number, origin: Vec2 = { x: 0, y: 0 }): Vec2 {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  }
}

export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180
export const toDegrees = (radians: number): number => (radians * 180) / Math.PI

/** Wrap degrees into [0, 360). */
export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const roundTo = (value: number, step: number): number =>
  step <= 0 ? value : Math.round(value / step) * step

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

/** Parameter t in [0,1] of the projection of `point` onto segment a→b. */
export function projectOnSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a)
  const lenSq = dot(ab, ab)
  if (lenSq < 1e-9) return 0
  return clamp(dot(sub(point, a), ab) / lenSq, 0, 1)
}

export function closestPointOnSegment(point: Vec2, a: Vec2, b: Vec2): Vec2 {
  return add(a, scale(sub(b, a), projectOnSegment(point, a, b)))
}

export function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  return distance(point, closestPointOnSegment(point, a, b))
}

/**
 * Intersection of two infinite lines given as point + direction.
 * Returns null when the lines are (near) parallel.
 */
export function lineIntersection(a: Vec2, da: Vec2, b: Vec2, db: Vec2): Vec2 | null {
  const denominator = cross(da, db)
  if (Math.abs(denominator) < 1e-9) return null
  const t = cross(sub(b, a), db) / denominator
  return add(a, scale(da, t))
}

// ---------------------------------------------------------------------------
// Polygons
// ---------------------------------------------------------------------------

/** Shoelace signed area. Positive when the ring winds counter-clockwise. */
export function signedArea(points: readonly Vec2[]): number {
  let total = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    total += a.x * b.y - b.x * a.y
  }
  return total / 2
}

export const polygonArea = (points: readonly Vec2[]): number => Math.abs(signedArea(points))

export function polygonPerimeter(points: readonly Vec2[]): number {
  let total = 0
  for (let i = 0; i < points.length; i++) {
    total += distance(points[i]!, points[(i + 1) % points.length]!)
  }
  return total
}

export function polygonCentroid(points: readonly Vec2[]): Vec2 {
  const area = signedArea(points)
  if (Math.abs(area) < 1e-9) return boundsCenter(polygonBounds(points))
  let x = 0
  let y = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    const factor = a.x * b.y - b.x * a.y
    x += (a.x + b.x) * factor
    y += (a.y + b.y) * factor
  }
  return { x: x / (6 * area), y: y / (6 * area) }
}

export function polygonBounds(points: readonly Vec2[]): Rect {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function pointInPolygon(point: Vec2, points: readonly Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!
    const b = points[j]!
    const straddles = a.y > point.y !== b.y > point.y
    if (straddles && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

/** Counter-clockwise copy of a ring, so normals are predictable. */
export function ensureCounterClockwise(points: readonly Vec2[]): Vec2[] {
  return signedArea(points) < 0 ? [...points].reverse() : [...points]
}

/**
 * Outward unit normal of edge a→b for a counter-clockwise ring.
 * (In screen space — y down — this points visually "outward" all the same.)
 */
export function edgeNormal(a: Vec2, b: Vec2): Vec2 {
  const d = normalize(sub(b, a))
  return { x: d.y, y: -d.x }
}

/**
 * Offset a simple polygon outward by `distance` using miter joins. Used to turn
 * a room's interior ring into the outer face of its walls.
 */
export function offsetPolygon(points: readonly Vec2[], amount: number): Vec2[] {
  const ring = ensureCounterClockwise(points)
  const count = ring.length
  if (count < 3 || amount === 0) return ring

  const result: Vec2[] = []
  for (let i = 0; i < count; i++) {
    const prev = ring[(i - 1 + count) % count]!
    const current = ring[i]!
    const next = ring[(i + 1) % count]!

    const aPrev = add(current, scale(edgeNormal(prev, current), amount))
    const aNext = add(current, scale(edgeNormal(current, next), amount))
    const hit = lineIntersection(aPrev, sub(current, prev), aNext, sub(next, current))
    // Parallel edges (collinear vertex) -> the two offset points coincide.
    const joined = hit ?? aPrev
    // Guard against runaway miters on very sharp corners.
    const withinMiterLimit = distance(joined, current) <= Math.abs(amount) * 4
    result.push(withinMiterLimit ? joined : aPrev)
  }
  return result
}

// ---------------------------------------------------------------------------
// Rects
// ---------------------------------------------------------------------------

export const boundsCenter = (r: Rect): Vec2 => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })

export function rectFromPoints(a: Vec2, b: Vec2): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

export function rectContainsPoint(r: Rect, p: Vec2): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  )
}

export function expandRect(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, width: r.width + by * 2, height: r.height + by * 2 }
}

export function unionRects(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.width)
    maxY = Math.max(maxY, r.y + r.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Corners of a rotated box, ordered TL, TR, BR, BL in local space. */
export function orientedBoxCorners(
  center: Vec2,
  width: number,
  height: number,
  rotationDegrees: number,
): Vec2[] {
  const radians = toRadians(rotationDegrees)
  const hw = width / 2
  const hh = height / 2
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((corner) => add(center, rotate(corner, radians)))
}

/** Convert a world point into a rotated box's local (un-rotated) frame. */
export function toLocalSpace(point: Vec2, center: Vec2, rotationDegrees: number): Vec2 {
  return rotate(sub(point, center), -toRadians(rotationDegrees))
}

export function pointInOrientedBox(
  point: Vec2,
  center: Vec2,
  width: number,
  height: number,
  rotationDegrees: number,
  padding = 0,
): boolean {
  const local = toLocalSpace(point, center, rotationDegrees)
  return (
    Math.abs(local.x) <= width / 2 + padding && Math.abs(local.y) <= height / 2 + padding
  )
}
