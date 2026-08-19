import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'

test('refreshes Docra from the brand and exposes the app logo', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    '/docra-logo.svg',
  )
  await page
    .locator('input[type="file"]')
    .setInputFiles(resolve('.tmp', 'docra-test.pdf'))
  await expect(page.locator('.pdf-page-card')).toHaveCount(2)

  await page.getByRole('button', { name: 'Refresh Docra' }).click()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('.pdf-page-card')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Docra' })).toBeVisible()
})

test('opens, edits, exports, and reopens a PDF in Docra', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Docra' })).toBeVisible()

  await page
    .locator('input[type="file"]')
    .setInputFiles(resolve('.tmp', 'docra-test.pdf'))

  await expect(page.locator('.pdf-page-card')).toHaveCount(2)
  await expect(page.locator('.pdf-page-canvas')).toHaveCount(2)
  await expect(page.getByText('yes', { exact: true })).toBeVisible()
  await expect(page.getByText('Editable Name', { exact: true })).not.toBeVisible()

  const viewer = page.getByRole('main', { name: 'PDF pages' })
  const zoomInput = page.getByRole('spinbutton', { name: 'Zoom', exact: true })
  await viewer.dispatchEvent('wheel', { ctrlKey: true, deltaY: -100 })
  await expect(zoomInput).toHaveValue('101')
  await viewer.dispatchEvent('wheel', { ctrlKey: true, deltaY: 100 })
  await expect(zoomInput).toHaveValue('100')

  await zoomInput.fill('137')
  await zoomInput.press('Enter')
  await expect(zoomInput).toHaveValue('137')
  await page.getByRole('button', { name: 'Zoom out' }).click()
  await expect(zoomInput).toHaveValue('136')
  await zoomInput.fill('100')
  await zoomInput.press('Enter')

  const firstFrame = page.locator('.pdf-page-frame').first()
  await firstFrame.click({ position: { x: 70, y: 50 } })
  await expect(page.getByLabel('Replacement')).toBeVisible()
  await expect(page.getByLabel('Current')).toHaveValue('Editable Name')
  await page.getByLabel('Replacement').fill('Edited Name')
  const fontSelect = page.getByRole('combobox', { name: 'Font' })
  await expect(page.locator('select')).toHaveCount(0)
  await fontSelect.click()
  await expect(page.getByRole('option')).toHaveCount(6)
  await page.screenshot({ path: resolve('.tmp', 'liquid-glass-dropdown.png') })
  await page.getByRole('option', { name: 'Roboto Regular' }).click()
  await expect(fontSelect).toContainText('Roboto Regular')
  await page.getByRole('button', { name: 'Apply replacement' }).click()

  await page.getByRole('button', { name: 'Add Text' }).click()
  await firstFrame.click({ position: { x: 80, y: 130 } })

  await page.getByRole('button', { name: 'Redact' }).click()
  const frameBounds = await firstFrame.boundingBox()
  expect(frameBounds).not.toBeNull()
  if (!frameBounds) {
    return
  }
  await page.mouse.move(frameBounds.x + 170, frameBounds.y + 130)
  await page.mouse.down()
  await page.mouse.move(frameBounds.x + 250, frameBounds.y + 165)
  await page.mouse.up()

  await page.getByRole('button', { name: 'Highlight' }).click()
  await page.mouse.move(frameBounds.x + 30, frameBounds.y + 90)
  await page.mouse.down()
  await page.mouse.move(frameBounds.x + 160, frameBounds.y + 112)
  await page.mouse.up()

  await page.getByRole('button', { name: 'Draw' }).click()
  await page.mouse.move(frameBounds.x + 40, frameBounds.y + 220)
  await page.mouse.down()
  await page.mouse.move(frameBounds.x + 90, frameBounds.y + 240, { steps: 4 })
  await page.mouse.move(frameBounds.x + 140, frameBounds.y + 220, { steps: 4 })
  await page.mouse.up()

  await expect(page.getByText('5 editor objects')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('4 editor objects')).toBeVisible()
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(page.getByText('5 editor objects')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export PDF' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('docra-test.pdf')
  await download.saveAs(resolve('.tmp', 'edited.pdf'))

  await page.getByRole('button', { name: 'Test Export' }).click()
  await expect(page.getByText('docra-test.pdf', { exact: true })).toBeVisible()
  await expect(page.locator('.pdf-page-card')).toHaveCount(2)
  await expect(page.getByText('0 editor objects')).toBeVisible()
  await page.getByRole('button', { name: 'Select / Edit' }).click()
  await page
    .locator('.pdf-page-frame')
    .first()
    .click({ position: { x: 70, y: 50 } })
  await expect(page.getByLabel('Current')).toHaveValue('Edited Name')
  await page.getByLabel('Replacement').fill('Edited Again')
  await page.getByRole('button', { name: 'Apply replacement' }).click()
  await page.getByRole('button', { name: 'Test Export' }).click()
  await expect(page.getByText('0 editor objects')).toBeVisible()
  await page
    .locator('.pdf-page-frame')
    .first()
    .click({ position: { x: 70, y: 50 } })
  await expect(page.getByLabel('Current')).toHaveValue('Edited Again')
  await page.screenshot({ path: resolve('.tmp', 'editor-desktop.png') })
  expect(browserErrors).toEqual([])
})

test('applies the dark glass material palette', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Docra' })).toBeVisible()
  const themeToggle = page.getByRole('switch', { name: 'Dark mode' })
  await expect(themeToggle).toBeChecked()
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
    )
    .toBe('dark')
  await page.screenshot({ path: resolve('.tmp', 'editor-dark.png') })

  await page
    .locator('input[type="file"]')
    .setInputFiles(resolve('.tmp', 'docra-test.pdf'))
  await expect(page.locator('.pdf-page-frame').first()).toHaveAttribute(
    'data-render-state',
    'ready',
  )
  await page
    .locator('.pdf-page-frame')
    .first()
    .click({ position: { x: 70, y: 50 } })
  await page.getByRole('combobox', { name: 'Font' }).click()
  await expect(page.getByRole('option')).toHaveCount(6)
  await page.screenshot({
    path: resolve('.tmp', 'liquid-glass-dropdown-dark.png'),
  })
  await page.keyboard.press('Escape')

  await themeToggle.click()
  await expect(themeToggle).not.toBeChecked()
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
    )
    .toBe('light')

  await page.reload()
  await expect(page.getByRole('switch', { name: 'Dark mode' })).not.toBeChecked()
})

test('tracks the pointer with the toolbar liquid light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  const toolbar = page.locator('.toolbar')
  const bounds = await toolbar.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) {
    return
  }

  await page.mouse.move(bounds.x + bounds.width * 0.72, bounds.y + bounds.height * 0.4)
  await expect(toolbar).toHaveAttribute('data-liquid-active', 'true')
  await expect
    .poll(() =>
      toolbar.evaluate((element) => ({
        x: element.style.getPropertyValue('--toolbar-light-x'),
        y: element.style.getPropertyValue('--toolbar-light-y'),
      })),
    )
    .toEqual(expect.objectContaining({ x: expect.stringContaining('px'), y: expect.stringContaining('px') }))
  await page.screenshot({ path: resolve('.tmp', 'toolbar-liquid-motion.png') })

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height + 24)
  await expect(toolbar).toHaveAttribute('data-liquid-active', 'false')
})

test('keeps the document scrollbars inside the frozen desktop viewer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 1000 })
  await page.goto('/')
  await page
    .locator('input[type="file"]')
    .setInputFiles(resolve('.tmp', 'docra-test.pdf'))

  const viewer = page.getByRole('main', { name: 'PDF pages' })
  await expect(page.locator('.pdf-page-card')).toHaveCount(2)
  const zoomInput = page.getByRole('spinbutton', { name: 'Zoom', exact: true })
  await zoomInput.fill('200')
  await zoomInput.press('Enter')

  const metrics = await viewer.evaluate((element) => ({
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    scrollWidth: element.scrollWidth,
    bottom: element.getBoundingClientRect().bottom,
  }))

  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
  expect(metrics.bottom).toBeLessThanOrEqual(1000)
})

test('uses thin rounded Apple scrollbars without arrow buttons', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 600 })
  await page.goto('/')
  await page
    .locator('input[type="file"]')
    .setInputFiles(resolve('.tmp', 'docra-test.pdf'))

  const firstFrame = page.locator('.pdf-page-frame').first()
  await firstFrame.click({ position: { x: 70, y: 50 } })
  const viewer = page.getByRole('main', { name: 'PDF pages' })
  const inspector = page.getByRole('complementary', {
    name: 'Inspector and debug information',
  })

  const styles = await viewer.evaluate((element) => ({
    width: getComputedStyle(element, '::-webkit-scrollbar').width,
    track: getComputedStyle(element, '::-webkit-scrollbar-track').backgroundColor,
    radius: getComputedStyle(element, '::-webkit-scrollbar-thumb').borderRadius,
    button: getComputedStyle(element, '::-webkit-scrollbar-button').display,
  }))

  expect(styles.width).toBe('12px')
  expect(styles.track).toBe('rgba(0, 0, 0, 0)')
  expect(styles.radius).not.toBe('0px')
  expect(styles.button).toBe('none')
  await expect
    .poll(() => inspector.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)
  await page.screenshot({ path: resolve('.tmp', 'apple-scrollbars.png') })
})

test('turns PDF text into a freely movable object on double click', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .locator('input[type="file"]')
    .setInputFiles(resolve('.tmp', 'docra-test.pdf'))

  const firstFrame = page.locator('.pdf-page-frame').first()
  await firstFrame.dblclick({ position: { x: 70, y: 50 } })

  await expect(page.getByText('1 editor objects')).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Text', exact: true }),
  ).toBeVisible()

  const frameBounds = await firstFrame.boundingBox()
  expect(frameBounds).not.toBeNull()
  if (!frameBounds) {
    return
  }

  await page.mouse.move(frameBounds.x + 70, frameBounds.y + 50)
  await page.mouse.down()
  await page.mouse.move(frameBounds.x + 130, frameBounds.y + 100, { steps: 5 })
  await page.mouse.up()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('1 editor objects')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('0 editor objects')).toBeVisible()
})

for (const width of [320, 375, 414, 768]) {
  test(`keeps the root viewport contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page
      .locator('input[type="file"]')
      .setInputFiles(resolve('.tmp', 'docra-test.pdf'))
    await expect(page.locator('.pdf-page-card')).toHaveCount(2)

    const dimensions = await page.evaluate(() => ({
      rootClientWidth: document.documentElement.clientWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }))

    expect(dimensions.rootScrollWidth).toBe(dimensions.rootClientWidth)
    expect(dimensions.bodyScrollWidth).toBe(dimensions.bodyClientWidth)

    const viewer = page.getByRole('main', { name: 'PDF pages' })
    const firstFrame = page.locator('.pdf-page-frame').first()
    const responsiveWidth = await viewer.evaluate((element) => {
      const style = getComputedStyle(element)
      return (
        element.clientWidth -
        Number.parseFloat(style.paddingInlineStart) -
        Number.parseFloat(style.paddingInlineEnd)
      )
    })
    const frameBounds = await firstFrame.boundingBox()
    expect(frameBounds).not.toBeNull()
    expect(frameBounds?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      responsiveWidth + 1,
    )

    const inspectorBounds = await page
      .getByRole('complementary', {
        name: 'Inspector and debug information',
      })
      .boundingBox()
    expect(inspectorBounds).not.toBeNull()
    expect(inspectorBounds?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(900)

    const toolbarRail = page.locator('.toolbar__row')
    const railMetrics = await toolbarRail.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      scrollbarWidth: getComputedStyle(element).scrollbarWidth,
    }))
    expect(railMetrics.scrollbarWidth).toBe('none')

    const toolRail = page.locator('.tool-strip__rail')
    const toolRailMetrics = await toolRail.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      scrollbarWidth: getComputedStyle(element).scrollbarWidth,
    }))
    expect(toolRailMetrics.scrollbarWidth).toBe('none')

    if (width <= 414) {
      expect(railMetrics.scrollWidth).toBeGreaterThan(railMetrics.clientWidth)
      expect(toolRailMetrics.scrollWidth).toBeGreaterThan(
        toolRailMetrics.clientWidth,
      )
      await expect(
        page.getByRole('spinbutton', { name: 'Zoom', exact: true }),
      ).not.toHaveValue('100')
    }

    if (width === 320) {
      const railBounds = await toolbarRail.boundingBox()
      expect(railBounds).not.toBeNull()
      if (railBounds) {
        await page.mouse.move(
          railBounds.x + railBounds.width - 16,
          railBounds.y + railBounds.height / 2,
        )
        await page.mouse.down()
        await page.mouse.move(
          railBounds.x + 16,
          railBounds.y + railBounds.height / 2,
          { steps: 5 },
        )
        await page.mouse.up()
        await expect
          .poll(() => toolbarRail.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(0)
      }
      await page.screenshot({ path: resolve('.tmp', 'editor-mobile-320.png') })
    }
  })
}
