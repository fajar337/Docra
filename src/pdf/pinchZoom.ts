import { normalizeZoom } from '../stores/editorStore'

export interface GesturePoint {
  x: number
  y: number
}

export function distanceBetween(
  first: GesturePoint,
  second: GesturePoint,
): number {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

export function midpointBetween(
  first: GesturePoint,
  second: GesturePoint,
): GesturePoint {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  }
}

export function zoomFromPinch(
  startZoom: number,
  startDistance: number,
  currentDistance: number,
): number {
  if (startDistance <= 0 || currentDistance <= 0) {
    return normalizeZoom(startZoom)
  }
  return normalizeZoom(startZoom * (currentDistance / startDistance))
}
