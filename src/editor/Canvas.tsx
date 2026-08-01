import { useEffect, useRef } from 'react'
import { planBounds } from '@/model/derive'
import { useResolvedSelection, useSettings, useUnit, useViewport } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { SceneContext } from './EditorContext'
import { useCanvasInteractions } from './interactions/useCanvasInteractions'
import { useImageDrop } from './interactions/useImageDrop'
import { DimensionsLayer } from './layers/DimensionsLayer'
import { GridLayer } from './layers/GridLayer'
import { ItemsLayer } from './layers/ItemsLayer'
import { LabelsLayer } from './layers/LabelsLayer'
import { OpeningsLayer } from './layers/OpeningsLayer'
import { PreviewLayer } from './layers/PreviewLayer'
import { RoomsLayer } from './layers/RoomsLayer'
import { SelectionLayer } from './layers/SelectionLayer'

export function Canvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewport = useViewport()
  const settings = useSettings()
  const unit = useUnit()
  const plan = useEditorStore((state) => state.plan)
  const tool = useEditorStore((state) => state.tool)
  const openingKind = useEditorStore((state) => state.openingKind)
  const setViewportSize = useEditorStore((state) => state.setViewportSize)
  const fitToRect = useEditorStore((state) => state.fitToRect)
  const selection = useResolvedSelection()
  const selectedVertex = useEditorStore((state) => state.selectedVertex)
  const interactions = useCanvasInteractions(hostRef)
  const drop = useImageDrop(hostRef)
  const vertexRoom = selectedVertex
    ? plan.rooms.find((room) => room.id === selectedVertex.roomId)
    : undefined
  const selectedRooms =
    vertexRoom && !selection.rooms.some((room) => room.id === vertexRoom.id)
      ? [...selection.rooms, vertexRoom]
      : selection.rooms

  // Keep the viewport in sync with the element size.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect
      if (box) setViewportSize(box.width, box.height)
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [setViewportSize])

  // Frame the plan on first load.
  const framed = useRef(false)
  useEffect(() => {
    if (framed.current || viewport.width <= 1) return
    framed.current = true
    const bounds = planBounds(useEditorStore.getState().plan)
    if (bounds) fitToRect(bounds)
  }, [fitToRect, viewport.width])

  return (
    <SceneContext.Provider value={interactions.scene}>
      <div
        ref={hostRef}
        className={`canvas-host${drop.active ? ' canvas-host--image-drag' : ''}`}
        data-cursor={interactions.cursor}
        onPointerDown={interactions.onPointerDown}
        onPointerMove={interactions.onPointerMove}
        onPointerUp={interactions.onPointerUp}
        onPointerCancel={interactions.onPointerUp}
        onDoubleClick={interactions.onDoubleClick}
        onDragEnter={drop.onDragEnter}
        onDragOver={drop.onDragOver}
        onDragLeave={drop.onDragLeave}
        onDrop={drop.onDrop}
      >
        {drop.active && (
          <div className="canvas-drop-overlay" aria-hidden="true">
            <span>Drop to place</span>
          </div>
        )}
        <svg width="100%" height="100%">
          {/* Shapes only accept input with the select tool, so drawing and
              placing always land on the canvas instead of the shape below. */}
          <g
            transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}
            pointerEvents={tool === 'select' ? undefined : 'none'}
          >
            {settings.showGrid && (
              <GridLayer
                viewport={viewport}
                step={settings.gridStep}
                superlineEvery={unit === 'cm' || unit === 'm' ? 10 : 12}
              />
            )}
            <RoomsLayer />
            <OpeningsLayer />
            <ItemsLayer />
          </g>

          <DimensionsLayer
            plan={plan}
            viewport={viewport}
            unit={unit}
            showRoomDimensions={settings.showDimensions}
            measuredRooms={selectedRooms}
            measuredItems={selection.items}
          />
          <LabelsLayer
            plan={plan}
            viewport={viewport}
            unit={unit}
            showNames={settings.showNames}
            showAreas={settings.showAreas}
          />
          <SelectionLayer
            plan={plan}
            viewport={viewport}
            rooms={selectedRooms}
            items={selection.items}
            openings={selection.openings}
            selectedVertex={selectedVertex}
          />
          <PreviewLayer
            preview={interactions.preview}
            plan={plan}
            viewport={viewport}
            unit={unit}
            openingKind={openingKind}
          />
        </svg>
      </div>
    </SceneContext.Provider>
  )
}
