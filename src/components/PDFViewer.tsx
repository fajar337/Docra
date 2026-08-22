import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { FileUp, LoaderCircle } from 'lucide-react'
import type { PDFDocument } from 'mupdf'
import {
  distanceBetween,
  midpointBetween,
  zoomFromPinch,
  type GesturePoint,
} from '../pdf/pinchZoom'
import { useDocumentStore } from '../stores/documentStore'
import {
  normalizeZoom,
  ZOOM_STEP,
  useEditorStore,
} from '../stores/editorStore'
import { GlassSurface } from './ui/GlassSurface'

const PDFPage = lazy(() =>
  import('./PDFPage').then((module) => ({ default: module.PDFPage })),
)

interface PinchGesture {
  startDistance: number
  startZoom: number
  anchorFrame: HTMLElement | null
  anchorRatioX: number
  anchorRatioY: number
  anchorContentX: number
  anchorContentY: number
}

function touchPoint(touch: Touch): GesturePoint {
  return { x: touch.clientX, y: touch.clientY }
}

export function PDFViewer() {
  const viewerRef = useRef<HTMLElement>(null)
  const automaticZoomRef = useRef<{
    document: PDFDocument
    zoom: number
  } | null>(null)
  const pinchGestureRef = useRef<PinchGesture | null>(null)
  const pinchFrameRef = useRef<number | null>(null)
  const document = useDocumentStore((state) => state.pdfDocument)
  const pages = useDocumentStore((state) => state.pages)
  const isLoading = useDocumentStore((state) => state.isLoading)
  const zoom = useEditorStore((state) => state.zoom)

  useLayoutEffect(() => {
    const viewer = viewerRef.current
    const firstPage = pages[0]
    if (!viewer || !document || !firstPage) {
      automaticZoomRef.current = null
      return
    }

    const fitDocumentToViewer = () => {
      const automaticZoom = automaticZoomRef.current
      const currentZoom = useEditorStore.getState().zoom

      if (
        automaticZoom?.document === document &&
        Math.abs(currentZoom - automaticZoom.zoom) > 0.001
      ) {
        return
      }

      const style = window.getComputedStyle(viewer)
      const horizontalPadding =
        Number.parseFloat(style.paddingInlineStart) +
        Number.parseFloat(style.paddingInlineEnd)
      const availableWidth = Math.max(
        0,
        viewer.clientWidth - horizontalPadding - 2,
      )
      const nextZoom = normalizeZoom(
        Math.min(1, availableWidth / firstPage.width),
      )

      useEditorStore.getState().setZoom(nextZoom)
      automaticZoomRef.current = { document, zoom: nextZoom }
    }

    automaticZoomRef.current = null
    fitDocumentToViewer()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(fitDocumentToViewer)
    observer.observe(viewer)
    return () => observer.disconnect()
  }, [document, pages])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !document) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || event.deltaY === 0) {
        return
      }

      event.preventDefault()
      const { zoom: currentZoom, setZoom } = useEditorStore.getState()
      setZoom(currentZoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))
    }

    const startPinch = (event: TouchEvent) => {
      if (event.touches.length !== 2) {
        return
      }

      const first = touchPoint(event.touches[0])
      const second = touchPoint(event.touches[1])
      const midpoint = midpointBetween(first, second)
      const viewerBounds = viewer.getBoundingClientRect()
      const target = window.document.elementFromPoint(midpoint.x, midpoint.y)
      const anchorFrame =
        target instanceof Element
          ? target.closest<HTMLElement>('.pdf-page-frame')
          : null
      const frameBounds = anchorFrame?.getBoundingClientRect()

      pinchGestureRef.current = {
        startDistance: distanceBetween(first, second),
        startZoom: useEditorStore.getState().zoom,
        anchorFrame,
        anchorRatioX: frameBounds
          ? (midpoint.x - frameBounds.left) / Math.max(frameBounds.width, 1)
          : 0,
        anchorRatioY: frameBounds
          ? (midpoint.y - frameBounds.top) / Math.max(frameBounds.height, 1)
          : 0,
        anchorContentX: viewer.scrollLeft + midpoint.x - viewerBounds.left,
        anchorContentY: viewer.scrollTop + midpoint.y - viewerBounds.top,
      }
      event.preventDefault()
    }

    const movePinch = (event: TouchEvent) => {
      const gesture = pinchGestureRef.current
      if (!gesture || event.touches.length !== 2) {
        return
      }

      event.preventDefault()
      const first = touchPoint(event.touches[0])
      const second = touchPoint(event.touches[1])
      const midpoint = midpointBetween(first, second)
      const nextZoom = zoomFromPinch(
        gesture.startZoom,
        gesture.startDistance,
        distanceBetween(first, second),
      )
      useEditorStore.getState().setZoom(nextZoom)

      if (pinchFrameRef.current !== null) {
        window.cancelAnimationFrame(pinchFrameRef.current)
      }
      pinchFrameRef.current = window.requestAnimationFrame(() => {
        const anchorFrame = gesture.anchorFrame
        if (anchorFrame?.isConnected) {
          const frameBounds = anchorFrame.getBoundingClientRect()
          const anchorX = frameBounds.left + frameBounds.width * gesture.anchorRatioX
          const anchorY = frameBounds.top + frameBounds.height * gesture.anchorRatioY
          viewer.scrollLeft += anchorX - midpoint.x
          viewer.scrollTop += anchorY - midpoint.y
        } else {
          const viewerBounds = viewer.getBoundingClientRect()
          const scale = nextZoom / gesture.startZoom
          viewer.scrollLeft =
            gesture.anchorContentX * scale - (midpoint.x - viewerBounds.left)
          viewer.scrollTop =
            gesture.anchorContentY * scale - (midpoint.y - viewerBounds.top)
        }
        pinchFrameRef.current = null
      })
    }

    const endPinch = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        pinchGestureRef.current = null
      }
    }

    const preventNativePinch = (event: Event) => {
      event.preventDefault()
    }

    const touchListenerOptions: AddEventListenerOptions = {
      capture: true,
      passive: false,
    }

    viewer.addEventListener('wheel', handleWheel, { passive: false })
    viewer.addEventListener('touchstart', startPinch, touchListenerOptions)
    viewer.addEventListener('touchmove', movePinch, touchListenerOptions)
    viewer.addEventListener('touchend', endPinch, true)
    viewer.addEventListener('touchcancel', endPinch, true)
    viewer.addEventListener('gesturestart', preventNativePinch, {
      passive: false,
    })
    viewer.addEventListener('gesturechange', preventNativePinch, {
      passive: false,
    })

    return () => {
      viewer.removeEventListener('wheel', handleWheel)
      viewer.removeEventListener('touchstart', startPinch, true)
      viewer.removeEventListener('touchmove', movePinch, true)
      viewer.removeEventListener('touchend', endPinch, true)
      viewer.removeEventListener('touchcancel', endPinch, true)
      viewer.removeEventListener('gesturestart', preventNativePinch)
      viewer.removeEventListener('gesturechange', preventNativePinch)
      if (pinchFrameRef.current !== null) {
        window.cancelAnimationFrame(pinchFrameRef.current)
        pinchFrameRef.current = null
      }
      pinchGestureRef.current = null
    }
  }, [document])

  if (isLoading) {
    return (
      <main className="viewer viewer--empty" aria-live="polite">
        <GlassSurface level={2} className="empty-state">
          <span className="empty-state__mark" aria-hidden="true">
            <LoaderCircle className="loader" />
          </span>
          <div className="empty-state__copy">
            <h1>Membuka dokumen</h1>
            <p>MuPDF sedang menyiapkan halaman dan text layer di browser.</p>
          </div>
        </GlassSurface>
      </main>
    )
  }

  if (!document) {
    return (
      <main className="viewer viewer--empty">
        <GlassSurface level={2} className="empty-state">
          <span className="empty-state__mark" aria-hidden="true">
            <FileUp />
          </span>
          <div className="empty-state__copy">
            <h1>Docra</h1>
            <p>
              Buka PDF untuk mulai mengedit. Dokumen tetap diproses di perangkat
              ini dan tidak diunggah ke server.
            </p>
          </div>
          <span className="empty-state__hint">Gunakan Open PDF di toolbar</span>
        </GlassSurface>
      </main>
    )
  }

  return (
    <main ref={viewerRef} className="viewer" aria-label="PDF pages">
      <div className="viewer__pages">
        {pages.map((pageInfo) => (
          <Suspense key={pageInfo.pageIndex} fallback={null}>
            <PDFPage document={document} pageInfo={pageInfo} zoom={zoom} />
          </Suspense>
        ))}
      </div>
    </main>
  )
}
