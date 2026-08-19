import mupdf from 'mupdf'
import type { PDFPage, Point } from 'mupdf'
import { describe, expect, it } from 'vitest'
import type { EditorObject } from '../types/editor'
import type { PDFPageInfo } from '../types/pdf'
import { createReplacementObject } from '../tools/objectFactory'
import { exportPDF } from './exporter'
import { extractTextItems } from './textExtractor'
import { safeReplacementBounds } from './textMetrics'

function createSourcePDF(): Uint8Array {
  const document = new mupdf.PDFDocument()
  try {
    const font = document.addSimpleFont(new mupdf.Font('Helvetica'), 'Latin')
    const fonts = document.newDictionary()
    fonts.put('F1', font)
    const resources = document.addObject(document.newDictionary())
    resources.put('Font', fonts)
    const pageObject = document.addPage(
      [0, 0, 300, 200],
      0,
      resources,
      'BT /F1 16 Tf 20 50 Td (Original text) Tj ET',
    )
    document.insertPage(-1, pageObject)
    const buffer = document.saveToBuffer('compress=yes')
    try {
      return Uint8Array.from(buffer.asUint8Array())
    } finally {
      buffer.destroy()
    }
  } finally {
    document.destroy()
  }
}

function createMixedSizeSourcePDF(): Uint8Array {
  const document = new mupdf.PDFDocument()
  try {
    const font = document.addSimpleFont(new mupdf.Font('Times-Bold'), 'Latin')
    const fonts = document.newDictionary()
    fonts.put('F1', font)
    const resources = document.addObject(document.newDictionary())
    resources.put('Font', fonts)
    const pageObject = document.addPage(
      [0, 0, 300, 200],
      0,
      resources,
      [
        '0 0 0 RG 1 w 20 150 m 280 150 l S',
        'BT /F1 48 Tf 20 100 Td (24) Tj /F1 16 Tf (%) Tj ET',
        'BT /F1 10 Tf 20 85 Td (SIMILARITY INDEX) Tj ET',
      ].join('\n'),
    )
    document.insertPage(-1, pageObject)
    const buffer = document.saveToBuffer('compress=yes')
    try {
      return Uint8Array.from(buffer.asUint8Array())
    } finally {
      buffer.destroy()
    }
  } finally {
    document.destroy()
  }
}

function createUnsupportedFontSourcePDF(): Uint8Array {
  const document = new mupdf.PDFDocument()
  try {
    const font = document.addSimpleFont(new mupdf.Font('ZapfDingbats'), 'Latin')
    const fonts = document.newDictionary()
    fonts.put('F1', font)
    const resources = document.addObject(document.newDictionary())
    resources.put('Font', fonts)
    const pageObject = document.addPage(
      [0, 0, 200, 100],
      0,
      resources,
      'BT /F1 8 Tf 20 50 Td (0) Tj ET',
    )
    document.insertPage(-1, pageObject)
    const buffer = document.saveToBuffer('compress=yes')
    try {
      return Uint8Array.from(buffer.asUint8Array())
    } finally {
      buffer.destroy()
    }
  } finally {
    document.destroy()
  }
}

describe('MuPDF exporter', () => {
  it('saves annotations and produces a PDF that MuPDF can reopen', () => {
    const source = createSourcePDF()
    const pages: PDFPageInfo[] = [
      {
        pageIndex: 0,
        bounds: [0, 0, 300, 200],
        width: 300,
        height: 200,
        textItems: [],
      },
    ]
    const objects: EditorObject[] = [
      {
        id: 'text:1',
        type: 'text',
        pageIndex: 0,
        x: 20,
        y: 20,
        width: 120,
        height: 24,
        text: 'Added with MuPDF',
        fontSize: 14,
        color: '#111827',
        rotation: 0,
        source: 'added',
      },
      {
        id: 'highlight:1',
        type: 'highlight',
        pageIndex: 0,
        x: 18,
        y: 45,
        width: 110,
        height: 20,
        rotation: 0,
      },
      {
        id: 'drawing:1',
        type: 'drawing',
        pageIndex: 0,
        x: 20,
        y: 90,
        points: [0, 0, 20, 10, 40, 0],
        width: 2,
        color: '#175cd3',
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      {
        id: 'redaction:1',
        type: 'redaction',
        pageIndex: 0,
        x: 180,
        y: 120,
        width: 60,
        height: 20,
        rotation: 0,
      },
    ]

    const output = exportPDF(source, objects, pages)
    expect(output.byteLength).toBeGreaterThan(100)

    const reopened = mupdf.Document.openDocument(
      output,
      'application/pdf',
    ).asPDF()
    expect(reopened).not.toBeNull()
    if (!reopened) {
      return
    }

    try {
      expect(reopened.countPages()).toBe(1)
      const page = reopened.loadPage(0) as PDFPage
      try {
        const annotationTypes = page
          .getAnnotations()
          .map((annotation) => annotation.getType())
        expect(annotationTypes).toContain('FreeText')
        expect(annotationTypes).toContain('Highlight')
        expect(annotationTypes).toContain('Ink')
      } finally {
        page.destroy()
      }
    } finally {
      reopened.destroy()
    }
  })

  it('keeps 17 on the exact font face and baseline used by 24', () => {
    const source = createMixedSizeSourcePDF()
    const sourceDocument = mupdf.Document.openDocument(
      source,
      'application/pdf',
    ).asPDF()
    expect(sourceDocument).not.toBeNull()
    if (!sourceDocument) {
      return
    }

    let pageInfo: PDFPageInfo
    let originalBaseline: number
    try {
      const page = sourceDocument.loadPage(0) as PDFPage
      try {
        const bounds = page.getBounds('CropBox')
        const textItems = extractTextItems(page, 0, bounds)
        const number = textItems.find((item) => item.text === '24')
        const label = textItems.find((item) => item.text === 'SIMILARITY')
        expect(number).toBeDefined()
        expect(textItems.some((item) => item.text === '%')).toBe(true)
        expect(label).toBeDefined()
        if (!number || !label || number.baselineY === undefined) {
          throw new Error('Fixture number baseline was not extracted.')
        }
        expect(number.y + number.height).toBeGreaterThan(label.y)
        const safeBounds = safeReplacementBounds(
          number,
          number.id,
          textItems,
        )
        expect(safeBounds.y + safeBounds.height).toBeLessThan(label.y)
        originalBaseline = number.baselineY
        pageInfo = {
          pageIndex: 0,
          bounds,
          width: bounds[2] - bounds[0],
          height: bounds[3] - bounds[1],
          textItems,
        }

        const replacement = createReplacementObject(number, '17')
        const output = exportPDF(source, [replacement], [pageInfo])
        const reopened = mupdf.Document.openDocument(
          output,
          'application/pdf',
        ).asPDF()
        expect(reopened).not.toBeNull()
        if (!reopened) {
          return
        }

        try {
          const reopenedPage = reopened.loadPage(0) as PDFPage
          try {
            const pageText = reopenedPage.toStructuredText(
              'preserve-whitespace',
            )
            try {
              expect(pageText.asText()).toContain('SIMILARITY INDEX')
            } finally {
              pageText.destroy()
            }

            let strokedPathCount = 0
            const device = new mupdf.Device({
              strokePath: () => {
                strokedPathCount += 1
              },
            })
            try {
              reopenedPage.runPageContents(device, mupdf.Matrix.identity)
              device.close()
            } finally {
              device.destroy()
            }
            expect(strokedPathCount).toBeGreaterThan(0)

            const annotation = reopenedPage
              .getAnnotations()
              .find((candidate) => candidate.getType() === 'FreeText')
            expect(annotation?.getContents()).toBe('17')
            if (!annotation) {
              return
            }

            const displayList = annotation.toDisplayList()
            try {
              const structuredText = displayList.toStructuredText(
                'preserve-whitespace',
              )
              try {
                const origins: number[] = []
                const renderedFonts: string[] = []
                const boldStates: boolean[] = []
                structuredText.walk({
                  onChar: (_character: string, origin: Point, font) => {
                    origins.push(origin[1])
                    renderedFonts.push(font.getName())
                    boldStates.push(font.isBold())
                  },
                })
                expect(origins.length).toBeGreaterThan(0)
                expect(origins[0]).toBeCloseTo(originalBaseline, 2)
                expect(new Set(renderedFonts)).toEqual(
                  new Set(['Times-Bold']),
                )
                expect(new Set(boldStates)).toEqual(new Set([true]))
              } finally {
                structuredText.destroy()
              }
            } finally {
              displayList.destroy()
            }
          } finally {
            reopenedPage.destroy()
          }
        } finally {
          reopened.destroy()
        }
      } finally {
        page.destroy()
      }
    } finally {
      sourceDocument.destroy()
    }
  })

  it('embeds Roboto Light when it is selected', () => {
    const source = createSourcePDF()
    const pages: PDFPageInfo[] = [
      {
        pageIndex: 0,
        bounds: [0, 0, 300, 200],
        width: 300,
        height: 200,
        textItems: [],
      },
    ]
    const objects: EditorObject[] = [
      {
        id: 'text:roboto-light',
        type: 'text',
        pageIndex: 0,
        x: 20,
        y: 20,
        width: 180,
        height: 28,
        text: 'Roboto Light',
        fontSize: 16,
        fontChoice: 'roboto-light',
        color: '#111827',
        rotation: 0,
        source: 'added',
      },
    ]

    const output = exportPDF(source, objects, pages)
    const reopened = mupdf.Document.openDocument(
      output,
      'application/pdf',
    ).asPDF()
    expect(reopened).not.toBeNull()
    if (!reopened) {
      return
    }

    try {
      const page = reopened.loadPage(0) as PDFPage
      try {
        const annotation = page
          .getAnnotations()
          .find((candidate) => candidate.getType() === 'FreeText')
        expect(annotation).toBeDefined()
        if (!annotation) {
          return
        }

        const displayList = annotation.toDisplayList()
        try {
          const structuredText = displayList.toStructuredText(
            'preserve-whitespace',
          )
          try {
            const fontNames: string[] = []
            structuredText.walk({
              onChar: (_character, _origin, font) => {
                fontNames.push(font.getName())
              },
            })
            expect(fontNames.length).toBeGreaterThan(0)
            expect(new Set(fontNames)).toEqual(new Set(['Roboto-Light']))
          } finally {
            structuredText.destroy()
          }
        } finally {
          displayList.destroy()
        }
      } finally {
        page.destroy()
      }
    } finally {
      reopened.destroy()
    }
  })

  it('falls back safely when the original PDF font lacks replacement glyphs', () => {
    const source = createUnsupportedFontSourcePDF()
    const sourceItem = {
      id: '0:text:0',
      pageIndex: 0,
      text: '0',
      x: 20,
      y: 42,
      width: 6,
      height: 8,
      fontSize: 8,
      fontName: 'ZapfDingbats',
      color: '#aeb3ba',
      baselineX: 20,
      baselineY: 50,
    }
    const replacement = createReplacementObject(sourceItem, 'OFF')
    const output = exportPDF(source, [replacement], [
      {
        pageIndex: 0,
        bounds: [0, 0, 200, 100],
        width: 200,
        height: 100,
        textItems: [sourceItem],
      },
    ])
    const reopened = mupdf.Document.openDocument(
      output,
      'application/pdf',
    ).asPDF()
    expect(reopened).not.toBeNull()
    if (!reopened) {
      return
    }

    try {
      const page = reopened.loadPage(0) as PDFPage
      try {
        const annotation = page
          .getAnnotations()
          .find((candidate) => candidate.getType() === 'FreeText')
        expect(annotation).toBeDefined()
        if (!annotation) {
          return
        }

        const displayList = annotation.toDisplayList()
        try {
          const text = displayList.toStructuredText('preserve-whitespace')
          try {
            expect(text.asText()).toContain('OFF')
          } finally {
            text.destroy()
          }
        } finally {
          displayList.destroy()
        }
      } finally {
        page.destroy()
      }
    } finally {
      reopened.destroy()
    }
  })
})
