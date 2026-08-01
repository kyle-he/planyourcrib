import puppeteer from 'puppeteer'

const url = process.env.URL ?? 'http://localhost:5183/'
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1512, height: 950, deviceScaleFactor: 2 })

const logs = []
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`))
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`))
page.on('requestfailed', (req) => logs.push(`[requestfailed] ${req.url()}`))

await page.goto(url, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 700))

const steps = JSON.parse(process.env.STEPS ?? '[]')
for (const step of steps) {
  if (step.type === 'click') await page.mouse.click(step.x, step.y, step.options ?? {})
  if (step.type === 'drag') {
    await page.mouse.move(step.from.x, step.from.y)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(
        step.from.x + ((step.to.x - step.from.x) * i) / 8,
        step.from.y + ((step.to.y - step.from.y) * i) / 8,
      )
      await new Promise((r) => setTimeout(r, 12))
    }
    await page.mouse.up()
  }
  if (step.type === 'key') await page.keyboard.press(step.key, step.options ?? {})
  if (step.type === 'down') await page.keyboard.down(step.key)
  if (step.type === 'up') await page.keyboard.up(step.key)
  if (step.type === 'move') await page.mouse.move(step.x, step.y)
  if (step.type === 'wait') await new Promise((r) => setTimeout(r, step.ms))
  if (step.type === 'shot')
    await page.screenshot({ path: step.path, ...(step.clip ? { clip: step.clip } : {}) })
  if (step.type === 'reset') {
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: 'networkidle0' })
    await new Promise((r) => setTimeout(r, 600))
  }
}

await page.screenshot({ path: process.env.OUT ?? '/tmp/rp-shot.png' })

const state = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem('roomplanner:document') ?? 'null')
  } catch {
    return null
  }
})

console.log(JSON.stringify({ logs, counts: {
  rooms: state?.state?.plan?.rooms?.length ?? null,
  items: state?.state?.plan?.items?.length ?? null,
  openings: state?.state?.plan?.openings?.length ?? null,
} }, null, 2))

await browser.close()
