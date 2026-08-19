import { describe, expect, it } from 'vitest'
import type { PDFTextItem } from '../types/pdf'
import { extractTextItems, mergeWordCountTextItems } from './textExtractor'
import mupdf from 'mupdf'

function extractFixtureText(content: string) {
  const document = new mupdf.PDFDocument()
  try {
    const regular = document.addSimpleFont(new mupdf.Font('Helvetica'), 'Latin')
    const bold = document.addSimpleFont(new mupdf.Font('Helvetica-Bold'), 'Latin')
    const fonts = document.newDictionary()
    fonts.put('F1', regular)
    fonts.put('F2', bold)
    const resources = document.addObject(document.newDictionary())
    resources.put('Font', fonts)
    const pageObject = document.addPage([0, 0, 200, 100], 0, resources, content)
    document.insertPage(-1, pageObject)
    const page = document.loadPage(0)
    try {
      const bounds = page.getBounds('CropBox')
      return extractTextItems(page, 0, bounds)
    } finally {
      page.destroy()
    }
  } finally {
    document.destroy()
  }
}

function textItem(
  id: string,
  text: string,
  x: number,
  width: number,
  y = 10,
): PDFTextItem {
  return {
    id,
    pageIndex: 0,
    text,
    x,
    y,
    width,
    height: 10,
    fontSize: 10,
    fontName: 'Helvetica',
    color: '#000000',
    baselineX: x,
    baselineY: 18,
  }
}

describe('mergeWordCountTextItems', () => {
  it('merges a comparison, number, and WORDS label into one selectable item', () => {
    const result = mergeWordCountTextItems([
      textItem('less-than', '<', 10, 5),
      textItem('number', '25', 18, 12),
      textItem('unit', 'WORDS', 34, 32),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'less-than',
      text: '< 25 WORDS',
      x: 10,
      width: 56,
    })
  })

  it('also merges an already-combined comparison and number', () => {
    const result = mergeWordCountTextItems([
      textItem('count', '<25', 10, 20),
      textItem('unit', 'WORDS', 34, 32),
    ])

    expect(result.map((item) => item.text)).toEqual(['< 25 WORDS'])
  })

  it('does not merge ordinary words or labels on another line', () => {
    const result = mergeWordCountTextItems([
      textItem('title-1', 'CAREER', 10, 36),
      textItem('title-2', 'DEVELOPMENT', 50, 72),
      textItem('number', '25', 10, 12),
      textItem('unit', 'WORDS', 26, 32, 30),
    ])

    expect(result.map((item) => item.text)).toEqual([
      'CAREER',
      'DEVELOPMENT',
      '25',
      'WORDS',
    ])
  })
})

describe('extractTextItems', () => {
  it('keeps adjacent letters as one word when a PDF switches font per glyph', () => {
    const items = extractFixtureText(
      'BT /F1 10 Tf 20 50 Td (O) Tj /F2 10 Tf (F) Tj /F1 10 Tf (F) Tj ET',
    )

    expect(items.map((item) => item.text)).toEqual(['OFF'])
  })
})
