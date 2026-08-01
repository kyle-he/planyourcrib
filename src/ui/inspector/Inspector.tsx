import type { Room } from '@/model/types'
import { usePlan, useResolvedSelection, useSettings } from '@/state/selectors'
import { useEditorStore } from '@/state/store'
import { Button } from '../components/Button'
import { ItemInspector } from './ItemInspector'
import { OpeningInspector } from './OpeningInspector'
import { RoomInspector } from './RoomInspector'

export function Inspector() {
  const plan = usePlan()
  const { rooms, items, openings } = useResolvedSelection()
  const selectedVertex = useEditorStore((state) => state.selectedVertex)
  const vertexRoom = selectedVertex
    ? plan.rooms.find((room) => room.id === selectedVertex.roomId)
    : undefined
  const total = rooms.length + items.length + openings.length
  if (total === 0 && !vertexRoom) return null

  return (
    <aside className="panel inspector-popover" aria-label="Selection details">
      <div className="panel__scroll">
        <div className="section">
          {vertexRoom && selectedVertex && <VertexInspector room={vertexRoom} index={selectedVertex.index} />}
          {total === 1 && rooms[0] && <RoomInspector room={rooms[0]} />}
          {total === 1 && items[0] && <ItemInspector item={items[0]} />}
          {total === 1 && openings[0] && <OpeningInspector opening={openings[0]} />}
          {total > 1 && <MultiSelection hasItems={items.length > 0} />}
        </div>
      </div>
    </aside>
  )
}

function VertexInspector({ room, index }: { room: Room; index: number }) {
  const removeRoomVertex = useEditorStore((state) => state.removeRoomVertex)
  const clearSelection = useEditorStore((state) => state.clearSelection)
  const canDelete = room.points.length > 3

  return (
    <div className="stack">
      <Button
        icon="trash"
        variant="danger"
        block
        disabled={!canDelete}
        onClick={() => {
          removeRoomVertex(room.id, index)
          clearSelection()
        }}
      >
        Delete vertex
      </Button>
      {!canDelete && (
        <p className="catalog-card__size" style={{ margin: 0, textAlign: 'left' }}>
          Rooms need at least three vertices.
        </p>
      )}
    </div>
  )
}

function MultiSelection({ hasItems }: { hasItems: boolean }) {
  const selection = useEditorStore((state) => state.selection)
  const rotateEntities = useEditorStore((state) => state.rotateEntities)
  const duplicateEntities = useEditorStore((state) => state.duplicateEntities)
  const setSelection = useEditorStore((state) => state.setSelection)
  const deleteEntities = useEditorStore((state) => state.deleteEntities)
  const settings = useSettings()

  return (
    <div className="stack">
      {hasItems && (
        <Button icon="rotate" block onClick={() => rotateEntities(selection, 90)}>
          Rotate 90°
        </Button>
      )}
      <Button
        icon="copy"
        block
        onClick={() => {
          const copies = duplicateEntities(selection, {
            x: settings.gridStep * 2,
            y: settings.gridStep * 2,
          })
          if (copies.length > 0) setSelection(copies)
        }}
      >
        Duplicate
      </Button>
      <Button icon="trash" variant="danger" block onClick={() => deleteEntities(selection)}>
        Delete selection
      </Button>
    </div>
  )
}
