import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { planBounds } from '@/model/derive'
import { useViewport } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { IconButton } from './components/Button'

/** Floating zoom controls in the bottom-right of the canvas. */
export function ViewportControls() {
  const viewport = useViewport()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const setZoom = useEditorStore((state) => state.setZoom)
  const fitToRect = useEditorStore((state) => state.fitToRect)
  const zoomPercent = Math.round(viewport.scale * 50)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(null)
  }, [zoomPercent])

  const commitZoom = () => {
    if (draft === null) return
    const percent = Number.parseFloat(draft.trim())
    setDraft(null)
    if (Number.isFinite(percent)) setZoom(percent / 50)
  }

  const handleZoomKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitZoom()
      inputRef.current?.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(null)
      inputRef.current?.blur()
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const amount = event.shiftKey ? 25 : 5
      const direction = event.key === 'ArrowUp' ? 1 : -1
      setDraft(null)
      setZoom((zoomPercent + direction * amount) / 50)
    }
  }

  const fit = () => {
    const bounds = planBounds(useEditorStore.getState().plan)
    if (bounds) fitToRect(bounds)
  }

  return (
    <div className="canvas-overlay canvas-overlay--bottom-right">
      <div className="floating">
        <IconButton
          icon="minus"
          label="Zoom out (⌘−)"
          variant="ghost"
          className="viewport-controls__zoom"
          onClick={() => setZoom(viewport.scale / 1.25)}
        />
        <label className="zoom-readout viewport-controls__zoom">
          <input
            ref={inputRef}
            value={draft ?? String(zoomPercent)}
            inputMode="decimal"
            aria-label="Zoom percentage"
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={commitZoom}
            onKeyDown={handleZoomKeyDown}
          />
          <span>%</span>
        </label>
        <IconButton
          icon="plus"
          label="Zoom in (⌘+)"
          variant="ghost"
          className="viewport-controls__zoom"
          onClick={() => setZoom(viewport.scale * 1.25)}
        />
        <div className="divider-v viewport-controls__zoom" />
        <IconButton icon="fit" label="Fit plan (F)" variant="ghost" onClick={fit} />
      </div>
    </div>
  )
}
