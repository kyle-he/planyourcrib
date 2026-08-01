import { useCallback, useEffect, useRef, useState, type DragEvent, type RefObject } from 'react'
import type { Vec2 } from '@/core/geometry'
import { createImageTemplate } from '@/model/catalog'
import { createItem } from '@/model/factory'
import type { Item, SelectionRef } from '@/model/types'
import { addImageAsset } from '@/state/imageAssets'
import { useEditorStore } from '@/state/store'
import { screenToWorld } from '@/state/transform'
import { placementCenter } from '../snapping'

/** Offset between images when several are dropped at once, in inches. */
const CASCADE = 12

export interface ImageDrop {
  /** True while a file drag hovers the canvas, for the drop affordance. */
  active: boolean
  onDragEnter: (event: DragEvent) => void
  onDragOver: (event: DragEvent) => void
  onDragLeave: (event: DragEvent) => void
  onDrop: (event: DragEvent) => void
}

/**
 * Drag images from the desktop straight onto the plan. Dropped files become
 * image items centred on the cursor, snapped like any other placement, and the
 * whole drop lands as a single undo step.
 */
export function useImageDrop(hostRef: RefObject<HTMLDivElement | null>): ImageDrop {
  const [active, setActive] = useState(false)
  // dragenter/dragleave also fire for children, so count them instead of
  // toggling, or the affordance flickers as the cursor crosses the SVG.
  const depth = useRef(0)

  // Without this, a file dropped anywhere outside the canvas makes the browser
  // navigate away from the app and lose the plan.
  useEffect(() => {
    const block = (event: globalThis.DragEvent) => {
      if (carriesFiles(event.dataTransfer)) event.preventDefault()
    }
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  const onDragEnter = useCallback((event: DragEvent) => {
    if (!carriesFiles(event.dataTransfer)) return
    event.preventDefault()
    depth.current += 1
    setActive(true)
  }, [])

  const onDragOver = useCallback((event: DragEvent) => {
    if (!carriesFiles(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDragLeave = useCallback((event: DragEvent) => {
    if (!carriesFiles(event.dataTransfer)) return
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setActive(false)
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      if (!carriesFiles(event.dataTransfer)) return
      event.preventDefault()
      depth.current = 0
      setActive(false)

      const files = [...event.dataTransfer.files].filter((file) =>
        file.type.startsWith('image/'),
      )
      if (files.length === 0) return

      const bounds = hostRef.current?.getBoundingClientRect()
      const world = screenToWorld(useEditorStore.getState().viewport, {
        x: event.clientX - (bounds?.left ?? 0),
        y: event.clientY - (bounds?.top ?? 0),
      })
      void placeFiles(files, world)
    },
    [hostRef],
  )

  return { active, onDragEnter, onDragOver, onDragLeave, onDrop }
}

/** Import every dropped file, then add the ones that decoded in one commit. */
async function placeFiles(files: readonly File[], world: Vec2): Promise<void> {
  const store = useEditorStore.getState()
  const imported = await Promise.all(
    files.map((file) => addImageAsset(file).catch(() => null)),
  )

  const items: Item[] = []
  for (const asset of imported) {
    if (!asset) continue
    const template = createImageTemplate(asset)
    const at = { x: world.x + items.length * CASCADE, y: world.y + items.length * CASCADE }
    items.push(
      createItem(
        template,
        placementCenter(at, template.width, template.depth, {
          plan: store.plan,
          settings: store.settings,
          scale: store.viewport.scale,
        }),
      ),
    )
  }

  if (items.length === 0) {
    window.alert("That file couldn't be read as an image.")
    return
  }
  store.commit((plan) => void plan.items.push(...items))
  store.setTool('select')
  store.setSelection(items.map((item): SelectionRef => ({ kind: 'item', id: item.id })))
}

/** True when a drag carries files, which is all we know during dragover. */
function carriesFiles(data: DataTransfer | null): boolean {
  return !!data && [...data.types].includes('Files')
}
