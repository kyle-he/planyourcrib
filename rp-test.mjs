/**
 * Interaction test harness. Drives the app in a headless browser using real
 * pointer/keyboard input and asserts on the resulting document state.
 * Run with the dev server up:  node rp-test.mjs
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import puppeteer from 'puppeteer'

const URL = process.env.URL ?? 'http://localhost:5183/'
const CANVAS_ORIGIN = { x: 0, y: 0 }
const FIXTURE_PNG = join(import.meta.dirname, 'rp-fixture.png')
const DOWNLOADS = mkdtempSync(join(tmpdir(), 'rp-downloads-'))

/** Waits for the browser to finish writing a download into DOWNLOADS. */
async function waitForDownload(extension, timeout = 8000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const done = readdirSync(DOWNLOADS).find(
      (name) => name.endsWith(extension) && !name.endsWith('.crdownload'),
    )
    if (done) {
      await sleep(150)
      return join(DOWNLOADS, done)
    }
    await sleep(100)
  }
  throw new Error(`no ${extension} download appeared in ${DOWNLOADS}`)
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1512, height: 950, deviceScaleFactor: 1 })

const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
})

await page.goto(URL, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  localStorage.clear()
  indexedDB.deleteDatabase('roomplanner')
})
await page.reload({ waitUntil: 'networkidle0' })
await sleep(600)

const hostBox = await page.$eval('.canvas-host', (element) => {
  const rect = element.getBoundingClientRect()
  return { x: rect.x, y: rect.y }
})
Object.assign(CANVAS_ORIGIN, hostBox)

const results = []
function check(name, condition, detail = '') {
  results.push({ name, pass: !!condition, detail })
}

// ------------------------------------------------------- library resize stability
{
  const selectedItem = await page.evaluate(() => {
    const store = globalThis.__roomPlannerStore.getState()
    const item = store.plan.items[0]
    globalThis.__roomPlannerStore.getState().select({ kind: 'item', id: item.id })
    return { id: item.id, center: item.center }
  })
  await sleep(50)
  const visualState = () =>
    page.evaluate(() => {
      const { viewport } = globalThis.__roomPlannerStore.getState()
      const canvas = document.querySelector('.canvas-host').getBoundingClientRect()
      const selection = document.querySelector('.selection-layer polygon')?.getBoundingClientRect()
      return {
        viewport: { x: viewport.x, y: viewport.y, scale: viewport.scale },
        canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
        selection: selection
          ? { x: selection.x, y: selection.y, width: selection.width, height: selection.height }
          : null,
      }
    })

  const before = await visualState()
  await page.click('.panel__collapse')
  await sleep(150)
  const collapsed = await visualState()
  await page.click('.sidebar-toggle')
  await sleep(150)
  const reopened = await visualState()
  const selectedItemAfter = await page.evaluate((id) => {
    const store = globalThis.__roomPlannerStore.getState()
    const item = store.plan.items.find((candidate) => candidate.id === id)
    return { selected: store.selection[0]?.id, center: item?.center }
  }, selectedItem.id)
  const stable = (a, b) => JSON.stringify(a) === JSON.stringify(b)

  check(
    'opening and closing the library never moves the canvas, viewport, or selected item',
    stable(before, collapsed) &&
      stable(before, reopened) &&
      selectedItemAfter.selected === selectedItem.id &&
      selectedItemAfter.center.x === selectedItem.center.x &&
      selectedItemAfter.center.y === selectedItem.center.y,
    JSON.stringify({ before, collapsed, reopened, selectedItem, selectedItemAfter }),
  )
}

const state = () => page.evaluate(() => globalThis.__roomPlannerStore.getState())
const plan = async () => (await state()).plan

/** World inches -> page pixels. */
async function toPage(point) {
  const { viewport } = await state()
  return {
    x: CANVAS_ORIGIN.x + point.x * viewport.scale + viewport.x,
    y: CANVAS_ORIGIN.y + point.y * viewport.scale + viewport.y,
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function drag(fromWorld, toWorld, { steps = 10, keys = [] } = {}) {
  const from = await toPage(fromWorld)
  const to = await toPage(toWorld)
  for (const key of keys) await page.keyboard.down(key)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    )
    await sleep(10)
  }
  await page.mouse.up()
  for (const key of keys) await page.keyboard.up(key)
  await sleep(120)
}

async function clickWorld(point, options = {}) {
  const at = await toPage(point)
  await page.mouse.click(at.x, at.y, options)
  await sleep(120)
}

async function press(key, modifiers = []) {
  for (const modifier of modifiers) await page.keyboard.down(modifier)
  await page.keyboard.press(key)
  for (const modifier of modifiers) await page.keyboard.up(modifier)
  await sleep(150)
}

// ------------------------------------------------------- connected room walls
{
  const originalPlan = await plan()
  const connectedPlan = {
    version: 1,
    name: 'Connected rooms',
    rooms: [
      {
        id: 'room_left',
        name: 'Left room',
        points: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }],
        wallThickness: 5,
        floor: '#ffffff',
      },
      {
        id: 'room_right',
        name: 'Right room',
        points: [{ x: 125, y: 0 }, { x: 245, y: 0 }, { x: 245, y: 120 }, { x: 125, y: 120 }],
        wallThickness: 5,
        floor: '#ece4d8',
      },
    ],
    openings: [
      {
        id: 'open_shared',
        kind: 'door',
        roomId: 'room_left',
        edgeIndex: 1,
        offset: 60,
        width: 32,
        flipHinge: false,
        flipInward: true,
      },
    ],
    items: [],
  }

  const standalonePlan = {
    ...connectedPlan,
    name: 'Standalone room dimensions',
    rooms: [connectedPlan.rooms[0]],
    openings: [],
  }
  await page.evaluate((fixture) => {
    const store = globalThis.__roomPlannerStore.getState()
    store.loadPlan(fixture)
    store.clearSelection()
    store.fitToRect({ x: -5, y: -5, width: 130, height: 130 }, 100)
  }, standalonePlan)
  await sleep(150)
  check(
    'an isolated rectangular room shows all four dimensions',
    (await page.$$('.dimensions-layer text')).length === 4,
  )

  const collisionPlan = {
    ...standalonePlan,
    name: 'Colliding room dimensions',
    rooms: [
      connectedPlan.rooms[0],
      {
        ...connectedPlan.rooms[1],
        id: 'room_below',
        points: [
          { x: 0, y: 146.36 },
          { x: 120, y: 146.36 },
          { x: 120, y: 266.36 },
          { x: 0, y: 266.36 },
        ],
      },
    ],
  }
  await page.evaluate((fixture) => {
    const store = globalThis.__roomPlannerStore.getState()
    store.loadPlan(fixture)
    store.clearSelection()
    store.resetView()
  }, collisionPlan)
  await sleep(150)
  const collisionRender = await page.evaluate(() => ({
    count: document.querySelectorAll('.dimensions-layer text').length,
    keptTop: document.querySelector('[data-dimension-room="room_below"][data-dimension-edge="0"]') !== null,
    hiddenBottom: document.querySelector('[data-dimension-room="room_left"][data-dimension-edge="2"]') === null,
  }))
  check(
    'touching labels keep the higher-priority top dimension',
    collisionRender.count === 7 && collisionRender.keptTop && collisionRender.hiddenBottom,
    JSON.stringify(collisionRender),
  )

  await page.evaluate((fixture) => {
    const store = globalThis.__roomPlannerStore.getState()
    store.loadPlan(fixture)
    store.clearSelection()
    store.fitToRect({ x: -5, y: -5, width: 255, height: 130 }, 100)
  }, connectedPlan)
  await sleep(150)

  const cleanRender = await page.evaluate(() => ({
    wallSegments: document.querySelectorAll('[data-wall-room]').length,
    dimensionLabels: document.querySelectorAll('.dimensions-layer text').length,
    openingFills: [...document.querySelectorAll('.openings-layer > g rect')].map((rect) =>
      rect.getAttribute('fill'),
    ),
  }))
  check('two connected rooms render their shared wall only once', cleanRender.wallSegments === 7)
  check(
    'a merged wall hides both participating dimensions',
    cleanRender.dimensionLabels === 6,
    String(cleanRender.dimensionLabels),
  )
  check(
    'a shared doorway carries both room floor finishes',
    cleanRender.openingFills.includes('#ffffff') && cleanRender.openingFills.includes('#ece4d8'),
    JSON.stringify(cleanRender.openingFills),
  )

  await page.evaluate(() =>
    globalThis.__roomPlannerStore.getState().select({ kind: 'room', id: 'room_left' }),
  )
  await sleep(100)
  check(
    'selecting a connected room keeps the visible dimension set stable',
    (await page.$$('.dimensions-layer text')).length === 6,
  )

  await drag({ x: 120, y: 60 }, { x: 132, y: 60 })
  const coupled = await plan()
  const coupledLeft = coupled.rooms.find((room) => room.id === 'room_left')
  const coupledRight = coupled.rooms.find((room) => room.id === 'room_right')
  check(
    'dragging a shared wall resizes both connected rooms',
    coupledLeft.points[1].x === 132 && coupledRight.points[0].x === 137,
    JSON.stringify({ left: coupledLeft.points, right: coupledRight.points }),
  )

  const detachedPlan = structuredClone(connectedPlan)
  detachedPlan.rooms[1].points = detachedPlan.rooms[1].points.map((point) => ({
    ...point,
    x: point.x + 5,
  }))
  await page.evaluate((fixture) => {
    const store = globalThis.__roomPlannerStore.getState()
    store.loadPlan(fixture)
    store.clearSelection()
  }, detachedPlan)
  await sleep(100)
  await drag({ x: 190, y: 60 }, { x: 186, y: 60 })
  const snappedRight = (await plan()).rooms.find((room) => room.id === 'room_right')
  check(
    'moving a room near another room magnetically connects their wall centerlines',
    snappedRight.points[0].x === 125,
    JSON.stringify(snappedRight.points),
  )

  const cornerPlan = {
    ...connectedPlan,
    name: 'Two-constraint corner snap',
    rooms: [
      {
        ...connectedPlan.rooms[0],
        id: 'room_corner_left',
        points: [{ x: 0, y: 105 }, { x: 100, y: 105 }, { x: 100, y: 155 }, { x: 0, y: 155 }],
      },
      {
        ...connectedPlan.rooms[0],
        id: 'room_corner_top',
        points: [{ x: 105, y: 0 }, { x: 155, y: 0 }, { x: 155, y: 100 }, { x: 105, y: 100 }],
      },
      {
        ...connectedPlan.rooms[1],
        id: 'room_corner',
        points: [{ x: 110, y: 111 }, { x: 160, y: 111 }, { x: 160, y: 161 }, { x: 110, y: 161 }],
      },
    ],
    openings: [],
  }
  await page.evaluate((fixture) => {
    const store = globalThis.__roomPlannerStore.getState()
    store.loadPlan(fixture)
    store.clearSelection()
    store.fitToRect({ x: -5, y: -5, width: 170, height: 170 }, 100)
  }, cornerPlan)
  await sleep(100)
  await drag({ x: 135, y: 136 }, { x: 131, y: 131 })
  const cornerRoom = (await plan()).rooms.find((room) => room.id === 'room_corner')
  check(
    'one room move can merge two perpendicular wall guidelines at once',
    cornerRoom.points[0].x === 105 && cornerRoom.points[0].y === 105,
    JSON.stringify(cornerRoom.points),
  )

  const segmentedPlan = {
    ...connectedPlan,
    name: 'Segmented shared wall',
    rooms: [
      {
        ...connectedPlan.rooms[0],
        id: 'room_segment_top',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }],
      },
      {
        ...connectedPlan.rooms[0],
        id: 'room_segment_bottom',
        points: [{ x: 0, y: 65 }, { x: 100, y: 65 }, { x: 100, y: 125 }, { x: 0, y: 125 }],
      },
      {
        ...connectedPlan.rooms[1],
        id: 'room_segment_long',
        points: [{ x: 110, y: 0 }, { x: 210, y: 0 }, { x: 210, y: 125 }, { x: 110, y: 125 }],
      },
    ],
    openings: [],
  }
  await page.evaluate((fixture) => {
    const store = globalThis.__roomPlannerStore.getState()
    store.loadPlan(fixture)
    store.clearSelection()
    store.fitToRect({ x: -5, y: -5, width: 220, height: 135 }, 100)
  }, segmentedPlan)
  await sleep(100)
  await drag({ x: 160, y: 62.5 }, { x: 156, y: 62.5 })
  const segmentedRoom = (await plan()).rooms.find((room) => room.id === 'room_segment_long')
  const multipleShared = await page.$(
    '[data-wall-room="room_segment_long"][data-wall-edge="3"][data-wall-shared-count="2"]',
  )
  check(
    'one long wall guideline can merge with multiple shorter wall segments',
    segmentedRoom.points[0].x === 105 && multipleShared !== null,
    JSON.stringify(segmentedRoom.points),
  )

  const angle = Math.PI / 6
  const right = { x: Math.cos(angle), y: Math.sin(angle) }
  const rotatedPoints = (center, width, height) => {
    const down = { x: -right.y, y: right.x }
    return [
      { x: center.x - right.x * width / 2 - down.x * height / 2, y: center.y - right.y * width / 2 - down.y * height / 2 },
      { x: center.x + right.x * width / 2 - down.x * height / 2, y: center.y + right.y * width / 2 - down.y * height / 2 },
      { x: center.x + right.x * width / 2 + down.x * height / 2, y: center.y + right.y * width / 2 + down.y * height / 2 },
      { x: center.x - right.x * width / 2 + down.x * height / 2, y: center.y - right.y * width / 2 + down.y * height / 2 },
    ]
  }
  const angleLeftCenter = { x: 100, y: 100 }
  const angleRightCenter = {
    x: angleLeftCenter.x + right.x * 110,
    y: angleLeftCenter.y + right.y * 110,
  }
  const angledPlan = {
    ...connectedPlan,
    name: 'Angled wall resize snap',
    rooms: [
      { ...connectedPlan.rooms[0], id: 'room_angle_left', points: rotatedPoints(angleLeftCenter, 100, 60) },
      { ...connectedPlan.rooms[1], id: 'room_angle_right', points: rotatedPoints(angleRightCenter, 100, 60) },
    ],
    openings: [],
  }
  await page.evaluate((fixture) => {
    const store = globalThis.__roomPlannerStore.getState()
    store.loadPlan(fixture)
    store.select({ kind: 'room', id: 'room_angle_right' })
    store.fitToRect({ x: 20, y: 20, width: 270, height: 170 }, 100)
  }, angledPlan)
  await sleep(100)
  const angleRoomBefore = (await plan()).rooms.find((room) => room.id === 'room_angle_right')
  const angleWallFrom = {
    x: (angleRoomBefore.points[3].x + angleRoomBefore.points[0].x) / 2,
    y: (angleRoomBefore.points[3].y + angleRoomBefore.points[0].y) / 2,
  }
  await drag(angleWallFrom, {
    x: angleWallFrom.x - right.x * 4,
    y: angleWallFrom.y - right.y * 4,
  })
  const angleRoomAfter = (await plan()).rooms.find((room) => room.id === 'room_angle_right')
  const expectedAnglePoint = {
    x: angleRoomBefore.points[0].x - right.x * 5,
    y: angleRoomBefore.points[0].y - right.y * 5,
  }
  const angledShared = await page.$('[data-wall-shared-count="1"]')
  check(
    'resizing an angled wall magnetically merges it with a parallel angled wall',
    angledShared !== null &&
      Math.hypot(
        angleRoomAfter.points[0].x - expectedAnglePoint.x,
        angleRoomAfter.points[0].y - expectedAnglePoint.y,
      ) < 0.02,
    JSON.stringify({ before: angleRoomBefore.points, after: angleRoomAfter.points }),
  )

  const down = { x: -right.y, y: right.x }
  const targetPoints = rotatedPoints({ x: 100, y: 100 }, 100, 60)
  const targetOuterMid = {
    x: 100 - down.x * 35,
    y: 100 - down.y * 35,
  }
  const movingBottomMid = {
    x: targetOuterMid.x - down.x * 4,
    y: targetOuterMid.y - down.y * 4,
  }
  const movingCenter = {
    x: movingBottomMid.x - down.x * 15,
    y: movingBottomMid.y - down.y * 15,
  }
  const vertexJoinPlan = {
    ...connectedPlan,
    name: 'Angled vertex wall snap',
    rooms: [
      { ...connectedPlan.rooms[0], id: 'room_vertex_target', points: targetPoints },
      {
        ...connectedPlan.rooms[1],
        id: 'room_vertex_join',
        points: rotatedPoints(movingCenter, 60, 30),
      },
    ],
    openings: [],
  }
  await page.evaluate((fixture) => {
    const store = globalThis.__roomPlannerStore.getState()
    store.loadPlan(fixture)
    store.select({ kind: 'room', id: 'room_vertex_join' })
    store.fitToRect({ x: 35, y: 10, width: 150, height: 150 }, 100)
  }, vertexJoinPlan)
  await sleep(100)
  const firstVertexTarget = {
    x: targetOuterMid.x + right.x * 30,
    y: targetOuterMid.y + right.y * 30,
  }
  const secondVertexTarget = {
    x: targetOuterMid.x - right.x * 30,
    y: targetOuterMid.y - right.y * 30,
  }
  let vertexJoinRoom = (await plan()).rooms.find((room) => room.id === 'room_vertex_join')
  await drag(vertexJoinRoom.points[2], {
    x: firstVertexTarget.x - down.x,
    y: firstVertexTarget.y - down.y,
  })
  vertexJoinRoom = (await plan()).rooms.find((room) => room.id === 'room_vertex_join')
  await drag(vertexJoinRoom.points[3], {
    x: secondVertexTarget.x - down.x,
    y: secondVertexTarget.y - down.y,
  })
  vertexJoinRoom = (await plan()).rooms.find((room) => room.id === 'room_vertex_join')
  const vertexSharedWall = await page.$(
    '[data-wall-room="room_vertex_join"][data-wall-shared-count="1"]',
  )
  check(
    'individual vertices snap onto an angled wall and complete a merge',
    Math.hypot(
      vertexJoinRoom.points[2].x - firstVertexTarget.x,
      vertexJoinRoom.points[2].y - firstVertexTarget.y,
    ) < 0.02 &&
      Math.hypot(
        vertexJoinRoom.points[3].x - secondVertexTarget.x,
        vertexJoinRoom.points[3].y - secondVertexTarget.y,
      ) < 0.02 &&
      vertexSharedWall !== null,
    JSON.stringify(vertexJoinRoom.points),
  )

  await page.evaluate((fixture) => {
    const store = globalThis.__roomPlannerStore.getState()
    store.loadPlan(fixture)
    store.clearSelection()
    store.resetView()
  }, originalPlan)
  await sleep(150)
}

// ---------------------------------------------------------------- 1. selection
{
  const before = await plan()
  const sofa = before.items.find((item) => item.templateId === 'sofa')
  await clickWorld(sofa.center)
  const after = await state()
  check('click selects the item under the cursor', after.selection[0]?.id === sofa.id)
}

// ------------------------------------------------------------------- 2. moving
{
  const sofa = (await plan()).items.find((item) => item.templateId === 'sofa')
  await drag(sofa.center, { x: sofa.center.x + 24, y: sofa.center.y + 24 })
  const moved = (await plan()).items.find((item) => item.id === sofa.id)
  check('drag moves the item', Math.abs(moved.center.x - (sofa.center.x + 24)) < 3, JSON.stringify(moved.center))
  await press('z', ['Meta'])
  const restored = (await plan()).items.find((item) => item.id === sofa.id)
  check('undo restores position in one step', Math.abs(restored.center.x - sofa.center.x) < 0.01)
  await press('z', ['Meta', 'Shift'])
  const redone = (await plan()).items.find((item) => item.id === sofa.id)
  check('redo re-applies the move', Math.abs(redone.center.x - (sofa.center.x + 24)) < 3)
  await press('z', ['Meta'])
}

// ------------------------------------------------------------------ 3. resizing
{
  const sofa = (await plan()).items.find((item) => item.templateId === 'sofa')
  const eastHandle = { x: sofa.center.x + sofa.width / 2, y: sofa.center.y }
  await clickWorld(sofa.center)
  await drag(eastHandle, { x: eastHandle.x + 12, y: eastHandle.y })
  const resized = (await plan()).items.find((item) => item.id === sofa.id)
  check(
    'east handle resizes width, keeps west edge',
    Math.abs(resized.width - (sofa.width + 12)) < 3 &&
      Math.abs(resized.center.x - sofa.center.x - 6) < 3,
    `w=${resized.width} cx=${resized.center.x}`,
  )
  await press('z', ['Meta'])
}

// ------------------------------------------------------------------ 4. rotating
{
  const sofa = (await plan()).items.find((item) => item.templateId === 'sofa')
  await clickWorld(sofa.center)
  await press('e')
  const rotated = (await plan()).items.find((item) => item.id === sofa.id)
  check('E rotates 90°', rotated.rotation === 90, String(rotated.rotation))
  await press('q')
  check('Q rotates back', (await plan()).items.find((i) => i.id === sofa.id).rotation === 0)

  const numericCursors = await page.evaluate(() => ({
    length: getComputedStyle(
      document.querySelector('.inspector-popover .length-field__part input'),
    ).cursor,
    rotation: getComputedStyle(
      document.querySelector('.inspector-popover .number-field__control input'),
    ).cursor,
  }))
  check(
    'ordinary number inputs use the text cursor while rotation advertises scrubbing',
    numericCursors.length === 'text' && numericCursors.rotation === 'ew-resize',
    JSON.stringify(numericCursors),
  )

  const rotationField = await page.$eval(
    '.inspector-popover .number-field__control input',
    (input) => {
      const box = input.getBoundingClientRect()
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    },
  )
  await page.mouse.move(rotationField.x, rotationField.y)
  await page.mouse.down()
  await page.mouse.move(rotationField.x + 18, rotationField.y, { steps: 6 })
  await page.mouse.up()
  await sleep(120)
  const scrubbedRotation = (await plan()).items.find((item) => item.id === sofa.id).rotation
  check(
    'dragging the rotation input adjusts its value',
    Math.abs(scrubbedRotation - 18) < 1,
    String(scrubbedRotation),
  )
  await press('z', ['Meta'])
  check(
    'one undo restores a scrubbed rotation',
    (await plan()).items.find((item) => item.id === sofa.id).rotation === 0,
  )
}

// -------------------------------------------------------------- 5. wall dragging
{
  const room = (await plan()).rooms[0]
  await clickWorld({ x: room.points[0].x + 60, y: room.points[0].y + 60 })
  const selected = await state()
  check('click on floor selects the room', selected.selection[0]?.id === room.id)
  const roomFieldLabels = await page.$$eval(
    '.inspector-popover .field__label',
    (labels) => labels.map((label) => label.textContent),
  )
  check(
    'wall thickness is no longer editable per room',
    !roomFieldLabels.includes('Wall thickness'),
    roomFieldLabels.join(', '),
  )

  // Bottom wall of the starter room is edge 2 (y = max). Push it down 12".
  const bottomMid = {
    x: (room.points[2].x + room.points[3].x) / 2,
    y: room.points[2].y,
  }
  await drag(bottomMid, { x: bottomMid.x, y: bottomMid.y + 12 })
  const after = (await plan()).rooms[0]
  const grew = Math.max(...after.points.map((p) => p.y)) - Math.max(...room.points.map((p) => p.y))
  check('dragging a wall handle resizes the room', Math.abs(grew - 12) < 3, `grew=${grew}`)
  await press('z', ['Meta'])
}

// ------------------------------------------------------------ 6. vertex dragging
{
  const room = (await plan()).rooms[0]
  await clickWorld({ x: room.points[0].x + 60, y: room.points[0].y + 60 })
  const corner = room.points[2]
  await drag(corner, { x: corner.x - 24, y: corner.y - 24 })
  const after = (await plan()).rooms[0]
  check(
    'dragging a corner moves just that vertex',
    Math.abs(after.points[2].x - (corner.x - 24)) < 3 && after.points[0].x === room.points[0].x,
    JSON.stringify(after.points[2]),
  )
  await press('z', ['Meta'])
  check('undo restores the corner', (await plan()).rooms[0].points[2].x === corner.x)

  const restored = (await plan()).rooms[0]
  await drag(restored.points[2], { x: restored.points[2].x - 24, y: restored.points[1].y + 7 })
  const outsideAngleSnap = (await plan()).rooms[0]
  check(
    'right-angle snap ignores walls outside its tighter tolerance',
    Math.abs(outsideAngleSnap.points[2].y - restored.points[1].y) > 1,
    JSON.stringify(outsideAngleSnap.points[2]),
  )
  await press('z', ['Meta'])

  await page.evaluate(() => globalThis.__roomPlannerStore.getState().updateSettings({ snapToGrid: false }))
  const freeRoom = (await plan()).rooms[0]
  await drag(freeRoom.points[2], { x: freeRoom.points[2].x - 24, y: freeRoom.points[1].y + 7 })
  const freeAngle = (await plan()).rooms[0]
  check(
    'turning grid snap off leaves room walls free-angle',
    Math.abs(freeAngle.points[2].y - freeRoom.points[1].y) > 1,
    JSON.stringify(freeAngle.points[2]),
  )
  await press('z', ['Meta'])
  await page.evaluate(() => globalThis.__roomPlannerStore.getState().updateSettings({ snapToGrid: true }))
}

// ----------------------------------------------------- 6a. vertex add / remove
{
  const room = (await plan()).rooms[0]
  await clickWorld({ x: room.points[0].x + 60, y: room.points[0].y + 60 })
  const addControl = await page.$eval('.selection-layer circle[fill="var(--accent)"]', (element) => ({
    x: Number(element.getAttribute('cx')),
    y: Number(element.getAttribute('cy')),
  }))
  await page.mouse.click(CANVAS_ORIGIN.x + addControl.x, CANVAS_ORIGIN.y + addControl.y)
  await sleep(120)
  const added = (await plan()).rooms[0]
  check('wall + control adds a corner', added.points.length === room.points.length + 1)

  const inserted = added.points[1]
  await clickWorld(inserted)
  const vertexSelection = await state()
  check(
    'selecting a vertex clears the room selection',
    vertexSelection.selection.length === 0 && vertexSelection.selectedVertex?.index === 1,
  )
  const deleteControl = await page.$eval('.selection-layer circle[fill="var(--danger)"]', (element) => ({
    x: Number(element.getAttribute('cx')),
    y: Number(element.getAttribute('cy')),
  }))
  check('clicking a corner selects it and shows delete', Boolean(deleteControl))
  await page.mouse.click(CANVAS_ORIGIN.x + deleteControl.x, CANVAS_ORIGIN.y + deleteControl.y)
  await sleep(120)
  const afterDelete = await state()
  check(
    'vertex delete control removes the corner and clears selection',
    afterDelete.plan.rooms[0].points.length === room.points.length &&
      afterDelete.selection.length === 0 &&
      afterDelete.selectedVertex === null,
  )
}

// -------------------------------------------------------------- 7. drawing rooms
{
  await page.evaluate(() => globalThis.__roomPlannerStore.getState().setWallThickness(7))
  const globalThickness = await state()
  check(
    'the global wall thickness updates every existing room',
    globalThickness.settings.wallThickness === 7 &&
      globalThickness.plan.rooms.every((room) => room.wallThickness === 7),
    JSON.stringify({
      setting: globalThickness.settings.wallThickness,
      rooms: globalThickness.plan.rooms.map((room) => room.wallThickness),
    }),
  )
  // Zoom out so there is empty canvas to draw in next to the starter room.
  await page.evaluate(() => globalThis.__roomPlannerStore.getState().setZoom(1.2))
  await sleep(150)
  const before = (await plan()).rooms.length
  await press('r')
  await drag({ x: 260, y: 20 }, { x: 380, y: 140 })
  const after = await plan()
  check('room tool creates a room', after.rooms.length === before + 1)
  const created = after.rooms.at(-1)
  check(
    'drawn room matches the drag rectangle',
    created && Math.abs(created.points[0].x - 260) < 6 && Math.abs(created.points[2].y - 140) < 6,
    JSON.stringify(created?.points),
  )
  check('new rooms inherit the global wall thickness', created?.wallThickness === 7)
  check('tool returns to select after drawing', (await state()).tool === 'select')
  await press('Backspace')
  check('Backspace deletes the selection', (await plan()).rooms.length === before)
  await page.evaluate(() => globalThis.__roomPlannerStore.getState().setWallThickness(5))
}

// ----------------------------------------------------------- 8. openings on walls
{
  const before = (await plan()).openings.length
  const room = (await plan()).rooms[0]
  await press('d')
  await clickWorld({ x: room.points[0].x + 40, y: room.points[0].y })
  const after = await plan()
  check('door tool adds an opening', after.openings.length === before + 1)
  const door = after.openings.at(-1)
  check('door is hosted by the wall clicked', door?.edgeIndex === 0, JSON.stringify(door))

  // Drag the door along the wall.
  const store = await state()
  check('placed door is selected', store.selection[0]?.id === door.id)
  await page.select('.inspector-popover select', 'window')
  await sleep(120)
  const changedType = (await plan()).openings.find((opening) => opening.id === door.id)
  check(
    'changing opening type preserves its dimensions',
    changedType?.kind === 'window' &&
      changedType.width === door.width &&
      changedType.offset === door.offset &&
      changedType.edgeIndex === door.edgeIndex,
    JSON.stringify(changedType),
  )
  await press('Delete')
  check('door deleted', (await plan()).openings.length === before)
}

// -------------------------------------------------------------------- 9. marquee
{
  await page.evaluate(() => globalThis.__roomPlannerStore.getState().setZoom(1.2))
  await sleep(150)
  const room = (await plan()).rooms[0]
  const outside = { x: room.points[0].x - 30, y: room.points[0].y - 30 }
  await clickWorld({ x: room.points[0].x + 60, y: room.points[0].y + 60 })
  check('room is selected before panning', (await state()).selection[0]?.id === room.id)
  const viewportBeforePan = (await state()).viewport
  await drag(outside, { x: outside.x + 24, y: outside.y + 12 })
  const viewportAfterPan = (await state()).viewport
  check(
    'dragging empty canvas pans',
    Math.abs(viewportAfterPan.x - viewportBeforePan.x) > 10 &&
      Math.abs(viewportAfterPan.y - viewportBeforePan.y) > 5,
    `${viewportBeforePan.x},${viewportBeforePan.y} -> ${viewportAfterPan.x},${viewportAfterPan.y}`,
  )
  check('panning clears the selection', (await state()).selection.length === 0)
  await drag(outside, { x: room.points[2].x + 30, y: room.points[2].y + 30 }, { keys: ['Shift'] })
  const selection = (await state()).selection
  const items = (await plan()).items.length
  check(
    'marquee selects everything it touches',
    selection.length === items + 1,
    `${selection.length} vs ${items + 1}`,
  )
  await press('Escape')
  check('Escape clears the selection', (await state()).selection.length === 0)
}

// ------------------------------------------------------- 10. clipboard + nudge
{
  // Keep this shortcut check independent of persisted user preferences.
  await page.evaluate(() =>
    globalThis.__roomPlannerStore.getState().updateSettings({ snapToGrid: true, gridStep: 6 }),
  )
  const sofa = (await plan()).items.find((item) => item.templateId === 'sofa')
  await clickWorld(sofa.center)
  await press('c', ['Meta'])
  await press('v', ['Meta'])
  const pasted = await plan()
  check('paste adds a copy', pasted.items.length === 5, String(pasted.items.length))
  const copy = pasted.items.at(-1)
  check('pasted copy is selected', (await state()).selection[0]?.id === copy.id)
  await press('ArrowRight')
  const nudged = (await plan()).items.at(-1)
  check('arrow keys nudge by the grid step', nudged.center.x - copy.center.x === 6, String(nudged.center.x - copy.center.x))
  await press('d', ['Meta'])
  check('cmd-D duplicates', (await plan()).items.length === 6)
  await press('Delete')
  check('delete removes the duplicate', (await plan()).items.length === 5)
  const remaining = (await plan()).items.at(-1)
  await clickWorld(remaining.center)
  await press('Delete')
  check('deletes back to 4 items', (await plan()).items.length === 4, String((await plan()).items.length))
}

// ------------------------------------------------------------------ 11. measure
{
  await press('m')
  const room = (await plan()).rooms[0]

  const tape = () =>
    page.$eval('.preview-layer line[stroke="var(--snap-guide)"]', (element) => ({
      x1: Number(element.getAttribute('x1')),
      y1: Number(element.getAttribute('y1')),
      x2: Number(element.getAttribute('x2')),
      y2: Number(element.getAttribute('y2')),
    }))

  await clickWorld(room.points[0])
  const firstClick = await tape()
  check('first measure click creates a dot', firstClick.x1 === firstClick.x2 && firstClick.y1 === firstClick.y2)

  await clickWorld({ x: room.points[0].x + 48, y: room.points[0].y })
  const secondClick = await tape()
  check('second measure click completes a line', secondClick.x1 !== secondClick.x2 || secondClick.y1 !== secondClick.y2)

  await clickWorld({ x: room.points[0].x + 72, y: room.points[0].y + 24 })
  const thirdClick = await tape()
  check('third measure click starts a new dot', thirdClick.x1 === thirdClick.x2 && thirdClick.y1 === thirdClick.y2)

  await press('Escape')
  await press('m')
  await drag(room.points[0], { x: room.points[0].x + 48, y: room.points[0].y })
  const measureVisible = await page.$eval('.preview-layer', (element) =>
    element.textContent?.includes('4'),
  )
  check('dragging still measures a distance', measureVisible, 'preview text')
  await press('Escape')
}

// --------------------------------------------------------------- 12. unit switch
{
  await page.evaluate(() => {
    const store = globalThis.__roomPlannerStore.getState()
    const item = store.plan.items[0]
    store.select({ kind: 'item', id: item.id })
    store.updateSettings({ unit: 'cm' })
  })
  await sleep(200)
  const fixedMetricUnits = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('.inspector-popover .length-field__part')]
    const rotation = document.querySelector('.inspector-popover .number-field__control')
    return {
      count: controls.length,
      suffixes: controls.map((control) => control.querySelector('span')?.textContent),
      values: controls.map((control) => control.querySelector('input')?.value),
      rotationSuffix: rotation?.querySelector('span')?.textContent,
      rotationValue: rotation?.querySelector('input')?.value,
    }
  })
  check(
    'metric and degree symbols are fixed suffixes outside editable values',
    fixedMetricUnits.count === 4 &&
      fixedMetricUnits.suffixes.every((suffix) => suffix === 'cm') &&
      fixedMetricUnits.values.every((value) => value && !/[a-z°]/i.test(value)) &&
      fixedMetricUnits.rotationSuffix === '°' &&
      fixedMetricUnits.rotationValue !== undefined &&
      !fixedMetricUnits.rotationValue.includes('°'),
    JSON.stringify(fixedMetricUnits),
  )

  await page.evaluate(() =>
    globalThis.__roomPlannerStore.getState().updateSettings({ unit: 'm' }),
  )
  await sleep(100)
  const label = await page.$eval('.labels-layer', (element) => element.textContent)
  check('areas switch to metric', label?.includes('m²'), label ?? '')
  await page.evaluate(() =>
    globalThis.__roomPlannerStore.getState().updateSettings({ unit: 'ftin' }),
  )
  await sleep(100)
  const imperialControls = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('.inspector-popover .length-field__parts')]
    return groups.map((group) => ({
      values: [...group.querySelectorAll('input')].map((input) => input.value),
      suffixes: [...group.querySelectorAll('.length-field__part > span')].map(
        (suffix) => suffix.textContent,
      ),
    }))
  })
  check(
    'every feet and inches field uses separate numeric entries with fixed suffixes',
    imperialControls.length === 4 &&
      imperialControls.every(
        (control) =>
          control.values.length === 2 &&
          control.values.every((value) => !/[a-z]/i.test(value)) &&
          control.suffixes.join(',') === 'ft,in',
      ),
    JSON.stringify(imperialControls),
  )
}

// ------------------------------------------------- 13. dragging openings around
{
  await page.evaluate(() => globalThis.__roomPlannerStore.getState().setZoom(2.2))
  await sleep(150)
  const before = await plan()
  const door = before.openings.find((opening) => opening.kind === 'door')
  const room = before.rooms.find((candidate) => candidate.id === door.roomId)
  const initial = await page.evaluate((id) => {
    const store = globalThis.__roomPlannerStore.getState()
    const opening = store.plan.openings.find((candidate) => candidate.id === id)
    return { offset: opening.offset, edgeIndex: opening.edgeIndex, width: opening.width }
  }, door.id)

  // Select the door, then drag an endpoint to resize it while holding the other fixed.
  const edge = initial.edgeIndex
  const a = room.points[edge]
  const b = room.points[(edge + 1) % room.points.length]
  const along = { x: (b.x - a.x) / Math.hypot(b.x - a.x, b.y - a.y), y: (b.y - a.y) / Math.hypot(b.x - a.x, b.y - a.y) }
  const at = { x: a.x + along.x * initial.offset, y: a.y + along.y * initial.offset }
  await clickWorld(at)
  const end = {
    x: a.x + along.x * (initial.offset + initial.width / 2),
    y: a.y + along.y * (initial.offset + initial.width / 2),
  }
  await drag(end, { x: end.x + along.x * 12, y: end.y + along.y * 12 })
  const resized = (await plan()).openings.find((opening) => opening.id === door.id)
  check(
    'dragging an opening endpoint resizes it',
    Math.abs(resized.width - (initial.width + 12)) < 4 && Math.abs(resized.offset - (initial.offset + 6)) < 4,
    `width ${initial.width} -> ${resized.width}`,
  )

  const frame = { offset: resized.offset, edgeIndex: resized.edgeIndex }
  const movedAt = { x: a.x + along.x * frame.offset, y: a.y + along.y * frame.offset }
  // Grab the door on its wall and slide it 24" along the wall.
  await drag(movedAt, { x: movedAt.x + along.x * 24, y: movedAt.y + along.y * 24 })
  const after = (await plan()).openings.find((opening) => opening.id === door.id)
  check(
    'dragging an opening slides it along its wall',
    Math.abs(after.offset - frame.offset) > 12 && after.edgeIndex === frame.edgeIndex,
    `offset ${frame.offset} -> ${after.offset}`,
  )
  await press('z', ['Meta'])
  check(
    'undo restores the opening offset',
    (await plan()).openings.find((o) => o.id === door.id).offset === frame.offset,
  )

  const [feetField, inchesField] = await page.$$('.inspector-popover .length-field__parts input')
  await feetField.click({ clickCount: 3 })
  await page.keyboard.type('3')
  await inchesField.click({ clickCount: 3 })
  await page.keyboard.type('6.5')
  await page.keyboard.press('Enter')
  await sleep(120)
  const entered = (await plan()).openings.find((opening) => opening.id === door.id)
  const displayed = await Promise.all([
    feetField.evaluate((element) => element.value),
    inchesField.evaluate((element) => element.value),
  ])
  check(
    'feet and inches have separate decimal inputs',
    Math.abs(entered.width - 42.5) < 0.01 && displayed[0] === '3' && displayed[1] === '6.5',
    `${entered.width}; ${displayed.join(' ft / ')} in`,
  )
}

// ------------------------------------------------------------- 14. no overflow
{
  for (const width of [1512, 1180, 1024]) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 })
    await sleep(250)
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      topbar: (() => {
        const bar = document.querySelector('.topbar')
        return bar.scrollWidth - bar.clientWidth
      })(),
    }))
    check(`no horizontal overflow at ${width}px`, overflow.body <= 0 && overflow.topbar <= 0, JSON.stringify(overflow))
  }
  await page.setViewport({ width: 1512, height: 950, deviceScaleFactor: 1 })
  await sleep(200)
}

// ------------------------------------------------------ 15. images + zip round trip
{
  // The narrow-viewport checks above auto-collapse the library; reopen it.
  const toggle = await page.$('.sidebar-toggle')
  if (toggle) {
    await toggle.click()
    await sleep(250)
  }
  check('the library reopens after being auto-collapsed', !!(await page.$('.panel--left')))

  // "Add image" opens a real file picker, so drive it through the file chooser.
  const chooser = page.waitForFileChooser()
  await page.$$eval('.panel--left button', (buttons) =>
    buttons.find((button) => button.textContent.includes('Add image')).click(),
  )
  await (await chooser).accept([FIXTURE_PNG])
  await page.waitForFunction(() => globalThis.__roomPlannerStore.getState().itemTemplate !== null, {
    timeout: 5000,
  })

  const armed = await state()
  check(
    'picking an image arms the item tool at the pixel aspect ratio',
    armed.tool === 'item' &&
      armed.itemTemplate.imageId &&
      armed.itemTemplate.width === 72 &&
      armed.itemTemplate.depth === 36,
    `${armed.itemTemplate?.width}x${armed.itemTemplate?.depth}`,
  )

  await clickWorld({ x: 96, y: 78 })
  const placed = (await plan()).items.at(-1)
  check('clicking the plan places the image as an item', !!placed.imageId, placed.imageId ?? 'none')

  const painted = await page.$eval('.items-layer image', (element) => ({
    href: element.getAttribute('href'),
    width: Number(element.getAttribute('width')),
  }))
  check(
    'the image item paints its bitmap on the canvas',
    painted.href.startsWith('blob:') && painted.width === 72,
    JSON.stringify(painted),
  )

  // Export: the archive must carry both the document and the image file.
  const client = await page.createCDPSession()
  await client.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOADS,
    eventsEnabled: true,
  })
  await page.$$eval('.topbar button', (buttons) =>
    buttons.find((button) => button.textContent.includes('Export')).click(),
  )
  const archivePath = await waitForDownload('.zip')
  const entries = unzipSync(new Uint8Array(readFileSync(archivePath)))
  const names = Object.keys(entries)
  const exported = JSON.parse(new TextDecoder().decode(entries['plan.json']))
  check(
    'export downloads a zip holding plan.json and the image',
    names.includes('plan.json') && names.includes(`images/${placed.imageId}.png`),
    names.join(', '),
  )
  check(
    'the exported document references the image by id only',
    exported.items.at(-1).imageId === placed.imageId &&
      !JSON.stringify(exported).includes('base64'),
  )
  check(
    'the archived image is byte-identical to the original',
    Buffer.compare(
      Buffer.from(entries[`images/${placed.imageId}.png`]),
      readFileSync(FIXTURE_PNG),
    ) === 0,
  )

  // Import: start from an empty plan so the round trip has to restore both.
  page.on('dialog', (dialog) => dialog.accept())
  await page.$$eval('.topbar .btn', (buttons) =>
    buttons.find((button) => button.textContent.includes('New')).click(),
  )
  await sleep(200)
  check('new plan clears the document', (await plan()).items.length === 0)

  const importChooser = page.waitForFileChooser()
  await page.$$eval('.topbar .btn', (buttons) =>
    buttons.find((button) => button.textContent.includes('Open')).click(),
  )
  await (await importChooser).accept([archivePath])
  await page.waitForFunction(() => globalThis.__roomPlannerStore.getState().plan.items.length > 0, {
    timeout: 5000,
  })
  await sleep(200)

  const restored = (await plan()).items.at(-1)
  check('importing the zip restores the image item', restored.imageId === placed.imageId)
  const repainted = await page.$eval('.items-layer image', (element) =>
    element.getAttribute('href'),
  )
  check('the imported image renders from the archive', repainted.startsWith('blob:'), repainted)
}

// -------------------------------------------------------------- 16. persistence
{
  const before = await plan()
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(700)
  const after = await plan()
  check(
    'plan survives a reload',
    after.rooms.length === before.rooms.length && after.items.length === before.items.length,
  )
  check('history is empty after reload', (await state()).past.length === 0)
  // Bitmaps live in IndexedDB, so they must come back without the archive.
  await page.waitForSelector('.items-layer image', { timeout: 5000 }).catch(() => null)
  const rehydrated = await page.$eval('.items-layer image', (element) =>
    element.getAttribute('href'),
  )
  check('images rehydrate from IndexedDB after a reload', rehydrated?.startsWith('blob:'), rehydrated ?? 'missing')
}

// --------------------------------------------- 17. drag and drop images onto the plan
{
  const before = (await plan()).items.length
  const at = await toPage({ x: 132, y: 96 })
  const fixture = readFileSync(FIXTURE_PNG).toString('base64')

  // Synthesise the file drag: the browser won't let a script read files during
  // dragover, so the handler must key off dataTransfer.types, not .files.
  const overAccepted = await page.evaluate(
    async (base64, x, y) => {
      const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
      const transfer = new DataTransfer()
      transfer.items.add(new File([blob], 'dropped.png', { type: 'image/png' }))
      const host = document.querySelector('.canvas-host')
      globalThis.__drag = { transfer, host, x, y }
      globalThis.__fire = (type) =>
        host.dispatchEvent(
          new DragEvent(type, {
            dataTransfer: transfer,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
          }),
        )
      globalThis.__fire('dragenter')
      // A cancelled dragover is what tells the browser a drop is allowed.
      return !globalThis.__fire('dragover')
    },
    fixture,
    at.x,
    at.y,
  )
  await sleep(200)
  const highlighted = await page.$eval('.canvas-host', (host) =>
    host.classList.contains('canvas-host--image-drag'),
  )
  const dropAlignment = await page.evaluate(() => {
    const overlay = document.querySelector('.canvas-drop-overlay').getBoundingClientRect()
    const badge = document.querySelector('.canvas-drop-overlay span').getBoundingClientRect()
    const library = document.querySelector('.panel--left')?.getBoundingClientRect()
    const visibleLeft = library?.right ?? overlay.left
    return {
      actual: (badge.left + badge.right) / 2,
      expected: (visibleLeft + overlay.right) / 2,
      libraryExpanded: Boolean(library),
    }
  })
  check(
    'dragging a file over the canvas is accepted and highlighted',
    overAccepted && highlighted,
    JSON.stringify({ overAccepted, highlighted }),
  )
  check(
    'Drop to place is centered in the viewport beside the expanded library',
    dropAlignment.libraryExpanded && Math.abs(dropAlignment.actual - dropAlignment.expected) < 1,
    JSON.stringify(dropAlignment),
  )
  await page.evaluate(() => globalThis.__fire('drop'))

  await page.waitForFunction(
    (count) => globalThis.__roomPlannerStore.getState().plan.items.length > count,
    { timeout: 5000 },
    before,
  )
  await sleep(200)
  const dropped = (await plan()).items.at(-1)
  const state17 = await state()
  check('dropping an image adds it as an item', !!dropped.imageId, dropped.imageId ?? 'none')
  check(
    'the dropped image lands under the cursor at its pixel aspect ratio',
    Math.abs(dropped.center.x - 132) <= 12 &&
      Math.abs(dropped.center.y - 96) <= 12 &&
      dropped.width === 72 &&
      dropped.depth === 36,
    JSON.stringify({ center: dropped.center, w: dropped.width, h: dropped.depth }),
  )
  check(
    'the dropped image is selected with the select tool active',
    state17.tool === 'select' && state17.selection[0]?.id === dropped.id,
  )
  check('the drop highlight clears', !(await page.$('.canvas-host--image-drag')))

  await press('z', ['Meta'])
  check('one undo removes the dropped image', (await plan()).items.length === before)
}

// -------------------------------------------------- 18. settings popover layout
{
  // Short window: the popover has to scroll internally rather than overflow.
  await page.setViewport({ width: 1512, height: 520, deviceScaleFactor: 1 })
  await sleep(250)
  await page.$eval('.topbar__settings button', (button) => button.click())
  await sleep(250)

  const settingLabels = await page.$$eval(
    '.settings-popover .field__label',
    (labels) => labels.map((label) => label.textContent),
  )
  check(
    'global wall thickness sits directly below grid and snap step',
    settingLabels.slice(0, 3).join('|') === 'Units|Grid & snap step|Wall thickness',
    settingLabels.join(', '),
  )

  const layout = await page.evaluate(() => {
    const popover = document.querySelector('.settings-popover')
    const body = document.querySelector('.settings-popover__body')
    const box = popover.getBoundingClientRect()
    const statusbar = document.querySelector('.statusbar').getBoundingClientRect()
    return {
      scrolls: body.scrollHeight > body.clientHeight,
      popoverScrolls: popover.scrollHeight > popover.clientHeight,
      clearsStatusBar: box.bottom <= statusbar.top,
    }
  })
  check(
    'the settings popover scrolls its body, not the whole panel',
    layout.scrolls && !layout.popoverScrolls,
    JSON.stringify(layout),
  )
  check('the settings popover stays clear of the status bar', layout.clearsStatusBar)

  const pinned = await page.evaluate(() => {
    const body = document.querySelector('.settings-popover__body')
    body.scrollTop = body.scrollHeight
    const box = document.querySelector('.settings-popover').getBoundingClientRect()
    const header = document.querySelector('.settings-popover__header').getBoundingClientRect()
    const footer = document.querySelector('.settings-popover__footer').getBoundingClientRect()
    return {
      header: Math.abs(header.top - box.top) < 2,
      footer: Math.abs(footer.bottom - box.bottom) < 2,
    }
  })
  check(
    'the settings header and footer stay pinned while scrolling',
    pinned.header && pinned.footer,
    JSON.stringify(pinned),
  )

  await page.keyboard.press('Escape')
  await sleep(150)
  check(
    'Escape closes the settings popover',
    (await page.$('.settings-popover')) === null,
  )
  await page.setViewport({ width: 1512, height: 950, deviceScaleFactor: 1 })
  await sleep(200)
}

await page.screenshot({ path: '/tmp/rp-test-final.png' })
await browser.close()
rmSync(DOWNLOADS, { recursive: true, force: true })

const failed = results.filter((result) => !result.pass)
for (const result of results) {
  console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? `  — ${result.detail}` : ''}`)
}
if (errors.length > 0) {
  console.log('\nRuntime errors:')
  for (const error of errors) console.log(`  ${error}`)
}
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length > 0 || errors.length > 0 ? 1 : 0)
