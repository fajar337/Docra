import mupdf from 'mupdf'
import type { PDFPage } from 'mupdf'
import { beforeAll, describe, expect, it } from 'vitest'
import { exportPDF } from './exporter'
import { initializeMuPDF } from './mupdf'
import type { ImageObject } from '../types/editor'

function imageDataUrl(): string {
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 8, 8], true)
  try {
    const pixels = pixmap.getPixels()
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const color = y < 4 ? (x < 4 ? [255, 0, 0, 255] : [0, 255, 0, 255]) : (x < 4 ? [0, 0, 255, 255] : [0, 0, 0, 0])
        pixels.set(color, (y * 8 + x) * 4)
      }
    }
    return `data:image/png;base64,${btoa(String.fromCharCode(...pixmap.asPNG()))}`
  } finally { pixmap.destroy() }
}

describe('image PDF export', () => {
  beforeAll(initializeMuPDF)

  it.each([0, 90, 37, -90])('preserves image size, position, transparency and rotation %s after reopening', (rotation) => {
    const source = new mupdf.PDFDocument()
    let bytes: Uint8Array
    try {
      source.insertPage(-1, source.addPage([0, 0, 300, 250], 0, {}, '0.8 g 0 0 300 250 re f'))
      const buffer = source.saveToBuffer('')
      try { bytes = Uint8Array.from(buffer.asUint8Array()) } finally { buffer.destroy() }
    } finally { source.destroy() }

    const image: ImageObject = {
      id: 'image:fixture', type: 'image', pageIndex: 0, name: 'quadrants.png',
      x: 130, y: 100, width: 80, height: 40, rotation, dataUrl: imageDataUrl(),
    }
    const exported = exportPDF(bytes!, [image], [{ pageIndex: 0, bounds: [0, 0, 300, 250], width: 300, height: 250, textItems: [] }])
    const reopened = mupdf.Document.openDocument(exported, 'application/pdf').asPDF()!
    try {
      const page = reopened.loadPage(0) as PDFPage
      try {
        expect(page.getAnnotations()).toHaveLength(0)
        const pixmap = page.toPixmap([1, 0, 0, 1, 0, 0], mupdf.ColorSpace.DeviceRGB, false)
        try {
          const pixels = pixmap.getPixels()
          for (const [u, v, expected] of [
            [0.25, 0.25, [255, 0, 0]], [0.75, 0.25, [0, 255, 0]],
            [0.25, 0.75, [0, 0, 255]], [0.75, 0.75, [204, 204, 204]],
          ] as const) {
            const radians = rotation * Math.PI / 180
            const x = Math.floor(image.x + u * image.width * Math.cos(radians) - v * image.height * Math.sin(radians))
            const y = Math.floor(image.y + u * image.width * Math.sin(radians) + v * image.height * Math.cos(radians))
            const offset = y * pixmap.getStride() + x * 3
            const actual = Array.from(pixels.slice(offset, offset + 3))
            actual.forEach((value, index) => expect(Math.abs(value - expected[index])).toBeLessThanOrEqual(2))
          }
        } finally { pixmap.destroy() }
      } finally { page.destroy() }
    } finally { reopened.destroy() }
  })
})
