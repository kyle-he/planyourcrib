import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getGlyph, usesCustomFootprint } from '@/editor/glyphs'
import {
  CATEGORIES,
  ITEM_TEMPLATES,
  type ItemTemplate,
} from '@/model/catalog'
import './item-workshop.css'

interface GlyphMetrics {
  centerX: number
  centerY: number
  width: number
  height: number
  overflow: boolean
  offCenter: boolean
}

interface ReviewResult {
  template: ItemTemplate
  metrics: GlyphMetrics
}

/**
 * Development-only contact sheet for reviewing the complete item language.
 * Open with `npm run review:items`.
 */
export function ItemWorkshop() {
  const [query, setQuery] = useState('')
  const [showGuides, setShowGuides] = useState(true)
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [largeCards, setLargeCards] = useState(false)
  const [results, setResults] = useState<Record<string, GlyphMetrics>>({})
  const [copied, setCopied] = useState(false)

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return ITEM_TEMPLATES.filter((template) => {
      const matchesQuery =
        !needle ||
        template.name.toLowerCase().includes(needle) ||
        template.id.includes(needle) ||
        template.glyph.toLowerCase().includes(needle)
      const metrics = results[template.id]
      return matchesQuery && (!onlyFlagged || metrics?.offCenter || metrics?.overflow)
    })
  }, [onlyFlagged, query, results])

  const flagged = ITEM_TEMPLATES.filter((template) => {
    const metrics = results[template.id]
    return metrics?.offCenter || metrics?.overflow
  })

  const copyReport = async () => {
    const report: ReviewResult[] = flagged.map((template) => ({
      template,
      metrics: results[template.id]!,
    }))
    await navigator.clipboard.writeText(
      report
        .map(({ template, metrics }) => {
          const dx = formatOffset(metrics.centerX)
          const dy = formatOffset(metrics.centerY)
          return `${template.id} (${template.glyph}): center ${dx}, ${dy}${metrics.overflow ? '; OVERFLOW' : ''}`
        })
        .join('\n'),
    )
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <main className="item-workshop">
      <header className="item-workshop__header">
        <div>
          <div className="item-workshop__eyebrow">One-time development tool</div>
          <h1>Item artwork workshop</h1>
          <p>
            Every catalog footprint at its real aspect ratio. Dashed crosshairs mark the true center;
            the amber box is the measured artwork bound. Small overhangs from raised details are
            intentional; larger escapes are flagged.
          </p>
          <p className="item-workshop__editing-note">
            Edit <code>src/editor/glyphs.tsx</code> and save to update this page live. Items with the
            same glyph key update together.
          </p>
        </div>
        <a className="btn" href="/">Back to planner</a>
      </header>

      <section className="item-workshop__toolbar" aria-label="Workshop controls">
        <label className="item-workshop__search">
          <span>Filter</span>
          <input
            value={query}
            type="search"
            placeholder="Name, id, or glyph…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="item-workshop__check">
          <input
            type="checkbox"
            checked={showGuides}
            onChange={(event) => setShowGuides(event.target.checked)}
          />
          Center + bounds
        </label>
        <label className="item-workshop__check">
          <input
            type="checkbox"
            checked={onlyFlagged}
            onChange={(event) => setOnlyFlagged(event.target.checked)}
          />
          Flagged only
        </label>
        <label className="item-workshop__check">
          <input
            type="checkbox"
            checked={largeCards}
            onChange={(event) => setLargeCards(event.target.checked)}
          />
          Large cards
        </label>
        <div className="item-workshop__summary" aria-live="polite">
          <strong>{matches.length}</strong> shown · <strong>{flagged.length}</strong> flagged
        </div>
        <button className="btn" type="button" disabled={flagged.length === 0} onClick={copyReport}>
          {copied ? 'Copied' : 'Copy issue report'}
        </button>
      </section>

      <div className={`item-workshop__content${largeCards ? ' is-large' : ''}`}>
        {CATEGORIES.map((category) => {
          const templates = matches.filter((template) => template.category === category.id)
          if (templates.length === 0) return null
          return (
            <section className="item-workshop__category" key={category.id}>
              <div className="item-workshop__category-heading">
                <span className="item-workshop__swatch" style={{ background: category.tint }} />
                <h2>{category.label}</h2>
                <span>{templates.length}</span>
              </div>
              <div className="item-workshop__grid">
                {templates.map((template) => (
                  <GlyphReviewCard
                    key={template.id}
                    template={template}
                    showGuides={showGuides}
                    onMeasure={(metrics) =>
                      setResults((current) =>
                        sameMetrics(current[template.id], metrics)
                          ? current
                          : { ...current, [template.id]: metrics },
                      )
                    }
                  />
                ))}
              </div>
            </section>
          )
        })}
        {matches.length === 0 && (
          <div className="item-workshop__empty">No items match this review.</div>
        )}
      </div>
    </main>
  )
}

function GlyphReviewCard({
  template,
  showGuides,
  onMeasure,
}: {
  template: ItemTemplate
  showGuides: boolean
  onMeasure: (metrics: GlyphMetrics) => void
}) {
  const artRef = useRef<SVGGElement>(null)
  const Glyph = getGlyph(template.glyph)
  const { width: w, depth: h } = template
  const pad = Math.max(w, h) * 0.1

  useLayoutEffect(() => {
    const bounds = artRef.current?.getBBox()
    if (!bounds) return
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2
    const toleranceX = Math.max(1, w * 0.035)
    // High backs, headboards, tanks, and faucets legitimately bias the visual
    // bound toward one edge even though the footprint remains centred.
    const toleranceY = Math.max(1.5, h * 0.1)
    const edgeTolerance = allowedOverhang(w, h)
    onMeasure({
      centerX,
      centerY,
      width: bounds.width,
      height: bounds.height,
      offCenter: Math.abs(centerX) > toleranceX || Math.abs(centerY) > toleranceY,
      overflow:
        bounds.x < -w / 2 - edgeTolerance ||
        bounds.y < -h / 2 - edgeTolerance ||
        bounds.x + bounds.width > w / 2 + edgeTolerance ||
        bounds.y + bounds.height > h / 2 + edgeTolerance,
    })
  }, [h, onMeasure, w])

  const status = (() => {
    const bounds = artRef.current?.getBBox()
    if (!bounds) return null
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2
    const offCenter =
      Math.abs(centerX) > Math.max(1, w * 0.035) ||
      Math.abs(centerY) > Math.max(1.5, h * 0.1)
    const edgeTolerance = allowedOverhang(w, h)
    const overflow =
      bounds.x < -w / 2 - edgeTolerance ||
      bounds.y < -h / 2 - edgeTolerance ||
      bounds.x + bounds.width > w / 2 + edgeTolerance ||
      bounds.y + bounds.height > h / 2 + edgeTolerance
    return { centerX, centerY, offCenter, overflow }
  })()

  return (
    <article
      className={`item-review-card${status?.offCenter || status?.overflow ? ' is-flagged' : ''}`}
      data-template-id={template.id}
    >
      <div className="item-review-card__stage">
        <svg
          viewBox={`${-w / 2 - pad} ${-h / 2 - pad} ${w + pad * 2} ${h + pad * 2}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label={`${template.name} top-down artwork`}
        >
          {showGuides && (
            <g className="item-review-card__guides">
              <rect x={-w / 2} y={-h / 2} width={w} height={h} />
              <line x1={-w / 2 - pad / 2} y1={0} x2={w / 2 + pad / 2} y2={0} />
              <line x1={0} y1={-h / 2 - pad / 2} x2={0} y2={h / 2 + pad / 2} />
            </g>
          )}
          {!usesCustomFootprint(template.glyph) && (
            <rect
              className="item-review-card__footprint"
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              rx={1.5}
              fill={template.color}
            />
          )}
          <g ref={artRef} className="item-review-card__glyph" color="currentColor">
            <Glyph w={w} h={h} fill={template.color} />
          </g>
          {showGuides && artRef.current && <MeasuredBounds node={artRef.current} />}
        </svg>
      </div>
      <div className="item-review-card__info">
        <div className="item-review-card__title-row">
          <strong>{template.name}</strong>
          {status?.overflow ? <span className="item-review-card__badge">overflow</span> : null}
          {status?.offCenter ? <span className="item-review-card__badge">offset</span> : null}
        </div>
        <div className="item-review-card__meta">
          <code>{template.glyph}</code>
          <span>{template.width} × {template.depth} in</span>
          {status && <span>Δ {formatOffset(status.centerX)}, {formatOffset(status.centerY)}</span>}
        </div>
      </div>
    </article>
  )
}

function MeasuredBounds({ node }: { node: SVGGElement }) {
  const bounds = node.getBBox()
  return (
    <rect
      className="item-review-card__bounds"
      x={bounds.x}
      y={bounds.y}
      width={bounds.width}
      height={bounds.height}
    />
  )
}

function formatOffset(value: number): string {
  if (Math.abs(value) < 0.05) return '0'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
}

/** Raised details may visually exceed the true footprint by a restrained halo. */
function allowedOverhang(w: number, h: number): number {
  return Math.min(1.75, Math.max(0.85, Math.min(w, h) * 0.085)) + 0.05
}

function sameMetrics(a: GlyphMetrics | undefined, b: GlyphMetrics): boolean {
  return (
    !!a &&
    a.centerX === b.centerX &&
    a.centerY === b.centerY &&
    a.width === b.width &&
    a.height === b.height &&
    a.overflow === b.overflow &&
    a.offCenter === b.offCenter
  )
}
