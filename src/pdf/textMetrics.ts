import type { PDFTextItem } from '../types/pdf'
import type { EditorRect } from '../types/editor'
import type { TextFontChoice } from '../types/editor'

// MuPDF's generated Helvetica FreeText appearance and Konva's modern text
// renderer place the alphabetic baseline at roughly 80% of the font size.
export const TEXT_BASELINE_RATIO = 0.8

export function previewFontFamily(fontName?: string): string {
  if (!fontName) {
    return 'Arial, Helvetica, sans-serif'
  }

  const name = fontName.replace(/^[A-Z]{6}\+/u, '')
  const normalized = name.toLowerCase()

  if (normalized.includes('times')) {
    return 'Times New Roman, Times, serif'
  }
  if (normalized.includes('courier')) {
    return 'Courier New, Courier, monospace'
  }
  if (normalized.includes('helvetica') || normalized.includes('arial')) {
    return 'Arial, Helvetica, sans-serif'
  }

  return `${name}, Arial, Helvetica, sans-serif`
}

export function previewTextFont(
  fontChoice: TextFontChoice | undefined,
  sourceFontName?: string,
): { family: string; style: string } {
  switch (fontChoice) {
    case 'arial':
      return { family: 'Arial, Helvetica, sans-serif', style: 'normal' }
    case 'helvetica':
      return { family: 'Helvetica, Arial, sans-serif', style: 'normal' }
    case 'helvetica-neue-light':
      return {
        family: 'Helvetica Neue, Helvetica, Arial, sans-serif',
        style: '300',
      }
    case 'roboto-regular':
      return { family: 'Docra Roboto, Arial, sans-serif', style: '400' }
    case 'roboto-light':
      return { family: 'Docra Roboto, Arial, sans-serif', style: '300' }
    case 'original':
    default: {
      const normalized = sourceFontName?.toLowerCase() ?? ''
      return {
        family: previewFontFamily(sourceFontName),
        style: normalized.includes('bold')
          ? 'bold'
          : normalized.includes('light')
            ? '300'
            : 'normal',
      }
    }
  }
}

let previewMeasurementContext: CanvasRenderingContext2D | null = null

export function minimumPreviewTextWidth(
  text: string,
  fontSize: number,
  fontChoice: TextFontChoice | undefined,
  sourceFontName?: string,
): number {
  const font = previewTextFont(fontChoice, sourceFontName)
  let measuredWidth = 0

  if (typeof document !== 'undefined') {
    previewMeasurementContext ??= document
      .createElement('canvas')
      .getContext('2d')
    if (previewMeasurementContext) {
      previewMeasurementContext.font = `${font.style} ${fontSize}px ${font.family}`
      measuredWidth = previewMeasurementContext.measureText(text).width
    }
  }

  if (measuredWidth <= 0) {
    measuredWidth = Array.from(text).reduce((width, character) => {
      if (/\s/u.test(character)) {
        return width + fontSize * 0.28
      }
      if (/[ilI1.,'|]/u.test(character)) {
        return width + fontSize * 0.28
      }
      if (/[MW@#%]/u.test(character)) {
        return width + fontSize * 0.88
      }
      return width + fontSize * 0.56
    }, 0)
  }

  return Math.ceil(measuredWidth + Math.max(2, fontSize * 0.2))
}

export function replacementTextPosition(
  item: PDFTextItem,
  fontSize: number,
): { x: number; y: number } {
  return {
    x: item.baselineX ?? item.x,
    y:
      item.baselineY === undefined
        ? item.y
        : item.baselineY - fontSize * TEXT_BASELINE_RATIO,
  }
}

const REDACTION_NEIGHBOR_GAP = 0.25
const MIN_REDACTION_SIZE = 0.5

export function safeReplacementBounds(
  bounds: EditorRect,
  sourceTextItemIds: string | readonly string[],
  textItems: PDFTextItem[],
): EditorRect {
  const sourceIds = new Set(
    typeof sourceTextItemIds === 'string'
      ? [sourceTextItemIds]
      : sourceTextItemIds,
  )
  let left = bounds.x
  let top = bounds.y
  let right = bounds.x + bounds.width
  let bottom = bounds.y + bounds.height
  const sourceCenterX = bounds.x + bounds.width / 2
  const sourceCenterY = bounds.y + bounds.height / 2

  for (const neighbor of textItems) {
    if (sourceIds.has(neighbor.id) || neighbor.text.length === 0) {
      continue
    }

    const neighborRight = neighbor.x + neighbor.width
    const neighborBottom = neighbor.y + neighbor.height
    const overlapX = Math.min(right, neighborRight) - Math.max(left, neighbor.x)
    const overlapY = Math.min(bottom, neighborBottom) - Math.max(top, neighbor.y)
    if (overlapX <= 0 || overlapY <= 0) {
      continue
    }

    const neighborCenterX = neighbor.x + neighbor.width / 2
    const neighborCenterY = neighbor.y + neighbor.height / 2
    const horizontalDistance =
      Math.abs(neighborCenterX - sourceCenterX) /
      Math.max((bounds.width + neighbor.width) / 2, 1)
    const verticalDistance =
      Math.abs(neighborCenterY - sourceCenterY) /
      Math.max((bounds.height + neighbor.height) / 2, 1)

    if (verticalDistance >= horizontalDistance) {
      if (neighborCenterY >= sourceCenterY) {
        const nextBottom = neighbor.y - REDACTION_NEIGHBOR_GAP
        if (nextBottom - top >= MIN_REDACTION_SIZE) {
          bottom = Math.min(bottom, nextBottom)
        }
      } else {
        const nextTop = neighborBottom + REDACTION_NEIGHBOR_GAP
        if (bottom - nextTop >= MIN_REDACTION_SIZE) {
          top = Math.max(top, nextTop)
        }
      }
    } else if (neighborCenterX >= sourceCenterX) {
      const nextRight = neighbor.x - REDACTION_NEIGHBOR_GAP
      if (nextRight - left >= MIN_REDACTION_SIZE) {
        right = Math.min(right, nextRight)
      }
    } else {
      const nextLeft = neighborRight + REDACTION_NEIGHBOR_GAP
      if (right - nextLeft >= MIN_REDACTION_SIZE) {
        left = Math.max(left, nextLeft)
      }
    }
  }

  return {
    x: left,
    y: top,
    width: Math.max(MIN_REDACTION_SIZE, right - left),
    height: Math.max(MIN_REDACTION_SIZE, bottom - top),
  }
}
