/** Screenshots the drag-over affordance and a dropped image. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1512, height: 950, deviceScaleFactor: 1 })
await page.goto('http://localhost:5183/', { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  localStorage.clear()
  indexedDB.deleteDatabase('roomplanner')
})
await page.reload({ waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 700))

const fixture = readFileSync(join(import.meta.dirname, 'rp-fixture.png')).toString('base64')

await page.evaluate(async (base64) => {
  const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
  const transfer = new DataTransfer()
  transfer.items.add(new File([blob], 'photo.png', { type: 'image/png' }))
  const host = document.querySelector('.canvas-host')
  const box = host.getBoundingClientRect()
  globalThis.__fire = (type) =>
    host.dispatchEvent(
      new DragEvent(type, {
        dataTransfer: transfer,
        bubbles: true,
        cancelable: true,
        clientX: box.left + box.width * 0.5,
        clientY: box.top + box.height * 0.55,
      }),
    )
  globalThis.__fire('dragenter')
  globalThis.__fire('dragover')
}, fixture)

await new Promise((r) => setTimeout(r, 300))
await page.screenshot({ path: '/tmp/rp-dragover.png' })

await page.evaluate(() => globalThis.__fire('drop'))
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: '/tmp/rp-dropped.png' })

await browser.close()
