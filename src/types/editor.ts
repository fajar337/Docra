import type { PDFTextItem } from './pdf'

export const EDITOR_TOOLS = [
  'select',
  'addText',
  'redact',
  'highlight',
  'draw',
] as const

export type EditorTool = (typeof EDITOR_TOOLS)[number]

export const TEXT_FONT_CHOICES = [
  'original',
  'arial',
  'helvetica',
  'helvetica-neue-light',
  'roboto-regular',
  'roboto-light',
] as const

export const DEFAULT_TEXT_FONT = 'roboto-regular' as const

export type TextFontChoice = (typeof TEXT_FONT_CHOICES)[number]

export interface EditorRect {
  x: number
  y: number
  width: number
  height: number
}

interface EditorObjectBase {
  id: string
  pageIndex: number
  rotation: number
}

export interface EditorTextObject extends EditorObjectBase {
  type: 'text'
  x: number
  y: number
  width: number
  height: number
  text: string
  fontSize: number
  fontName?: string
  fontChoice?: TextFontChoice
  color: string
  source: 'added' | 'replacement'
  replacementFor?: {
    textItemId: string
    textItemIds?: string[]
    annotationObjectNumber?: number
    originalText: string
    bounds: EditorRect
  }
}

export interface RedactionObject extends EditorObjectBase {
  type: 'redaction'
  x: number
  y: number
  width: number
  height: number
}

export interface HighlightObject extends EditorObjectBase {
  type: 'highlight'
  x: number
  y: number
  width: number
  height: number
}

export interface DrawingObject extends EditorObjectBase {
  type: 'drawing'
  x: number
  y: number
  points: number[]
  width: number
  color: string
  scaleX: number
  scaleY: number
}

export type EditorObject =
  | EditorTextObject
  | RedactionObject
  | HighlightObject
  | DrawingObject

export interface EditorSelection {
  objectId: string | null
  pdfText: PDFTextItem | null
}
