import { describe, expect, it } from 'vitest'
import {
  distanceBetween,
  midpointBetween,
  zoomFromPinch,
} from './pinchZoom'

describe('pinch zoom geometry', () => {
  it('tracks distance and midpoint between two touches', () => {
    expect(distanceBetween({ x: 10, y: 20 }, { x: 40, y: 60 })).toBe(50)
    expect(midpointBetween({ x: 10, y: 20 }, { x: 40, y: 60 })).toEqual({
      x: 25,
      y: 40,
    })
  })

  it('scales and clamps document zoom', () => {
    expect(zoomFromPinch(1, 100, 150)).toBe(1.5)
    expect(zoomFromPinch(1, 100, 10)).toBe(0.25)
    expect(zoomFromPinch(1, 100, 300)).toBe(2)
  })
})
