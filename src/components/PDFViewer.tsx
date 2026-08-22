import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { FileUp, LoaderCircle } from 'lucide-react'
import type { PDFDocument } from 'mupdf'
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

export function PDFViewer() {
  const viewerRef = useRef<HTMLElement>(null)
  const automaticZoomRef = useRef<{
    document: PDFDocument
    zoom: number
  } | null>(null)
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

    viewer.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewer.removeEventListener('wheel', handleWheel)
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
