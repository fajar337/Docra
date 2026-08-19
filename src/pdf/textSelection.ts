import type { PDFTextItem } from '../types/pdf'

const NO_SPACE_BEFORE = /^[,.;:!?%\])}]/u
const NO_SPACE_AFTER = /[([{]$/u

function normalizedFontName(item: PDFTextItem): string {
  return (item.fontName ?? '').replace(/^[A-Z]{6}\+/u, '').toLowerCase()
}

function haveCompatibleTypography(
  first: PDFTextItem,
  second: PDFTextItem,
): boolean {
  const firstSize = first.fontSize ?? first.height
  const secondSize = second.fontSize ?? second.height
  const referenceSize = Math.max(firstSize, secondSize, 1)

  return (
    normalizedFontName(first) === normalizedFontName(second) &&
    Math.abs(firstSize - secondSize) <= Math.max(0.5, referenceSize * 0.06) &&
    (first.color ?? '').toLowerCase() === (second.color ?? '').toLowerCase()
  )
}

function areSelectableNeighbors(
  first: PDFTextItem,
  second: PDFTextItem,
): boolean {
  if (first.pageIndex !== second.pageIndex || !haveCompatibleTypography(first, second)) {
    return false
  }

  const firstSize = first.fontSize ?? first.height
  const secondSize = second.fontSize ?? second.height
  const referenceSize = Math.max(firstSize, secondSize, 1)
  const firstCenterY = first.y + first.height / 2
  const secondCenterY = second.y + second.height / 2
  const verticalShift = Math.abs(firstCenterY - secondCenterY)
  const baselineShift =
    first.baselineY === undefined || second.baselineY === undefined
      ? 0
      : Math.abs(first.baselineY - second.baselineY)
  const horizontalGap = second.x - (first.x + first.width)

  return (
    verticalShift <= Math.max(referenceSize * 0.3, 2) &&
    baselineShift <= Math.max(referenceSize * 0.2, 2) &&
    horizontalGap >= -referenceSize * 0.1 &&
    horizontalGap <= Math.max(referenceSize * 0.7, 4)
  )
}

function appendText(current: string, next: string): string {
  if (NO_SPACE_BEFORE.test(next) || NO_SPACE_AFTER.test(current)) {
    return `${current}${next}`
  }
  return `${current} ${next}`
}

function mergeGroup(group: PDFTextItem[]): PDFTextItem {
  const first = group[0]
  const left = Math.min(...group.map((item) => item.x))
  const top = Math.min(...group.map((item) => item.y))
  const right = Math.max(...group.map((item) => item.x + item.width))
  const bottom = Math.max(...group.map((item) => item.y + item.height))

  return {
    ...first,
    text: group.slice(1).reduce((text, item) => appendText(text, item.text), first.text),
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    sourceTextItemIds: group.flatMap(
      (item) => item.sourceTextItemIds ?? [item.id],
    ),
  }
}

export function mergeSelectableTextItems(
  items: PDFTextItem[],
): PDFTextItem[] {
  if (items.length < 2) {
    return items
  }

  const merged: PDFTextItem[] = []
  let group: PDFTextItem[] = [items[0]]

  const flush = () => {
    merged.push(group.length === 1 ? group[0] : mergeGroup(group))
  }

  for (const item of items.slice(1)) {
    const previous = group.at(-1)
    if (previous && areSelectableNeighbors(previous, item)) {
      group.push(item)
      continue
    }

    flush()
    group = [item]
  }

  flush()
  return merged
}
