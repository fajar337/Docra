import type { Color, Font, PDFPage, Quad, Rect } from 'mupdf'
import type { PDFTextItem } from '../types/pdf'
import { mupdfRectToEditorRect, quadToRect } from './coordinates'

interface WordBuilder {
  text: string
  rect: Rect
  fontSize: number
  fontName: string
  color: string
  baselineX: number
  baselineY: number
}

const COMPARISON_PATTERN = /^(?:<|>|≤|≥|<=|>=)$/u
const NUMBER_PATTERN = /^\d+(?:[.,]\d+)?$/u
const COMPARISON_NUMBER_PATTERN = /^(<|>|≤|≥|<=|>=)\s*(\d+(?:[.,]\d+)?)$/u
const WORD_COUNT_UNIT_PATTERN = /^words?$/iu

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)))
}

function channelToHex(value: number): string {
  return clampChannel(value).toString(16).padStart(2, '0')
}

function colorToHex(color: Color): string {
  if (color.length === 1) {
    const gray = channelToHex(color[0])
    return `#${gray}${gray}${gray}`
  }

  if (color.length === 3) {
    return `#${channelToHex(color[0])}${channelToHex(color[1])}${channelToHex(color[2])}`
  }

  const [cyan, magenta, yellow, black] = color
  const red = (1 - cyan) * (1 - black)
  const green = (1 - magenta) * (1 - black)
  const blue = (1 - yellow) * (1 - black)
  return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`
}

function unionRect(first: Rect, second: Rect): Rect {
  return [
    Math.min(first[0], second[0]),
    Math.min(first[1], second[1]),
    Math.max(first[2], second[2]),
    Math.max(first[3], second[3]),
  ]
}

function areInlineNeighbors(first: PDFTextItem, second: PDFTextItem): boolean {
  const firstCenterY = first.y + first.height / 2
  const secondCenterY = second.y + second.height / 2
  const verticalShift = Math.abs(firstCenterY - secondCenterY)
  const horizontalGap = second.x - (first.x + first.width)
  const referenceSize = Math.max(
    first.fontSize ?? first.height,
    second.fontSize ?? second.height,
    1,
  )

  return (
    verticalShift <= referenceSize * 0.4 &&
    horizontalGap >= -referenceSize * 0.15 &&
    horizontalGap <= Math.max(referenceSize * 0.8, 4)
  )
}

function mergeItems(
  items: PDFTextItem[],
  text: string,
): PDFTextItem {
  const first = items[0]
  const left = Math.min(...items.map((item) => item.x))
  const top = Math.min(...items.map((item) => item.y))
  const right = Math.max(...items.map((item) => item.x + item.width))
  const bottom = Math.max(...items.map((item) => item.y + item.height))

  return {
    ...first,
    text,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

export function mergeWordCountTextItems(
  items: PDFTextItem[],
): PDFTextItem[] {
  const merged: PDFTextItem[] = []

  for (let index = 0; index < items.length; index += 1) {
    const first = items[index]
    const second = items[index + 1]
    const third = items[index + 2]

    if (
      second &&
      third &&
      COMPARISON_PATTERN.test(first.text) &&
      NUMBER_PATTERN.test(second.text) &&
      WORD_COUNT_UNIT_PATTERN.test(third.text) &&
      areInlineNeighbors(first, second) &&
      areInlineNeighbors(second, third)
    ) {
      merged.push(
        mergeItems([first, second, third], `${first.text} ${second.text} ${third.text}`),
      )
      index += 2
      continue
    }

    const comparisonNumber = COMPARISON_NUMBER_PATTERN.exec(first.text)
    if (
      comparisonNumber &&
      second &&
      WORD_COUNT_UNIT_PATTERN.test(second.text) &&
      areInlineNeighbors(first, second)
    ) {
      merged.push(
        mergeItems(
          [first, second],
          `${comparisonNumber[1]} ${comparisonNumber[2]} ${second.text}`,
        ),
      )
      index += 1
      continue
    }

    if (
      second &&
      NUMBER_PATTERN.test(first.text) &&
      WORD_COUNT_UNIT_PATTERN.test(second.text) &&
      areInlineNeighbors(first, second)
    ) {
      merged.push(mergeItems([first, second], `${first.text} ${second.text}`))
      index += 1
      continue
    }

    merged.push(first)
  }

  return merged
}

function shouldStartNewWord(
  current: WordBuilder,
  nextCharacter: string,
  nextRect: Rect,
  font: Font,
  fontSize: number,
  color: string,
): boolean {
  const horizontalGap = nextRect[0] - current.rect[2]
  const currentCenter = (current.rect[1] + current.rect[3]) / 2
  const nextCenter = (nextRect[1] + nextRect[3]) / 2
  const verticalShift = Math.abs(currentCenter - nextCenter)
  const referenceSize = Math.max(current.fontSize, fontSize, 1)
  const continuesLexicalWord =
    /^[\p{L}\p{N}]+$/u.test(current.text) &&
    /^[\p{L}\p{N}]$/u.test(nextCharacter) &&
    horizontalGap >= -referenceSize * 0.2 &&
    horizontalGap <= Math.max(referenceSize * 0.85, 4) &&
    verticalShift <= Math.max(referenceSize * 0.4, 2)

  if (continuesLexicalWord) {
    return false
  }

  return (
    current.fontName !== font.getName() ||
    Math.abs(current.fontSize - fontSize) > 0.25 ||
    current.color !== color ||
    horizontalGap > Math.max(fontSize * 0.45, 2) ||
    verticalShift > Math.max(fontSize * 0.45, 2)
  )
}

export function extractTextItems(
  page: PDFPage,
  pageIndex: number,
  pageBounds: Rect,
): PDFTextItem[] {
  const structuredText = page.toStructuredText('preserve-whitespace')
  const items: PDFTextItem[] = []
  let current: WordBuilder | null = null
  let sequence = 0

  const flush = () => {
    if (!current || current.text.length === 0) {
      current = null
      return
    }

    const bounds = mupdfRectToEditorRect(current.rect, pageBounds)
    items.push({
      id: `${pageIndex}:text:${sequence}`,
      pageIndex,
      text: current.text,
      ...bounds,
      fontSize: current.fontSize,
      fontName: current.fontName || undefined,
      color: current.color,
      baselineX: current.baselineX - pageBounds[0],
      baselineY: current.baselineY - pageBounds[1],
    })
    sequence += 1
    current = null
  }

  try {
    structuredText.walk({
      beginLine: () => flush(),
      endLine: () => flush(),
      onChar: (character, origin, font, size, quad: Quad, color) => {
        if (/\s/u.test(character)) {
          flush()
          return
        }

        const characterRect = quadToRect(quad)
        const characterColor = colorToHex(color)

        if (
          current &&
          shouldStartNewWord(
            current,
            character,
            characterRect,
            font,
            size,
            characterColor,
          )
        ) {
          flush()
        }

        if (!current) {
          current = {
            text: character,
            rect: characterRect,
            fontSize: size,
            fontName: font.getName(),
            color: characterColor,
            baselineX: origin[0],
            baselineY: origin[1],
          }
          return
        }

        current.text += character
        current.rect = unionRect(current.rect, characterRect)
      },
    })
    flush()
    return mergeWordCountTextItems(items)
  } finally {
    structuredText.destroy()
  }
}
