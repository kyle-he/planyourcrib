import { produce } from 'immer'
import type { StateCreator } from 'zustand'
import { add, clamp, dot, normalize, scale, sub } from '@/core/geometry'
import { createId } from '@/core/id'
import { maxOpeningOffset, roomEdge } from '@/model/derive'
import { createStarterPlan, nextRoomName } from '@/model/factory'
import type { Item, Opening, Plan, Room, SelectionRef } from '@/model/types'
import type { EditorStore, PlanSlice } from './types'

const HISTORY_LIMIT = 100

/** Snapshot-based history: plan documents are small, so cloning is cheap. */
export const createPlanSlice: StateCreator<EditorStore, [], [], PlanSlice> = (set, get) => {
  /** Snapshot captured at the start of an open batch, pushed on first change. */
  let batchSnapshot: Plan | null = null
  let batchDepth = 0

  function apply(recipe: (plan: Plan) => void) {
    const state = get()
    const next = produce(state.plan, recipe)
    if (next === state.plan) return // recipe was a no-op: don't touch history

    if (batchDepth > 0) {
      if (batchSnapshot) {
        const snapshot = batchSnapshot
        batchSnapshot = null
        set({ plan: next, past: [...state.past, snapshot].slice(-HISTORY_LIMIT), future: [] })
        return
      }
      set({ plan: next, future: [] })
      return
    }
    set({
      plan: next,
      past: [...state.past, state.plan].slice(-HISTORY_LIMIT),
      future: [],
    })
  }

  const patchRoom = (id: string, patch: Partial<Omit<Room, 'id'>>) =>
    apply((plan) => {
      const room = plan.rooms.find((candidate) => candidate.id === id)
      if (room) Object.assign(room, patch)
    })

  return {
    plan: createStarterPlan(),
    past: [],
    future: [],

    beginBatch: () => {
      if (batchDepth === 0) batchSnapshot = get().plan
      batchDepth += 1
    },
    endBatch: () => {
      batchDepth = Math.max(0, batchDepth - 1)
      if (batchDepth === 0) batchSnapshot = null
    },
    commit: apply,

    undo: () => {
      const { past, plan, future } = get()
      const previous = past.at(-1)
      if (!previous) return
      set({ plan: previous, past: past.slice(0, -1), future: [plan, ...future] })
      get().setSelection(pruneSelection(get().selection, previous))
    },
    redo: () => {
      const { future, plan, past } = get()
      const next = future[0]
      if (!next) return
      set({ plan: next, past: [...past, plan], future: future.slice(1) })
      get().setSelection(pruneSelection(get().selection, next))
    },

    loadPlan: (plan) => {
      set({ plan, past: [], future: [], selection: [], editingRoomId: null })
    },
    newPlan: () => {
      get().loadPlan({ version: 1, name: 'Untitled plan', rooms: [], openings: [], items: [] })
    },
    renamePlan: (name) => apply((plan) => void (plan.name = name)),

    addRoom: (room) => apply((plan) => void plan.rooms.push(room)),
    updateRoom: patchRoom,

    setRoomRect: (id, rect) =>
      apply((plan) => {
        const room = plan.rooms.find((candidate) => candidate.id === id)
        const [start, next, , previous] = room?.points ?? []
        if (!room || !start || !next || !previous) return

        // Preserve a rectangular room's orientation while its dimensions are
        // edited. Axis-aligned rooms naturally retain their original behavior.
        const widthAxis = normalize(sub(next, start))
        const heightAxis = normalize(sub(previous, start))
        if (widthAxis.x === 0 && widthAxis.y === 0) return
        if (heightAxis.x === 0 && heightAxis.y === 0) return

        const origin = { x: start.x, y: start.y }
        const widthEnd = add(origin, scale(widthAxis, rect.width))
        const heightEnd = add(origin, scale(heightAxis, rect.height))
        room.points = [origin, widthEnd, add(widthEnd, scale(heightAxis, rect.height)), heightEnd]
      }),

    moveRoomVertex: (id, index, point) =>
      apply((plan) => {
        const room = plan.rooms.find((candidate) => candidate.id === id)
        const vertex = room?.points[index]
        if (!vertex) return
        vertex.x = point.x
        vertex.y = point.y
      }),

    insertRoomVertex: (id, afterIndex, point) =>
      apply((plan) => {
        const room = plan.rooms.find((candidate) => candidate.id === id)
        if (!room) return
        room.points.splice(afterIndex + 1, 0, point)
        // Openings on later edges shift by one because an edge was split.
        for (const opening of plan.openings) {
          if (opening.roomId === id && opening.edgeIndex > afterIndex) opening.edgeIndex += 1
        }
      }),

    removeRoomVertex: (id, index) =>
      apply((plan) => {
        const room = plan.rooms.find((candidate) => candidate.id === id)
        if (!room || room.points.length <= 3) return
        room.points.splice(index, 1)
        plan.openings = plan.openings.filter(
          (opening) => opening.roomId !== id || opening.edgeIndex !== index,
        )
        for (const opening of plan.openings) {
          if (opening.roomId === id && opening.edgeIndex > index) opening.edgeIndex -= 1
        }
      }),

    addOpening: (opening) => apply((plan) => void plan.openings.push(opening)),
    updateOpening: (id, patch) =>
      apply((plan) => {
        const opening = plan.openings.find((candidate) => candidate.id === id)
        if (opening) Object.assign(opening, patch)
      }),

    addItem: (item) => apply((plan) => void plan.items.push(item)),
    updateItem: (id, patch) =>
      apply((plan) => {
        const item = plan.items.find((candidate) => candidate.id === id)
        if (item) Object.assign(item, patch)
      }),

    reorderItem: (id, to) =>
      apply((plan) => {
        const index = plan.items.findIndex((item) => item.id === id)
        if (index < 0) return
        const [item] = plan.items.splice(index, 1)
        if (!item) return
        if (to === 'front') plan.items.push(item)
        else plan.items.unshift(item)
      }),

    deleteEntities: (refs) => {
      if (refs.length === 0) return
      const rooms = idsOfKind(refs, 'room')
      const items = idsOfKind(refs, 'item')
      const openings = idsOfKind(refs, 'opening')
      apply((plan) => {
        plan.rooms = plan.rooms.filter((room) => !rooms.has(room.id))
        plan.items = plan.items.filter((item) => !items.has(item.id))
        plan.openings = plan.openings.filter(
          (opening) => !openings.has(opening.id) && !rooms.has(opening.roomId),
        )
      })
      get().clearSelection()
    },

    translateEntities: (refs, delta) => {
      if (refs.length === 0 || (delta.x === 0 && delta.y === 0)) return
      const rooms = idsOfKind(refs, 'room')
      const items = idsOfKind(refs, 'item')
      const openings = idsOfKind(refs, 'opening')
      apply((plan) => {
        for (const room of plan.rooms) {
          if (!rooms.has(room.id)) continue
          for (const point of room.points) {
            point.x += delta.x
            point.y += delta.y
          }
        }
        for (const item of plan.items) {
          if (!items.has(item.id) || item.locked) continue
          item.center = { x: item.center.x + delta.x, y: item.center.y + delta.y }
        }
        for (const opening of plan.openings) {
          if (!openings.has(opening.id) || rooms.has(opening.roomId)) continue
          const room = plan.rooms.find((candidate) => candidate.id === opening.roomId)
          const edge = room && roomEdge(room, opening.edgeIndex)
          if (!edge) continue
          // Openings can only slide along their host wall.
          opening.offset = clamp(
            opening.offset + dot(delta, edge.direction),
            opening.width / 2,
            maxOpeningOffset(edge.length, opening.width),
          )
        }
      })
    },

    rotateEntities: (refs, degrees) => {
      const items = idsOfKind(refs, 'item')
      if (items.size === 0) return
      apply((plan) => {
        for (const item of plan.items) {
          if (!items.has(item.id) || item.locked) continue
          item.rotation = (((item.rotation + degrees) % 360) + 360) % 360
        }
      })
    },

    duplicateEntities: (refs, delta) => {
      const rooms = idsOfKind(refs, 'room')
      const items = idsOfKind(refs, 'item')
      const created: SelectionRef[] = []
      apply((plan) => {
        for (const room of [...plan.rooms]) {
          if (!rooms.has(room.id)) continue
          const copy: Room = {
            ...room,
            id: createId('room'),
            name: nextRoomName(plan.rooms),
            points: room.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })),
          }
          plan.rooms.push(copy)
          created.push({ kind: 'room', id: copy.id })
          for (const opening of plan.openings.filter((o) => o.roomId === room.id)) {
            plan.openings.push({ ...opening, id: createId('open'), roomId: copy.id })
          }
        }
        for (const item of [...plan.items]) {
          if (!items.has(item.id)) continue
          const copy: Item = {
            ...item,
            id: createId('item'),
            center: { x: item.center.x + delta.x, y: item.center.y + delta.y },
          }
          plan.items.push(copy)
          created.push({ kind: 'item', id: copy.id })
        }
      })
      return created
    },
  }
}

function idsOfKind(refs: readonly SelectionRef[], kind: SelectionRef['kind']): Set<string> {
  return new Set(refs.filter((ref) => ref.kind === kind).map((ref) => ref.id))
}

/** Drop selection entries that no longer exist (e.g. after undoing an add). */
function pruneSelection(refs: readonly SelectionRef[], plan: Plan): SelectionRef[] {
  const exists = (ref: SelectionRef) => {
    if (ref.kind === 'room') return plan.rooms.some((room) => room.id === ref.id)
    if (ref.kind === 'item') return plan.items.some((item) => item.id === ref.id)
    return plan.openings.some((opening: Opening) => opening.id === ref.id)
  }
  return refs.filter(exists)
}
