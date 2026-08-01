# Plan JSON API (v1)

Plan Your Crib imports a plan as either a bare JSON document or a ZIP containing `plan.json`. This is a file-format API, not an HTTP mutation API. The deployed app also serves machine-readable API resources:

- `/api/plan.schema.json` — authoritative JSON Schema
- `/api/item-catalog.json` — valid furniture templates and default footprints
- `/api/example-plan.json` — complete two-room example
- `/api/index.json` — small discovery manifest and generation rules

For an AI integration, provide the schema, catalog, and the user's requirements, ask for one JSON object only, validate it, then import it into the editor.

## Coordinate model

Every coordinate and length is a JSON number measured in **inches**. The canvas uses `x` rightward, `y` downward, and clockwise rotation in degrees. The origin is arbitrary; negative coordinates are valid.

A room's `points` are its **interior floor boundary**. The editor derives its perimeter walls outward, so do not repeat those edges in `walls`. List corners once in ring order; never repeat the first corner at the end. Prefer positive shoelace order. For a normal rectangle that is:

```text
0 top-left -> 1 top-right -> 2 bottom-right -> 3 bottom-left
```

This makes edge `i` run from `points[i]` to `points[(i + 1) % points.length]`. Rooms must have at least three corners and should be simple, non-self-intersecting polygons with nonzero area.

## Document shape

```ts
type Plan = {
  version: 1
  name: string
  rooms: Room[]
  walls: Wall[]
  openings: Opening[]
  items: Item[]
}

type Vec2 = { x: number; y: number }

type Room = {
  id: string
  name: string
  points: Vec2[]          // interior polygon, 3+ corners
  wallThickness: number  // inches; 4 is the default
  floor: string          // #RRGGBB
}

type Wall = {
  id: string
  a: Vec2                 // centerline start
  b: Vec2                 // centerline end; must differ from a
  thickness: number       // inches
}

type Opening = {
  id: string
  kind: 'door' | 'double-door' | 'sliding-door' | 'pocket-door' |
        'archway' | 'window' | 'bay-window'
  roomId: string          // existing Room.id
  edgeIndex: number       // integer in 0..host.points.length-1
  offset: number          // edge start -> opening center, in inches
  width: number           // inches
  flipHinge: boolean      // meaningful for hinged doors only
  flipInward: boolean     // meaningful for hinged doors only
}

type Item = {
  id: string
  templateId: string      // id from item-catalog.json
  name: string
  center: Vec2
  width: number           // local footprint before rotation
  depth: number
  rotation: number        // clockwise, normalized to [0, 360)
  color: string           // #RRGGBB
  locked: boolean
  imageId?: string        // only for templateId: 'image'
}
```

`walls` are freestanding wall bands centered on `a -> b`; they do not currently host openings. All openings belong to a room edge.

## Openings

For host edge `a -> b`:

```text
edgeLength = sqrt((b.x-a.x)^2 + (b.y-a.y)^2)
width / 2 <= offset <= edgeLength - width / 2
center = a + ((b-a) / edgeLength) * offset
```

Default opening widths are: door 32, double door 60, sliding door 72, pocket door 32, archway 40, window 36, and bay window 72 inches. `flipHinge` and `flipInward` are required for a uniform shape but ignored for windows, archways, sliding doors, and pocket doors.

When two equal-thickness rooms share a wall, their **interior** edges are separated by that wall thickness and run in opposite directions. In the example, the bedroom's right edge is at `x=144`, the hall's left edge is at `x=148`, and both use 4-inch walls; their derived centerlines therefore meet at `x=146`.

## Integrity rules the JSON Schema cannot express

Before import, also check:

1. Every entity id is unique and every `opening.roomId` exists.
2. Every room polygon is simple, has nonzero area, and uses positive shoelace order.
3. Every opening index is valid for its host and the opening fits entirely on that edge.
4. Wall endpoints differ, all dimensions are positive, and item rotations are normalized.
5. Items fit inside their intended rooms and do not overlap walls, openings, or other items unless requested.

The file stores geometry, not semantic containment: an item has no `roomId`. Its `center`, `width`, `depth`, and `rotation` determine where it appears.

## IDs, images, and import behavior

Use stable, readable ids such as `room_bedroom`, `open_bedroom_door`, and `item_queen_bed`. The editor's own ids use the same prefixes with random suffixes.

For AI-generated plans, use catalog items. A custom image requires a ZIP with:

```text
plan.json
images/<imageId>.<ext>
```

The matching item must have `templateId: "image"` and `imageId: "<imageId>"`. A bare `.json` cannot carry image pixels.

Current imports accept missing `walls` or `openings` as empty arrays for backward compatibility, but generators should always emit every top-level field. Unknown top-level fields are not part of v1.

## Suggested chatbot contract

```text
Generate a Plan Your Crib v1 document using the supplied JSON Schema and item
catalog. All measurements are inches. Return exactly one JSON object with no
Markdown or commentary. Preserve the user's requested dimensions. Use unique
ids, positive-order room polygons, valid opening references, and catalog item
defaults. Keep openings on their host edges and furniture clear of walls and
doors. If requirements conflict or dimensions are missing, ask before emitting
the final JSON.
```
