import { useEffect, useRef, useState } from 'react'
import type { PDFDocument } from 'mupdf'
import { renderPDFPage } from '../pdf/renderer'
import { schedulePDFRender } from '../pdf/renderScheduler'
import { useDocumentStore } from '../stores/documentStore'
import { useEditorStore } from '../stores/editorStore'
import type { PDFPageInfo } from '../types/pdf'
import { EditorLayer } from './EditorLayer'

interface PDFPageProps {
  document: PDFDocument
  pageInfo: PDFPageInfo
  zoom: number
}

const RASTER_ZOOM_DEBOUNCE_MS = 140
const PAGE_PRELOAD_MARGIN = '900px 0px'

export function PDFPage({ document, pageInfo, zoom }: PDFPageProps) {
  const pageRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskKey = useRef(Symbol(`pdf-page-${pageInfo.pageIndex}`))
  const [isNearViewport, setIsNearViewport] = useState(false)
  const [rasterZoom, setRasterZoom] = useState(zoom)
  const [renderedZoom, setRenderedZoom] = useState<number | null>(null)
  const setSelectedPage = useEditorStore((state) => state.setSelectedPage)
  const setGlobalError = useDocumentStore((state) => state.setError)

  useEffect(() => {
    const page = pageRef.current
    if (!page || typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      {
        root: null,
        rootMargin: PAGE_PRELOAD_MARGIN,
      },
    )

    observer.observe(page)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setRasterZoom(zoom),
      RASTER_ZOOM_DEBOUNCE_MS,
    )

    return () => window.clearTimeout(timeoutId)
  }, [zoom])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isNearViewport) {
      return
    }

    let isDisposed = false
    const cancelRender = schedulePDFRender(renderTaskKey.current, () => {
      if (isDisposed) {
        return
      }

      try {
        renderPDFPage(document, pageInfo.pageIndex, rasterZoom, canvas)
        if (!isDisposed) {
          setRenderedZoom(rasterZoom)
        }
      } catch (error) {
        console.error(error)
        const message = `Page ${pageInfo.pageIndex + 1} gagal dirender.`
        setGlobalError(message)
      }
    })

    return () => {
      isDisposed = true
      cancelRender()
    }
  }, [document, isNearViewport, pageInfo.pageIndex, rasterZoom, setGlobalError])

  const width = pageInfo.width * zoom
  const height = pageInfo.height * zoom

  return (
    <section
      ref={pageRef}
      className="pdf-page-card"
      aria-label={`Page ${pageInfo.pageIndex + 1}`}
      onPointerDown={() => setSelectedPage(pageInfo.pageIndex)}
    >
      <div className="pdf-page-card__header">
        <strong>Page {pageInfo.pageIndex + 1}</strong>
        <span>
          {Math.round(pageInfo.width)} × {Math.round(pageInfo.height)} pt ·{' '}
          {pageInfo.textItems.length} text items
        </span>
      </div>
      <div
        className="pdf-page-frame"
        style={{ width, height }}
        aria-busy={renderedZoom !== zoom}
        data-render-state={renderedZoom === zoom ? 'ready' : 'preview'}
      >
        <canvas
          ref={canvasRef}
          className="pdf-page-canvas"
          aria-label={`Rendered PDF page ${pageInfo.pageIndex + 1}`}
        />
        {isNearViewport ? (
          <div
            className="editor-layer-preview"
            style={{
              width: pageInfo.width * rasterZoom,
              height: pageInfo.height * rasterZoom,
              transform: `scale(${zoom / rasterZoom})`,
            }}
          >
            <EditorLayer pageInfo={pageInfo} zoom={rasterZoom} />
          </div>
        ) : null}
      </div>
    </section>
  )
}
