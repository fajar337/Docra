import { describe, expect, it } from 'vitest'
import type { PDFTextItem } from '../types/pdf'
import { mergeSelectableTextItems } from './textSelection'

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
    height: 24,
    fontSize: 24,
    fontName: 'Helvetica',
    color: '#000000',
    baselineX: x,
    baselineY: y + 20,
  }
}

describe('mergeSelectableTextItems', () => {
  it('merges neighboring words on the same line into one selection', () => {
    const result = mergeSelectableTextItems([
      textItem('human', 'Human', 10, 72),
      textItem('generated', 'Generated', 88, 112),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'human',
      text: 'Human Generated',
      x: 10,
      width: 190,
      sourceTextItemIds: ['human', 'generated'],
    })
  })

  it('does not merge another line or incompatible typography', () => {
    const differentFont = textItem('other-font', 'Bold', 88, 48)
    differentFont.fontName = 'Helvetica-Bold'

    const result = mergeSelectableTextItems([
      textItem('first', 'Human', 10, 72),
      differentFont,
      textItem('next-line', 'Generated', 10, 112, 44),
    ])

    expect(result.map((item) => item.text)).toEqual([
      'Human',
      'Bold',
      'Generated',
    ])
  })
})
