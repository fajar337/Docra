import type { PDFDocument, Rect } from 'mupdf'

export interface PDFTextItem {
  id: string
  pageIndex: number
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize?: number
  fontName?: string
  color?: string
  baselineX?: number
  baselineY?: number
  sourceTextItemIds?: string[]
  annotationObjectNumber?: number
}

export interface PDFPageInfo {
  pageIndex: number
  bounds: Rect
  width: number
  height: number
  textItems: PDFTextItem[]
}

export interface LoadedPDF {
  document: PDFDocument
  bytes: Uint8Array
  pageCount: number
  pages: PDFPageInfo[]
}
