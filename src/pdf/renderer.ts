import type { PDFDocument } from 'mupdf'
import { getMuPDF } from './mupdf'

function pixmapToImageData(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  stride: number,
  components: number,
): ImageData {
  if (components === 4 && stride === width * 4) {
    return new ImageData(new Uint8ClampedArray(pixels), width, height)
  }

  const rgba = new Uint8ClampedArray(width * height * 4)

  if (components === 3 && stride === width * 3) {
    let source = 0
    let target = 0

    while (target < rgba.length) {
      rgba[target] = pixels[source]
      rgba[target + 1] = pixels[source + 1]
      rgba[target + 2] = pixels[source + 2]
      rgba[target + 3] = 255
      source += 3
      target += 4
    }

    return new ImageData(rgba, width, height)
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = y * stride + x * components
      const target = (y * width + x) * 4

      if (components === 1) {
        rgba[target] = pixels[source]
        rgba[target + 1] = pixels[source]
        rgba[target + 2] = pixels[source]
        rgba[target + 3] = 255
      } else {
        rgba[target] = pixels[source]
        rgba[target + 1] = pixels[source + 1]
        rgba[target + 2] = pixels[source + 2]
        rgba[target + 3] = components > 3 ? pixels[source + 3] : 255
      }
    }
  }

  return new ImageData(rgba, width, height)
}

export function renderPDFPage(
  document: PDFDocument,
  pageIndex: number,
  scale: number,
  canvas: HTMLCanvasElement,
): void {
  const mupdf = getMuPDF()
  const page = document.loadPage(pageIndex)
  try {
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(scale, scale),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true,
      'View',
      'CropBox',
    )

    try {
      const width = pixmap.getWidth()
      const height = pixmap.getHeight()
      const context = canvas.getContext('2d', { alpha: false })

      if (!context) {
        throw new Error('Canvas 2D tidak tersedia di browser ini.')
      }

      canvas.width = width
      canvas.height = height
      context.putImageData(
        pixmapToImageData(
          pixmap.getPixels(),
          width,
          height,
          pixmap.getStride(),
          pixmap.getNumberOfComponents(),
        ),
        0,
        0,
      )
    } finally {
      pixmap.destroy()
    }
  } finally {
    page.destroy()
  }
}
