import type { Point, Quad, Rect } from 'mupdf'
import type {
  DrawingObject,
  EditorRect,
  HighlightObject,
  RedactionObject,
} from '../types/editor'

export interface CoordinatePoint {
  x: number
  y: number
}

export function screenToPagePoint(
  point: CoordinatePoint,
  zoom: number,
): CoordinatePoint {
  return {
    x: point.x / zoom,
    y: point.y / zoom,
  }
}

export function pageToScreenPoint(
  point: CoordinatePoint,
  zoom: number,
): CoordinatePoint {
  return {
    x: point.x * zoom,
    y: point.y * zoom,
  }
}

export function mupdfRectToEditorRect(
  rect: Rect,
  pageBounds: Rect,
): EditorRect {
  return {
    x: rect[0] - pageBounds[0],
    y: rect[1] - pageBounds[1],
    width: rect[2] - rect[0],
    height: rect[3] - rect[1],
  }
}

export function editorRectToMupdfRect(
  rect: EditorRect,
  pageBounds: Rect,
): Rect {
  return [
    rect.x + pageBounds[0],
    rect.y + pageBounds[1],
    rect.x + rect.width + pageBounds[0],
    rect.y + rect.height + pageBounds[1],
  ]
}

export function editorPointToMupdfPoint(
  point: CoordinatePoint,
  pageBounds: Rect,
): Point {
  return [point.x + pageBounds[0], point.y + pageBounds[1]]
}

export function quadToRect(quad: Quad): Rect {
  const xs = [quad[0], quad[2], quad[4], quad[6]]
  const ys = [quad[1], quad[3], quad[5], quad[7]]
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

export function normalizeDraggedRect(
  start: CoordinatePoint,
  end: CoordinatePoint,
): EditorRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

type RotatableRect = RedactionObject | HighlightObject

export function rectObjectToPageQuad(object: RotatableRect): CoordinatePoint[] {
  const radians = (object.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const localPoints = [
    { x: 0, y: 0 },
    { x: object.width, y: 0 },
    { x: object.width, y: object.height },
    { x: 0, y: object.height },
  ]

  return localPoints.map((point) => ({
    x: object.x + point.x * cos - point.y * sin,
    y: object.y + point.x * sin + point.y * cos,
  }))
}

export function pageQuadToMupdfQuad(
  points: CoordinatePoint[],
  pageBounds: Rect,
): Quad {
  if (points.length !== 4) {
    throw new Error('Quad harus berisi tepat empat titik.')
  }

  return [
    points[0].x + pageBounds[0],
    points[0].y + pageBounds[1],
    points[1].x + pageBounds[0],
    points[1].y + pageBounds[1],
    points[2].x + pageBounds[0],
    points[2].y + pageBounds[1],
    points[3].x + pageBounds[0],
    points[3].y + pageBounds[1],
  ]
}

export function pagePointsToBounds(points: CoordinatePoint[]): EditorRect {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)

  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  }
}

export function drawingToPagePoints(object: DrawingObject): CoordinatePoint[] {
  const radians = (object.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const result: CoordinatePoint[] = []

  for (let index = 0; index < object.points.length; index += 2) {
    const scaledX = object.points[index] * object.scaleX
    const scaledY = object.points[index + 1] * object.scaleY
    result.push({
      x: object.x + scaledX * cos - scaledY * sin,
      y: object.y + scaledX * sin + scaledY * cos,
    })
  }

  return result
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
