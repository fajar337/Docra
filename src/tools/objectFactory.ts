import type {
  DrawingObject,
  EditorRect,
  EditorTextObject,
  HighlightObject,
  RedactionObject,
  TextFontChoice,
} from '../types/editor'
import type { PDFTextItem } from '../types/pdf'
import {
  minimumPreviewTextWidth,
  replacementTextPosition,
} from '../pdf/textMetrics'

function createId(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`
}

export function createTextObject(
  pageIndex: number,
  x: number,
  y: number,
): EditorTextObject {
  return {
    id: createId('text'),
    type: 'text',
    pageIndex,
    x,
    y,
    width: 160,
    height: 26,
    text: 'Text',
    fontSize: 16,
    fontChoice: 'helvetica',
    color: '#111827',
    rotation: 0,
    source: 'added',
  }
}

export function createReplacementObject(
  item: PDFTextItem,
  replacement: string,
  fontChoice: TextFontChoice = 'original',
): EditorTextObject {
  const fontSize = item.fontSize ?? Math.max(8, item.height * 0.82)
  const position = replacementTextPosition(item, fontSize)
  const minimumWidth = minimumPreviewTextWidth(
    replacement,
    fontSize,
    fontChoice,
    item.fontName,
  )

  return {
    id: createId('replacement'),
    type: 'text',
    pageIndex: item.pageIndex,
    x: position.x,
    y: position.y,
    width: Math.max(item.width, minimumWidth, 24),
    height: Math.max(item.height, item.fontSize ?? 12),
    text: replacement,
    fontSize,
    fontName: item.fontName,
    fontChoice,
    color: item.color ?? '#111827',
    rotation: 0,
    source: 'replacement',
    replacementFor: {
      textItemId: item.id,
      ...(item.sourceTextItemIds
        ? { textItemIds: item.sourceTextItemIds }
        : {}),
      ...(item.annotationObjectNumber === undefined
        ? {}
        : { annotationObjectNumber: item.annotationObjectNumber }),
      originalText: item.text,
      bounds: {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      },
    },
  }
}

export function createRedactionObject(
  pageIndex: number,
  rect: EditorRect,
): RedactionObject {
  return {
    id: createId('redaction'),
    type: 'redaction',
    pageIndex,
    rotation: 0,
    ...rect,
  }
}

export function createHighlightObject(
  pageIndex: number,
  rect: EditorRect,
): HighlightObject {
  return {
    id: createId('highlight'),
    type: 'highlight',
    pageIndex,
    rotation: 0,
    ...rect,
  }
}

export function createDrawingObject(
  pageIndex: number,
  origin: { x: number; y: number },
  points: number[],
): DrawingObject {
  return {
    id: createId('drawing'),
    type: 'drawing',
    pageIndex,
    x: origin.x,
    y: origin.y,
    points,
    width: 2,
    color: '#175cd3',
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  }
}
