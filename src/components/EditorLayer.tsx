import { useEffect, useMemo, useRef, useState } from 'react'
import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import {
  Group,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from 'react-konva'
import {
  clamp,
  normalizeDraggedRect,
  screenToPagePoint,
} from '../pdf/coordinates'
import { useEditorStore } from '../stores/editorStore'
import { useHistoryStore } from '../stores/historyStore'
import {
  createDrawingObject,
  createHighlightObject,
  createRedactionObject,
  createReplacementObject,
  createTextObject,
} from '../tools/objectFactory'
import type {
  DrawingObject,
  EditorObject,
  EditorRect,
  EditorTextObject,
  HighlightObject,
  RedactionObject,
} from '../types/editor'
import type { PDFPageInfo } from '../types/pdf'
import { previewTextFont, safeReplacementBounds } from '../pdf/textMetrics'
import { mergeSelectableTextItems } from '../pdf/textSelection'

type DraftObject =
  | {
      kind: 'redaction' | 'highlight'
      start: { x: number; y: number }
      rect: EditorRect
    }
  | {
      kind: 'drawing'
      origin: { x: number; y: number }
      points: number[]
    }

interface EditorLayerProps {
  pageInfo: PDFPageInfo
  zoom: number
}

const CURSORS = {
  select: 'default',
  addText: 'text',
  redact: 'crosshair',
  highlight: 'crosshair',
  draw: 'crosshair',
} as const

function stopEvent(event: KonvaEventObject<Event>): void {
  event.cancelBubble = true
}

export function EditorLayer({ pageInfo, zoom }: EditorLayerProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const nodeRefs = useRef(new Map<string, Konva.Node>())
  const draftRef = useRef<DraftObject | null>(null)
  const [draft, setDraftState] = useState<DraftObject | null>(null)
  const [hoveredTextId, setHoveredTextId] = useState<string | null>(null)

  const activeTool = useEditorStore((state) => state.activeTool)
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId)
  const selectedPdfText = useEditorStore((state) => state.selectedPdfText)
  const selectObject = useEditorStore((state) => state.selectObject)
  const selectPdfText = useEditorStore((state) => state.selectPdfText)
  const setSelectedPage = useEditorStore((state) => state.setSelectedPage)
  const objects = useHistoryStore((state) => state.present)
  const addObject = useHistoryStore((state) => state.addObject)
  const updateObject = useHistoryStore((state) => state.updateObject)

  const pageObjects = useMemo(
    () => objects.filter((object) => object.pageIndex === pageInfo.pageIndex),
    [objects, pageInfo.pageIndex],
  )
  const selectableTextItems = useMemo(
    () => mergeSelectableTextItems(pageInfo.textItems),
    [pageInfo.textItems],
  )

  const setDraft = (next: DraftObject | null) => {
    draftRef.current = next
    setDraftState(next)
  }

  const registerNode = (id: string, node: Konva.Node | null) => {
    if (node) {
      nodeRefs.current.set(id, node)
    } else {
      nodeRefs.current.delete(id)
    }
  }

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) {
      return
    }

    const selectedNode = selectedObjectId
      ? nodeRefs.current.get(selectedObjectId)
      : undefined
    transformer.nodes(activeTool === 'select' && selectedNode ? [selectedNode] : [])
    transformer.getLayer()?.batchDraw()
  }, [activeTool, pageObjects, selectedObjectId])

  useEffect(() => {
    const container = stageRef.current?.container()
    if (!container) {
      return
    }
    container.setAttribute(
      'aria-label',
      `Interaction layer for PDF page ${pageInfo.pageIndex + 1}`,
    )
    container.querySelectorAll('canvas').forEach((canvas) => {
      canvas.setAttribute('aria-hidden', 'true')
    })
  }, [pageInfo.pageIndex])

  const pointerInPage = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition()
    if (!pointer) {
      return null
    }
    return screenToPagePoint(pointer, zoom)
  }

  const handlePointerDown = (event: KonvaEventObject<PointerEvent>) => {
    setSelectedPage(pageInfo.pageIndex)
    const stage = event.target.getStage()
    if (!stage) {
      return
    }

    const point = pointerInPage(stage)
    if (!point) {
      return
    }

    if (activeTool === 'select') {
      if (event.target === stage) {
        selectObject(null)
        selectPdfText(null)
      }
      return
    }

    event.evt.preventDefault()

    if (activeTool === 'addText') {
      const object = createTextObject(pageInfo.pageIndex, point.x, point.y)
      addObject(object)
      selectObject(object.id)
      return
    }

    if (activeTool === 'redact' || activeTool === 'highlight') {
      setDraft({
        kind: activeTool === 'redact' ? 'redaction' : 'highlight',
        start: point,
        rect: { x: point.x, y: point.y, width: 0, height: 0 },
      })
      return
    }

    setDraft({
      kind: 'drawing',
      origin: point,
      points: [0, 0],
    })
  }

  const handlePointerMove = (event: KonvaEventObject<PointerEvent>) => {
    const currentDraft = draftRef.current
    const stage = event.target.getStage()
    if (!currentDraft || !stage) {
      return
    }

    const point = pointerInPage(stage)
    if (!point) {
      return
    }

    event.evt.preventDefault()
    if (currentDraft.kind === 'drawing') {
      const relativeX = point.x - currentDraft.origin.x
      const relativeY = point.y - currentDraft.origin.y
      const points = currentDraft.points
      const lastX = points.at(-2) ?? 0
      const lastY = points.at(-1) ?? 0
      if (Math.hypot(relativeX - lastX, relativeY - lastY) < 0.6) {
        return
      }
      setDraft({
        ...currentDraft,
        points: [...points, relativeX, relativeY],
      })
      return
    }

    setDraft({
      ...currentDraft,
      rect: normalizeDraggedRect(currentDraft.start, point),
    })
  }

  const handlePointerUp = (event: KonvaEventObject<PointerEvent>) => {
    const currentDraft = draftRef.current
    if (!currentDraft) {
      return
    }
    event.evt.preventDefault()

    if (currentDraft.kind === 'drawing') {
      if (currentDraft.points.length >= 4) {
        const object = createDrawingObject(
          pageInfo.pageIndex,
          currentDraft.origin,
          currentDraft.points,
        )
        addObject(object)
        selectObject(object.id)
      }
    } else if (
      currentDraft.rect.width >= 3 &&
      currentDraft.rect.height >= 3
    ) {
      const object =
        currentDraft.kind === 'redaction'
          ? createRedactionObject(pageInfo.pageIndex, currentDraft.rect)
          : createHighlightObject(pageInfo.pageIndex, currentDraft.rect)
      addObject(object)
      selectObject(object.id)
    }

    setDraft(null)
  }

  const handleObjectClick = (
    event: KonvaEventObject<Event>,
    objectId: string,
  ) => {
    stopEvent(event)
    if (activeTool === 'select') {
      selectObject(objectId)
      setSelectedPage(pageInfo.pageIndex)
    }
  }

  const makePDFTextMovable = (
    event: KonvaEventObject<MouseEvent>,
    item: PDFPageInfo['textItems'][number],
  ) => {
    stopEvent(event)
    const existing = pageObjects.find(
      (object): object is EditorTextObject =>
        object.type === 'text' &&
        object.source === 'replacement' &&
        object.replacementFor?.textItemId === item.id,
    )

    if (existing) {
      selectObject(existing.id)
      setSelectedPage(pageInfo.pageIndex)
      return
    }

    const movableText = createReplacementObject(item, item.text, 'original')
    addObject(movableText)
    selectObject(movableText.id)
    setSelectedPage(pageInfo.pageIndex)
  }

  const dragBound = (position: { x: number; y: number }) => ({
    x: clamp(position.x, 0, pageInfo.width),
    y: clamp(position.y, 0, pageInfo.height),
  })

  const handleDragEnd = (
    object: EditorObject,
    event: KonvaEventObject<DragEvent>,
  ) => {
    updateObject(object.id, {
      x: event.target.x(),
      y: event.target.y(),
    })
  }

  const handleTransformEnd = (
    object: EditorObject,
    event: KonvaEventObject<Event>,
  ) => {
    const node = event.target

    if (object.type === 'drawing') {
      updateObject(object.id, {
        x: node.x(),
        y: node.y(),
        scaleX: Math.max(0.05, Math.abs(node.scaleX())),
        scaleY: Math.max(0.05, Math.abs(node.scaleY())),
        rotation: node.rotation(),
      })
      return
    }

    const scaleX = Math.max(0.05, Math.abs(node.scaleX()))
    const scaleY = Math.max(0.05, Math.abs(node.scaleY()))
    node.scale({ x: 1, y: 1 })
    const updates: Partial<EditorObject> = {
      x: node.x(),
      y: node.y(),
      width: Math.max(8, object.width * scaleX),
      height: Math.max(8, object.height * scaleY),
      rotation: node.rotation(),
    }

    if (object.type === 'text') {
      Object.assign(updates, {
        fontSize: Math.max(6, object.fontSize * scaleY),
      })
    }
    updateObject(object.id, updates)
  }

  const commonObjectProps = (object: EditorObject) => ({
    draggable: activeTool === 'select',
    dragBoundFunc: dragBound,
    onClick: (event: KonvaEventObject<MouseEvent>) =>
      handleObjectClick(event, object.id),
    onTap: (event: KonvaEventObject<TouchEvent>) =>
      handleObjectClick(event, object.id),
    onDragEnd: (event: KonvaEventObject<DragEvent>) =>
      handleDragEnd(object, event),
    onTransformEnd: (event: KonvaEventObject<Event>) =>
      handleTransformEnd(object, event),
  })

  const renderTextObject = (object: EditorTextObject) => {
    const font = previewTextFont(object.fontChoice, object.fontName)
    return (
      <Group
        key={object.id}
        ref={(node) => registerNode(object.id, node)}
        x={object.x}
        y={object.y}
        rotation={object.rotation}
        {...commonObjectProps(object)}
      >
        <Rect
          width={object.width}
          height={object.height}
          fill="rgba(255,255,255,0.001)"
          stroke={selectedObjectId === object.id ? '#175cd3' : undefined}
          strokeWidth={1}
          strokeScaleEnabled={false}
        />
        <Text
          text={object.text}
          width={object.width}
          height={object.height}
          fontFamily={font.family}
          fontStyle={font.style}
          fontSize={object.fontSize}
          fill={object.color}
          wrap="word"
        />
      </Group>
    )
  }

  const renderRedaction = (object: RedactionObject) => (
    <Rect
      key={object.id}
      ref={(node) => registerNode(object.id, node)}
      x={object.x}
      y={object.y}
      width={object.width}
      height={object.height}
      rotation={object.rotation}
      fill="rgba(18,24,36,0.72)"
      stroke={selectedObjectId === object.id ? '#175cd3' : '#303846'}
      strokeWidth={1}
      strokeScaleEnabled={false}
      {...commonObjectProps(object)}
    />
  )

  const renderHighlight = (object: HighlightObject) => (
    <Rect
      key={object.id}
      ref={(node) => registerNode(object.id, node)}
      x={object.x}
      y={object.y}
      width={object.width}
      height={object.height}
      rotation={object.rotation}
      fill="rgba(246,210,70,0.44)"
      stroke={selectedObjectId === object.id ? '#175cd3' : '#c59100'}
      strokeWidth={1}
      strokeScaleEnabled={false}
      {...commonObjectProps(object)}
    />
  )

  const renderDrawing = (object: DrawingObject) => (
    <Line
      key={object.id}
      ref={(node) => registerNode(object.id, node)}
      x={object.x}
      y={object.y}
      points={object.points}
      scaleX={object.scaleX}
      scaleY={object.scaleY}
      rotation={object.rotation}
      stroke={object.color}
      strokeWidth={object.width}
      lineCap="round"
      lineJoin="round"
      hitStrokeWidth={12}
      {...commonObjectProps(object)}
    />
  )

  return (
    <Stage
      ref={stageRef}
      className="editor-layer"
      role="application"
      tabIndex={0}
      title={`Interaction layer for PDF page ${pageInfo.pageIndex + 1}`}
      width={pageInfo.width * zoom}
      height={pageInfo.height * zoom}
      style={{ cursor: CURSORS[activeTool] }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <Layer scaleX={zoom} scaleY={zoom}>
        {selectableTextItems.map((item) => {
          const isSelected = selectedPdfText?.id === item.id
          const isHovered = hoveredTextId === item.id
          return (
            <Rect
              key={item.id}
              x={item.x}
              y={item.y}
              width={Math.max(item.width, 1)}
              height={Math.max(item.height, 1)}
              fill={isSelected ? 'rgba(23,92,211,0.16)' : 'rgba(0,0,0,0.001)'}
              stroke={isSelected || isHovered ? '#175cd3' : undefined}
              strokeWidth={1}
              strokeScaleEnabled={false}
              listening={activeTool === 'select'}
              onMouseEnter={() => setHoveredTextId(item.id)}
              onMouseLeave={() => setHoveredTextId(null)}
              onClick={(event) => {
                stopEvent(event)
                selectPdfText(item)
                setSelectedPage(pageInfo.pageIndex)
              }}
              onDblClick={(event) => {
                makePDFTextMovable(event, item)
              }}
              onTap={(event) => {
                stopEvent(event)
                selectPdfText(item)
                setSelectedPage(pageInfo.pageIndex)
              }}
            />
          )
        })}

        {pageObjects
          .filter(
            (object): object is EditorTextObject =>
              object.type === 'text' &&
              object.source === 'replacement' &&
              Boolean(object.replacementFor),
          )
          .map((object) => {
            const replacementFor = object.replacementFor
            if (!replacementFor) {
              return null
            }
            const maskBounds = safeReplacementBounds(
              replacementFor.bounds,
              replacementFor.textItemIds ?? replacementFor.textItemId,
              pageInfo.textItems,
            )
            return (
              <Rect
                key={`mask:${object.id}`}
                x={maskBounds.x}
                y={maskBounds.y}
                width={maskBounds.width}
                height={maskBounds.height}
                fill="#fefefe"
                listening={false}
              />
            )
          })}

        {pageObjects.map((object) => {
          switch (object.type) {
            case 'text':
              return renderTextObject(object)
            case 'redaction':
              return renderRedaction(object)
            case 'highlight':
              return renderHighlight(object)
            case 'drawing':
              return renderDrawing(object)
          }
        })}

        {draft?.kind === 'redaction' ? (
          <Rect
            x={draft.rect.x}
            y={draft.rect.y}
            width={draft.rect.width}
            height={draft.rect.height}
            fill="rgba(18,24,36,0.72)"
            stroke="#175cd3"
            strokeWidth={1}
            strokeScaleEnabled={false}
            listening={false}
          />
        ) : null}
        {draft?.kind === 'highlight' ? (
          <Rect
            x={draft.rect.x}
            y={draft.rect.y}
            width={draft.rect.width}
            height={draft.rect.height}
            fill="rgba(246,210,70,0.44)"
            stroke="#c59100"
            strokeWidth={1}
            strokeScaleEnabled={false}
            listening={false}
          />
        ) : null}
        {draft?.kind === 'drawing' ? (
          <Line
            x={draft.origin.x}
            y={draft.origin.y}
            points={draft.points}
            stroke="#175cd3"
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        ) : null}

        <Transformer
          ref={transformerRef}
          rotateEnabled
          borderStroke="#175cd3"
          anchorFill="#fefefe"
          anchorStroke="#175cd3"
          anchorSize={8}
          borderStrokeWidth={1}
          keepRatio={false}
          flipEnabled={false}
          boundBoxFunc={(oldBox, nextBox) =>
            nextBox.width < 8 || nextBox.height < 8 ? oldBox : nextBox
          }
        />
      </Layer>
    </Stage>
  )
}
