import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

const [manifest, schema, catalog, example, catalogSource] = await Promise.all([
  readJson('public/api/index.json'),
  readJson('public/api/plan.schema.json'),
  readJson('public/api/item-catalog.json'),
  readJson('public/api/example-plan.json'),
  readFile('src/model/catalog.ts', 'utf8'),
])

assert.equal(manifest.version, 1)
assert.equal(example.version, manifest.version)
assert.equal(schema.properties.version.const, manifest.version)

// Keep the public catalog and schema synchronized with the editor's catalog.
const rawItems = catalogSource.slice(
  catalogSource.indexOf('const RAW_ITEMS'),
  catalogSource.indexOf('export const ITEM_TEMPLATES'),
)
const sourceTemplates = [...rawItems.matchAll(
  /\{ id: '([^']+)', name: '([^']+)', category: '([^']+)', width: ([\d.]+), depth: ([\d.]+), glyph: '[^']+'(?:, wallMounted: (true))? \}/g,
)].map((match) => ({
  id: match[1],
  name: match[2],
  category: match[3],
  width: Number(match[4]),
  depth: Number(match[5]),
  wallMounted: match[6] === 'true',
}))

const publicTemplates = catalog.templates.map(
  ({ id, name, category, width, depth, wallMounted }) => ({
    id,
    name,
    category,
    width,
    depth,
    wallMounted,
  }),
)
assert.deepEqual(publicTemplates, sourceTemplates, 'public item catalog differs from src/model/catalog.ts')

const catalogIds = catalog.templates.map(({ id }) => id)
assert.equal(new Set(catalogIds).size, catalogIds.length, 'catalog template ids must be unique')
const schemaIds = schema.$defs.item.properties.templateId.enum.filter((id) => id !== 'image')
assert.deepEqual(schemaIds, catalogIds, 'schema templateId enum differs from the public catalog')

// JSON Schema handles object shape; these checks cover the important relational rules.
const entityIds = [...example.rooms, ...example.walls, ...example.openings, ...example.items].map(
  ({ id }) => id,
)
assert.equal(new Set(entityIds).size, entityIds.length, 'example entity ids must be globally unique')

const rooms = new Map(example.rooms.map((room) => [room.id, room]))
for (const room of example.rooms) {
  assert.ok(room.points.length >= 3, `${room.id} must have at least three points`)
  const twiceSignedArea = room.points.reduce((sum, point, index) => {
    const next = room.points[(index + 1) % room.points.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0)
  assert.ok(twiceSignedArea > 0, `${room.id} points must use positive shoelace order`)
}

for (const opening of example.openings) {
  const room = rooms.get(opening.roomId)
  assert.ok(room, `${opening.id} must reference an existing room`)
  assert.ok(opening.edgeIndex < room.points.length, `${opening.id} edgeIndex is out of range`)
  const a = room.points[opening.edgeIndex]
  const b = room.points[(opening.edgeIndex + 1) % room.points.length]
  const edgeLength = Math.hypot(b.x - a.x, b.y - a.y)
  assert.ok(opening.offset >= opening.width / 2, `${opening.id} starts before its host edge`)
  assert.ok(
    opening.offset <= edgeLength - opening.width / 2,
    `${opening.id} ends after its host edge`,
  )
}

for (const item of example.items) {
  assert.ok(catalogIds.includes(item.templateId), `${item.id} uses an unknown templateId`)
  assert.ok(item.width > 0 && item.depth > 0, `${item.id} must have a positive footprint`)
  assert.ok(item.rotation >= 0 && item.rotation < 360, `${item.id} rotation must be normalized`)
}

console.log(`Plan JSON API is consistent (${catalogIds.length} item templates).`)
