import { planBounds } from '@/model/derive'
import { useViewport } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { IconButton } from './components/Button'

/** Floating zoom controls in the bottom-right of the canvas. */
export function ViewportControls() {
  const viewport = useViewport()
  const setZoom = useEditorStore((state) => state.setZoom)
  const fitToRect = useEditorStore((state) => state.fitToRect)

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
          onClick={() => setZoom(viewport.scale / 1.25)}
        />
        <span className="zoom-readout">{Math.round(viewport.scale * 50)}%</span>
        <IconButton
          icon="plus"
          label="Zoom in (⌘+)"
          variant="ghost"
          onClick={() => setZoom(viewport.scale * 1.25)}
        />
        <div className="divider-v" />
        <IconButton icon="fit" label="Fit plan (F)" variant="ghost" onClick={fit} />
      </div>
    </div>
  )
}
