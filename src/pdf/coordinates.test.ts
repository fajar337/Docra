import { describe, expect, it } from 'vitest'
import {
  editorRectToMupdfRect,
  mupdfRectToEditorRect,
  normalizeDraggedRect,
  pageToScreenPoint,
  screenToPagePoint,
} from './coordinates'

describe('coordinate conversions', () => {
  it('keeps editor coordinates stable when zoom changes', () => {
    const pagePoint = { x: 100, y: 250 }
    const screenPoint = pageToScreenPoint(pagePoint, 2)

    expect(screenPoint).toEqual({ x: 200, y: 500 })
    expect(screenToPagePoint(screenPoint, 2)).toEqual(pagePoint)
  })

  it('converts between non-zero MuPDF bounds and local editor bounds', () => {
    const pageBounds: [number, number, number, number] = [10, 20, 610, 820]
    const mupdfRect: [number, number, number, number] = [110, 270, 210, 300]
    const local = mupdfRectToEditorRect(mupdfRect, pageBounds)

    expect(local).toEqual({ x: 100, y: 250, width: 100, height: 30 })
    expect(editorRectToMupdfRect(local, pageBounds)).toEqual(mupdfRect)
  })

  it('normalizes drag direction', () => {
    expect(normalizeDraggedRect({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 40,
      height: 60,
    })
  })
})
