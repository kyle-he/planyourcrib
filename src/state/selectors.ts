import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import type { Rect } from '@/core/geometry'
import { unionRects } from '@/core/geometry'
import { itemBounds, openingBounds, roomBounds, wallBounds } from '@/model/derive'
import type { Item, Opening, Room, SelectionRef, Wall } from '@/model/types'
import { useEditorStore } from './store'

export const usePlan = () => useEditorStore((state) => state.plan)
export const useSettings = () => useEditorStore((state) => state.settings)
export const useUnit = () => useEditorStore((state) => state.settings.unit)
export const useViewport = () => useEditorStore((state) => state.viewport)
export const useTool = () => useEditorStore((state) => state.tool)
export const useSelection = () => useEditorStore((state) => state.selection)

export const useCanUndo = () => useEditorStore((state) => state.past.length > 0)
export const useCanRedo = () => useEditorStore((state) => state.future.length > 0)

export function useSelectedIds(kind: SelectionRef['kind']): string[] {
  return useEditorStore(
    useShallow((state) =>
      state.selection.filter((ref) => ref.kind === kind).map((ref) => ref.id),
    ),
  )
}

export interface ResolvedSelection {
  refs: SelectionRef[]
  rooms: Room[]
  walls: Wall[]
  items: Item[]
  openings: Opening[]
  bounds: Rect | null
}

/** The selection resolved against the current plan, plus its world bounds. */
export function useResolvedSelection(): ResolvedSelection {
  const plan = useEditorStore((state) => state.plan)
  const selection = useEditorStore((state) => state.selection)

  return useMemo(() => {
    const roomIds = new Set(selection.filter((r) => r.kind === 'room').map((r) => r.id))
    const wallIds = new Set(selection.filter((r) => r.kind === 'wall').map((r) => r.id))
    const itemIds = new Set(selection.filter((r) => r.kind === 'item').map((r) => r.id))
    const openingIds = new Set(selection.filter((r) => r.kind === 'opening').map((r) => r.id))

    const rooms = plan.rooms.filter((room) => roomIds.has(room.id))
    const walls = plan.walls.filter((wall) => wallIds.has(wall.id))
    const items = plan.items.filter((item) => itemIds.has(item.id))
    const openings = plan.openings.filter((opening) => openingIds.has(opening.id))

    const rects: Rect[] = [
      ...rooms.map(roomBounds),
      ...walls.map(wallBounds),
      ...items.map(itemBounds),
      ...openings.map((opening) => openingBounds(plan, opening)).filter((r): r is Rect => !!r),
    ]

    return { refs: selection, rooms, walls, items, openings, bounds: unionRects(rects) }
  }, [plan, selection])
}

export function useIsSelected(kind: SelectionRef['kind'], id: string): boolean {
  return useEditorStore((state) =>
    state.selection.some((ref) => ref.kind === kind && ref.id === id),
  )
}
