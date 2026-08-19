import type { PDFDocument } from 'mupdf'
import type { LoadedPDF, PDFPageInfo } from '../types/pdf'
import { mupdfRectToEditorRect } from './coordinates'
import { getMuPDF } from './mupdf'
import { extractTextItems } from './textExtractor'

const DOCRA_ANNOTATION_AUTHOR = 'Docra PDF Workbench'

function channelToHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value * 255)))
    .toString(16)
    .padStart(2, '0')
}

function annotationColorToHex(color: number[]): string {
  if (color.length === 1) {
    const gray = channelToHex(color[0])
    return `#${gray}${gray}${gray}`
  }

  if (color.length >= 3) {
    return `#${channelToHex(color[0])}${channelToHex(color[1])}${channelToHex(color[2])}`
  }

  return '#000000'
}

function extractEditableAnnotations(
  page: ReturnType<PDFDocument['loadPage']>,
  pageIndex: number,
  pageBounds: [number, number, number, number],
) {
  return page
    .getAnnotations()
    .filter(
      (annotation) =>
        annotation.getType() === 'FreeText' &&
        annotation.getAuthor() === DOCRA_ANNOTATION_AUTHOR &&
        annotation.getContents().length > 0,
    )
    .map((annotation, index) => {
      const object = annotation.getObject()
      const annotationObjectNumber = object.isIndirect()
        ? object.asIndirect()
        : undefined
      const bounds = mupdfRectToEditorRect(annotation.getRect(), pageBounds)
      const appearance = annotation.getDefaultAppearance()
      const fontSize = Math.max(6, appearance.size || bounds.height * 0.74)

      return {
        id: `${pageIndex}:annotation:${annotationObjectNumber ?? index}`,
        pageIndex,
        text: annotation.getContents(),
        ...bounds,
        fontSize,
        fontName: appearance.font === 'Helv' ? 'Helvetica' : appearance.font,
        color: annotationColorToHex(appearance.color),
        baselineX: bounds.x,
        baselineY: bounds.y + fontSize * 0.8,
        annotationObjectNumber,
      }
    })
}

export class PDFLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PDFLoadError'
  }
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes)
}

export function loadPDF(bytes: Uint8Array): LoadedPDF {
  const mupdf = getMuPDF()
  let document: PDFDocument | null = null

  try {
    const openedDocument = mupdf.Document.openDocument(
      copyBytes(bytes),
      'application/pdf',
    )

    if (openedDocument.needsPassword()) {
      openedDocument.destroy()
      throw new PDFLoadError(
        'PDF terenkripsi belum didukung. Buka proteksinya terlebih dahulu lalu coba lagi.',
      )
    }

    document = openedDocument.asPDF()
    if (!document) {
      openedDocument.destroy()
      throw new PDFLoadError('File yang dipilih bukan dokumen PDF yang valid.')
    }

    const pageCount = document.countPages()
    const pages: PDFPageInfo[] = []

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const page = document.loadPage(pageIndex)
      try {
        const bounds = page.getBounds('CropBox')
        const textItems = extractTextItems(page, pageIndex, bounds)
        const editableAnnotations = extractEditableAnnotations(
          page,
          pageIndex,
          bounds,
        )
        pages.push({
          pageIndex,
          bounds,
          width: bounds[2] - bounds[0],
          height: bounds[3] - bounds[1],
          textItems: [...textItems, ...editableAnnotations],
        })
      } finally {
        page.destroy()
      }
    }

    return {
      document,
      bytes: copyBytes(bytes),
      pageCount,
      pages,
    }
  } catch (error) {
    if (document) {
      document.destroy()
    }
    if (error instanceof PDFLoadError) {
      throw error
    }
    throw new PDFLoadError(
      'MuPDF tidak dapat membuka file ini. Pastikan file tidak rusak dan berformat PDF.',
      { cause: error },
    )
  }
}
