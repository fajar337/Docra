import {
  Download,
  FileCheck2,
  FilePenLine,
  FolderOpen,
  Highlighter,
  LoaderCircle,
  MousePointer2,
  Pencil,
  Redo2,
  ScanLine,
  Type as TypeIcon,
  Undo2,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeZoom,
  ZOOM_STEP,
  useEditorStore,
} from '../stores/editorStore'
import type { EditorTool } from '../types/editor'
import { ThemeToggle } from './ThemeToggle'
import { GlassSurface } from './ui/GlassSurface'

const TOOL_ITEMS: Record<EditorTool, { label: string; Icon: LucideIcon }> = {
  select: { label: 'Select / Edit', Icon: MousePointer2 },
  addText: { label: 'Add Text', Icon: TypeIcon },
  redact: { label: 'Redact', Icon: ScanLine },
  highlight: { label: 'Highlight', Icon: Highlighter },
  draw: { label: 'Draw', Icon: Pencil },
}

interface ToolbarProps {
  hasDocument: boolean
  fileName: string | null
  isLoading: boolean
  isExporting: boolean
  canUndo: boolean
  canRedo: boolean
  onOpen: (file: File) => Promise<void>
  onExport: () => Promise<void>
  onTestExport: () => Promise<void>
  onUndo: () => void
  onRedo: () => void
}

export function Toolbar({
  hasDocument,
  fileName,
  isLoading,
  isExporting,
  canUndo,
  canRedo,
  onOpen,
  onExport,
  onTestExport,
  onUndo,
  onRedo,
}: ToolbarProps) {
  const activeTool = useEditorStore((state) => state.activeTool)
  const setActiveTool = useEditorStore((state) => state.setActiveTool)
  const zoom = useEditorStore((state) => state.zoom)
  const setZoom = useEditorStore((state) => state.setZoom)
  const [zoomDraft, setZoomDraft] = useState<string | null>(null)
  const liquidFrame = useRef<number | null>(null)
  const dragScrollRef = useRef<{
    element: HTMLDivElement
    pointerId: number
    startX: number
    startScrollLeft: number
    moved: boolean
  } | null>(null)
  const suppressRailClickRef = useRef(false)
  const railClickResetTimerRef = useRef<number | null>(null)
  const pendingLiquidPoint = useRef<{
    element: HTMLElement
    clientX: number
    clientY: number
  } | null>(null)
  const zoomInput = zoomDraft ?? String(Math.round(zoom * 100))

  useEffect(
    () => () => {
      if (liquidFrame.current !== null) {
        window.cancelAnimationFrame(liquidFrame.current)
      }
      if (railClickResetTimerRef.current !== null) {
        window.clearTimeout(railClickResetTimerRef.current)
      }
    },
    [],
  )

  const moveLiquidLight = (
    element: HTMLElement,
    clientX: number,
    clientY: number,
  ) => {
    pendingLiquidPoint.current = { element, clientX, clientY }
    element.dataset.liquidActive = 'true'

    if (liquidFrame.current !== null) {
      return
    }

    liquidFrame.current = window.requestAnimationFrame(() => {
      const point = pendingLiquidPoint.current
      liquidFrame.current = null
      if (!point) {
        return
      }

      const bounds = point.element.getBoundingClientRect()
      point.element.style.setProperty(
        '--toolbar-light-x',
        `${point.clientX - bounds.left}px`,
      )
      point.element.style.setProperty(
        '--toolbar-light-y',
        `${point.clientY - bounds.top}px`,
      )
    })
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') {
      return
    }
    moveLiquidLight(event.currentTarget, event.clientX, event.clientY)
  }

  const handlePointerLeave = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.dataset.liquidActive = 'false'
    event.currentTarget.dataset.liquidPressed = 'false'
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') {
      return
    }
    event.currentTarget.dataset.liquidPressed = 'true'
    moveLiquidLight(event.currentTarget, event.clientX, event.clientY)
  }

  const handlePointerRelease = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.dataset.liquidPressed = 'false'
  }

  const handleFocus = (event: ReactFocusEvent<HTMLElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    const bounds = target.getBoundingClientRect()
    moveLiquidLight(
      event.currentTarget,
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
    )
  }

  const handleBlur = (event: ReactFocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      event.currentTarget.dataset.liquidActive = 'false'
    }
  }

  const handleRailPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) {
      return
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.closest('input, textarea')
    ) {
      return
    }

    dragScrollRef.current = {
      element: event.currentTarget,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      moved: false,
    }
  }

  const handleRailPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = dragScrollRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - drag.startX
    if (!drag.moved && Math.abs(deltaX) < 5) {
      return
    }

    if (!drag.moved) {
      drag.element.setPointerCapture(event.pointerId)
    }
    drag.moved = true
    suppressRailClickRef.current = true
    drag.element.dataset.dragging = 'true'
    drag.element.scrollLeft = drag.startScrollLeft - deltaX
    event.preventDefault()
  }

  const finishRailDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragScrollRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    drag.element.dataset.dragging = 'false'
    if (drag.element.hasPointerCapture(event.pointerId)) {
      drag.element.releasePointerCapture(event.pointerId)
    }
    dragScrollRef.current = null

    if (railClickResetTimerRef.current !== null) {
      window.clearTimeout(railClickResetTimerRef.current)
    }
    railClickResetTimerRef.current = window.setTimeout(() => {
      suppressRailClickRef.current = false
      railClickResetTimerRef.current = null
    }, 0)
  }

  const handleRailClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressRailClickRef.current) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    suppressRailClickRef.current = false
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) {
      await onOpen(file)
    }
  }

  const commitZoomInput = () => {
    const percentage = Number.parseFloat(zoomInput)
    const nextZoom = normalizeZoom(percentage / 100)
    setZoom(nextZoom)
    setZoomDraft(null)
  }

  const handleZoomKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commitZoomInput()
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      setZoomDraft(null)
      event.currentTarget.blur()
    }
  }

  return (
    <GlassSurface
      as="header"
      level={1}
      className="toolbar"
      aria-label="Toolbar editor PDF"
      data-liquid-active="false"
      data-liquid-pressed="false"
      onPointerEnter={handlePointerMove}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
    >
      <span className="toolbar__liquid-light" aria-hidden="true" />
      <div className="toolbar__identity">
        <small className="toolbar__credit">Crafted by Fajar Mustofa</small>
        <button
          type="button"
          className="toolbar__brand-button"
          aria-label="Refresh Docra"
          title="Refresh Docra"
          onClick={() => window.location.reload()}
        >
          <span className="toolbar__brand-mark" aria-hidden="true">
            <FilePenLine />
          </span>
          <span className="toolbar__identity-copy">
            <strong>Docra</strong>
            <span title={fileName ?? 'Docra'}>{fileName ?? 'Docra'}</span>
          </span>
        </button>
      </div>

      <div
        className="toolbar__row"
        data-dragging="false"
        onPointerDown={handleRailPointerDown}
        onPointerMove={handleRailPointerMove}
        onPointerUp={finishRailDrag}
        onPointerCancel={finishRailDrag}
        onClickCapture={handleRailClickCapture}
      >
        <div className="toolbar__group toolbar__group--document">
          <label
            className="file-button toolbar__primary"
            aria-disabled={isLoading}
            tabIndex={isLoading ? -1 : 0}
          >
            {isLoading ? (
              <LoaderCircle className="button__icon button__icon--spin" aria-hidden="true" />
            ) : (
              <FolderOpen className="button__icon" aria-hidden="true" />
            )}
            <span>{isLoading ? 'Opening…' : 'Open PDF'}</span>
            <input
              className="visually-hidden"
              type="file"
              accept="application/pdf,.pdf"
              disabled={isLoading}
              onChange={(event) => void handleFile(event)}
            />
          </label>
          <button
            type="button"
            className="toolbar__primary"
            disabled={!hasDocument || isExporting}
            data-state={isExporting ? 'loading' : undefined}
            onClick={() => void onExport()}
          >
            {isExporting ? (
              <LoaderCircle className="button__icon button__icon--spin" aria-hidden="true" />
            ) : (
              <Download className="button__icon" aria-hidden="true" />
            )}
            <span>{isExporting ? 'Exporting…' : 'Export PDF'}</span>
          </button>
          <button
            type="button"
            aria-label="Test Export"
            disabled={!hasDocument || isExporting}
            onClick={() => void onTestExport()}
          >
            <FileCheck2 className="button__icon" aria-hidden="true" />
            <span className="toolbar__optional-copy">Test Export</span>
          </button>
        </div>

        <div className="toolbar__group toolbar__group--history">
          <button
            type="button"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 className="button__icon" aria-hidden="true" />
            <span className="toolbar__button-copy">Undo</span>
          </button>
          <button
            type="button"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <Redo2 className="button__icon" aria-hidden="true" />
            <span className="toolbar__button-copy">Redo</span>
          </button>
        </div>

        <div className="zoom-control" role="group" aria-label="Document zoom">
          <button
            type="button"
            className="zoom-control__button"
            aria-label="Zoom out"
            disabled={!hasDocument || zoom <= MIN_ZOOM}
            onClick={() => {
              setZoomDraft(null)
              setZoom(zoom - ZOOM_STEP)
            }}
          >
            <ZoomOut className="button__icon" aria-hidden="true" />
          </button>
          <label className="zoom-control__value">
            <span className="visually-hidden">Zoom</span>
            <input
              type="number"
              aria-label="Zoom"
              inputMode="numeric"
              min={MIN_ZOOM * 100}
              max={MAX_ZOOM * 100}
              step="1"
              value={zoomInput}
              disabled={!hasDocument}
              onChange={(event) => setZoomDraft(event.target.value)}
              onBlur={commitZoomInput}
              onKeyDown={handleZoomKeyDown}
            />
            <span aria-hidden="true">%</span>
          </label>
          <button
            type="button"
            className="zoom-control__button"
            aria-label="Zoom in"
            disabled={!hasDocument || zoom >= MAX_ZOOM}
            onClick={() => {
              setZoomDraft(null)
              setZoom(zoom + ZOOM_STEP)
            }}
          >
            <ZoomIn className="button__icon" aria-hidden="true" />
          </button>
        </div>

        <ThemeToggle />
      </div>

      <nav className="tool-strip" aria-label="Alat edit PDF">
        <span className="tool-strip__label" aria-hidden="true">
          Tools
        </span>
        <div
          className="tool-strip__rail"
          data-dragging="false"
          onPointerDown={handleRailPointerDown}
          onPointerMove={handleRailPointerMove}
          onPointerUp={finishRailDrag}
          onPointerCancel={finishRailDrag}
          onClickCapture={handleRailClickCapture}
        >
          {Object.entries(TOOL_ITEMS).map(([tool, { label, Icon }]) => (
            <button
              key={tool}
              type="button"
              className="tool-strip__button"
              aria-label={label}
              aria-pressed={activeTool === tool}
              disabled={!hasDocument}
              onClick={() => setActiveTool(tool as EditorTool)}
            >
              <Icon className="button__icon" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </GlassSurface>
  )
}
