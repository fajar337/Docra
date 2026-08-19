import type {
  AnnotColor,
  PDFDocument,
  PDFObject,
  PDFPage,
  Rect,
} from 'mupdf'
import type {
  DrawingObject,
  EditorObject,
  EditorRect,
  EditorTextObject,
  HighlightObject,
  RedactionObject,
  TextFontChoice,
} from '../types/editor'
import type { PDFPageInfo } from '../types/pdf'
import {
  drawingToPagePoints,
  editorPointToMupdfPoint,
  editorRectToMupdfRect,
  pagePointsToBounds,
  pageQuadToMupdfQuad,
  rectObjectToPageQuad,
} from './coordinates'
import { getMuPDF } from './mupdf'
import { safeReplacementBounds } from './textMetrics'
import type { PDFTextItem } from '../types/pdf'
import { getBundledFont } from './fontAssets'

interface ExportFontCache {
  bundled: Map<TextFontChoice, PDFObject>
  source: Map<
    string,
    {
      object: PDFObject
      supportedCharacters: Set<string>
    }
  >
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes)
}

function parseHexColor(color: string): AnnotColor {
  const normalized = color.trim().replace(/^#/, '')
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((channel) => `${channel}${channel}`)
          .join('')
      : normalized

  if (!/^[0-9a-f]{6}$/iu.test(expanded)) {
    return [0, 0, 0]
  }

  return [
    Number.parseInt(expanded.slice(0, 2), 16) / 255,
    Number.parseInt(expanded.slice(2, 4), 16) / 255,
    Number.parseInt(expanded.slice(4, 6), 16) / 255,
  ]
}

function markAnnotation(annotation: ReturnType<PDFPage['createAnnotation']>) {
  const mupdf = getMuPDF()
  annotation.setFlags(mupdf.PDFAnnotation.IS_PRINT)
  annotation.setAuthor('Docra PDF Workbench')
  annotation.setModificationDate(new Date())
}

function normalizeFontName(name: string): string {
  return name
    .replace(/^[A-Z]{6}\+/u, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, '')
    .replace(/(?:ps)?mt$/u, '')
    .replace(/regular$/u, '')
}

function sourceFontCacheKey(fontName: string): string {
  return normalizeFontName(fontName)
}

function captureSourceFonts(
  document: PDFDocument,
  page: PDFPage,
  objects: EditorTextObject[],
  fontCache: ExportFontCache,
): void {
  const requestedFonts = new Map<string, Set<string>>()

  objects.forEach((object) => {
    if (getTextFontChoice(object) !== 'original' || !object.fontName) {
      return
    }

    const key = sourceFontCacheKey(object.fontName)
    const characters = new Set([...object.text].filter((value) => !/\s/u.test(value)))
    const cached = fontCache.source.get(key)
    if (
      key.length === 0 ||
      [...characters].every((character) =>
        cached?.supportedCharacters.has(character),
      )
    ) {
      return
    }

    const requested = requestedFonts.get(key) ?? new Set<string>()
    characters.forEach((character) => requested.add(character))
    requestedFonts.set(key, requested)
  })

  if (requestedFonts.size === 0) {
    return
  }

  const mupdf = getMuPDF()
  const device = new mupdf.Device({
    fillText: (text, _ctm, colorspace) => {
      try {
        text.walk({
          beginSpan: (font) => {
            const key = sourceFontCacheKey(font.getName())
            const requestedCharacters = requestedFonts.get(key)
            if (
              !requestedCharacters ||
              [...requestedCharacters].some(
                (character) => font.encodeCharacter(character) === 0,
              )
            ) {
              return
            }

            try {
              const pdfFont = document.addSimpleFont(font, 'Latin')
              fontCache.source.set(key, {
                object: pdfFont,
                supportedCharacters: requestedCharacters,
              })
              requestedFonts.delete(key)
            } catch {
              // Keep the annotation's Helvetica fallback when a PDF subset
              // cannot be safely reused for the replacement text.
            }
          },
        })
      } finally {
        text.destroy()
        colorspace.destroy()
      }
    },
  })

  try {
    page.runPageContents(device, mupdf.Matrix.identity)
    device.close()
  } finally {
    device.destroy()
  }
}

function findPageFont(
  page: PDFPage,
  fontNames: string | string[] | undefined,
): PDFObject | null {
  if (!fontNames) {
    return null
  }

  const requestedNames = (Array.isArray(fontNames) ? fontNames : [fontNames]).map(
    normalizeFontName,
  )
  const pageObject = page.getObject()
  const resources = pageObject.getInheritable('Resources').resolve()
  const fonts = resources.get('Font').resolve()
  let match: PDFObject | null = null

  fonts.forEach((font) => {
    if (match) {
      return
    }

    const resolvedFont = font.resolve()
    const subtype = resolvedFont.get('Subtype')
    const baseFont = resolvedFont.get('BaseFont')
    if (
      !subtype.isName() ||
      !baseFont.isName() ||
      (subtype.asName() !== 'Type1' && subtype.asName() !== 'TrueType')
    ) {
      return
    }

    if (requestedNames.includes(normalizeFontName(baseFont.asName()))) {
      match = font
    }
  })

  return match
}

function replaceAppearanceFont(
  annotation: ReturnType<PDFPage['createAnnotation']>,
  font: PDFObject,
): void {
  const annotationObject = annotation.getObject().resolve()
  const appearance = annotationObject.get('AP', 'N').resolve()
  const appearanceFonts = appearance.get('Resources', 'Font').resolve()
  let appearanceFontKey: string | null = null

  appearanceFonts.forEach((_font, key) => {
    appearanceFontKey ??= String(key)
  })

  if (appearanceFontKey) {
    appearanceFonts.put(appearanceFontKey, font)
  }
}

function getTextFontChoice(object: EditorTextObject): TextFontChoice {
  return (
    object.fontChoice ??
    (object.source === 'replacement' ? 'original' : 'helvetica')
  )
}

function getSelectedFontResource(
  document: PDFDocument,
  page: PDFPage,
  object: EditorTextObject,
  fontCache: ExportFontCache,
): PDFObject | null {
  const fontChoice = getTextFontChoice(object)

  if (fontChoice === 'original') {
    if (!object.fontName) {
      return null
    }

    const cached = fontCache.source.get(sourceFontCacheKey(object.fontName))
    const replacementCharacters = [...object.text].filter(
      (character) => !/\s/u.test(character),
    )
    return cached &&
      replacementCharacters.every((character) =>
        cached.supportedCharacters.has(character),
      )
      ? cached.object
      : null
  }
  if (fontChoice === 'arial') {
    return findPageFont(page, ['Arial', 'ArialMT'])
  }
  if (fontChoice === 'helvetica') {
    return findPageFont(page, 'Helvetica')
  }
  if (fontChoice === 'helvetica-neue-light') {
    return findPageFont(page, [
      'Helvetica Neue Light',
      'HelveticaNeue-Light',
      'HelveticaNeueLTStd-Lt',
    ])
  }

  const cached = fontCache.bundled.get(fontChoice)
  if (cached) {
    return cached
  }

  const bundledFont = getBundledFont(fontChoice)
  if (!bundledFont) {
    return null
  }

  const mupdf = getMuPDF()
  const font = new mupdf.Font(bundledFont.name, bundledFont.bytes)
  try {
    const pdfFont = document.addSimpleFont(font, 'Latin')
    fontCache.bundled.set(fontChoice, pdfFont)
    return pdfFont
  } finally {
    font.destroy()
  }
}

function applySelectedFontAppearance(
  document: PDFDocument,
  page: PDFPage,
  annotation: ReturnType<PDFPage['createAnnotation']>,
  object: EditorTextObject,
  fontCache: ExportFontCache,
): void {
  const font = getSelectedFontResource(document, page, object, fontCache)
  if (font) {
    replaceAppearanceFont(annotation, font)
  }
}

function createRedaction(
  page: PDFPage,
  bounds: EditorRect,
  pageBounds: Rect,
): void {
  const annotation = page.createAnnotation('Redact')
  markAnnotation(annotation)
  annotation.setRect(editorRectToMupdfRect(bounds, pageBounds))
  annotation.update()
}

function applyReplacementRedactions(
  page: PDFPage,
  objects: EditorTextObject[],
  pageBounds: Rect,
  textItems: PDFTextItem[],
): void {
  const mupdf = getMuPDF()
  const replacements = objects.filter(
    (object) => object.source === 'replacement' && object.replacementFor,
  )

  if (replacements.length === 0) {
    return
  }

  replacements.forEach((object) => {
    if (
      object.replacementFor &&
      object.replacementFor.annotationObjectNumber === undefined
    ) {
      createRedaction(
        page,
        safeReplacementBounds(
          object.replacementFor.bounds,
          object.replacementFor.textItemIds ??
            object.replacementFor.textItemId,
          textItems,
        ),
        pageBounds,
      )
    }
  })
  page.applyRedactions(
    false,
    mupdf.PDFPage.REDACT_IMAGE_PIXELS,
    mupdf.PDFPage.REDACT_LINE_ART_NONE,
    mupdf.PDFPage.REDACT_TEXT_REMOVE,
  )
}

function removeReplacedTextAnnotations(
  page: PDFPage,
  objects: EditorTextObject[],
): void {
  const replacedObjectNumbers = new Set(
    objects.flatMap((object) => {
      const objectNumber = object.replacementFor?.annotationObjectNumber
      return objectNumber === undefined ? [] : [objectNumber]
    }),
  )

  if (replacedObjectNumbers.size === 0) {
    return
  }

  page.getAnnotations().forEach((annotation) => {
    const object = annotation.getObject()
    if (
      object.isIndirect() &&
      replacedObjectNumbers.has(object.asIndirect())
    ) {
      page.deleteAnnotation(annotation)
    }
  })
}

function applyManualRedactions(
  page: PDFPage,
  objects: RedactionObject[],
  pageBounds: Rect,
): void {
  const mupdf = getMuPDF()
  if (objects.length === 0) {
    return
  }

  objects.forEach((object) => {
    const rotatedBounds = pagePointsToBounds(rectObjectToPageQuad(object))
    createRedaction(page, rotatedBounds, pageBounds)
  })
  page.applyRedactions(
    true,
    mupdf.PDFPage.REDACT_IMAGE_PIXELS,
    mupdf.PDFPage.REDACT_LINE_ART_REMOVE_IF_TOUCHED,
    mupdf.PDFPage.REDACT_TEXT_REMOVE,
  )
}

function addTextAnnotation(
  document: PDFDocument,
  page: PDFPage,
  object: EditorTextObject,
  pageBounds: Rect,
  fontCache: ExportFontCache,
): void {
  const annotation = page.createAnnotation('FreeText')
  markAnnotation(annotation)
  annotation.setRect(
    editorRectToMupdfRect(
      {
        x: object.x,
        y: object.y,
        width: Math.max(object.width, 16),
        height: Math.max(object.height, object.fontSize * 1.35),
      },
      pageBounds,
    ),
  )
  annotation.setContents(object.text)
  annotation.setDefaultAppearance(
    'Helv',
    Math.max(6, object.fontSize),
    parseHexColor(object.color),
  )
  annotation.setBorderWidth(0)
  annotation.setOpacity(1)
  annotation.setQuadding(0)
  annotation.update()
  applySelectedFontAppearance(document, page, annotation, object, fontCache)
}

function addHighlightAnnotation(
  page: PDFPage,
  object: HighlightObject,
  pageBounds: Rect,
): void {
  const annotation = page.createAnnotation('Highlight')
  markAnnotation(annotation)
  annotation.setQuadPoints([
    pageQuadToMupdfQuad(rectObjectToPageQuad(object), pageBounds),
  ])
  annotation.setColor([1, 0.82, 0.12])
  annotation.setOpacity(0.38)
  annotation.update()
}

function addDrawingAnnotation(
  page: PDFPage,
  object: DrawingObject,
  pageBounds: Rect,
): void {
  const pagePoints = drawingToPagePoints(object)
  if (pagePoints.length < 2) {
    return
  }

  const annotation = page.createAnnotation('Ink')
  markAnnotation(annotation)
  annotation.setInkList([
    pagePoints.map((point) => editorPointToMupdfPoint(point, pageBounds)),
  ])
  annotation.setColor(parseHexColor(object.color))
  annotation.setBorderWidth(Math.max(0.5, object.width))
  annotation.setOpacity(1)
  annotation.update()
}

function applyPageObjects(
  document: PDFDocument,
  pageInfo: PDFPageInfo,
  objects: EditorObject[],
  fontCache: ExportFontCache,
): void {
  const page = document.loadPage(pageInfo.pageIndex)
  try {
    const textObjects = objects.filter(
      (object): object is EditorTextObject => object.type === 'text',
    )
    const redactions = objects.filter(
      (object): object is RedactionObject => object.type === 'redaction',
    )
    const highlights = objects.filter(
      (object): object is HighlightObject => object.type === 'highlight',
    )
    const drawings = objects.filter(
      (object): object is DrawingObject => object.type === 'drawing',
    )

    captureSourceFonts(document, page, textObjects, fontCache)

    removeReplacedTextAnnotations(page, textObjects)
    applyReplacementRedactions(
      page,
      textObjects,
      pageInfo.bounds,
      pageInfo.textItems,
    )
    applyManualRedactions(page, redactions, pageInfo.bounds)
    textObjects.forEach((object) =>
      addTextAnnotation(document, page, object, pageInfo.bounds, fontCache),
    )
    highlights.forEach((object) =>
      addHighlightAnnotation(page, object, pageInfo.bounds),
    )
    drawings.forEach((object) =>
      addDrawingAnnotation(page, object, pageInfo.bounds),
    )
    page.update()
  } finally {
    page.destroy()
  }
}

export class PDFExportError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PDFExportError'
  }
}

export function exportPDF(
  originalBytes: Uint8Array,
  objects: EditorObject[],
  pages: PDFPageInfo[],
): Uint8Array {
  const mupdf = getMuPDF()
  let document: PDFDocument | null = null

  try {
    const openedDocument = mupdf.Document.openDocument(
      copyBytes(originalBytes),
      'application/pdf',
    )
    document = openedDocument.asPDF()
    if (!document) {
      openedDocument.destroy()
      throw new PDFExportError('Dokumen sumber bukan PDF yang dapat diedit.')
    }

    const fontCache: ExportFontCache = {
      bundled: new Map(),
      source: new Map(),
    }

    for (const pageInfo of pages) {
      const pageObjects = objects.filter(
        (object) => object.pageIndex === pageInfo.pageIndex,
      )
      if (pageObjects.length > 0) {
        applyPageObjects(document, pageInfo, pageObjects, fontCache)
      }
    }

    const buffer = document.saveToBuffer(
      'garbage=4,compress=yes,compress-images=yes,compress-fonts=yes',
    )
    try {
      return copyBytes(buffer.asUint8Array())
    } finally {
      buffer.destroy()
    }
  } catch (error) {
    if (error instanceof PDFExportError) {
      throw error
    }
    throw new PDFExportError(
      'MuPDF gagal menerapkan perubahan atau menyimpan dokumen.',
      { cause: error },
    )
  } finally {
    document?.destroy()
  }
}

export function downloadPDF(bytes: Uint8Array, filename = 'edited.pdf'): void {
  const blobBytes = new Uint8Array(new ArrayBuffer(bytes.byteLength))
  blobBytes.set(bytes)
  const blob = new Blob([blobBytes.buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
