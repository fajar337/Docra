import { useEffect } from 'react'
import { Layers3, ShieldCheck } from 'lucide-react'
import { useDocumentStore } from '../stores/documentStore'
import { useEditorStore } from '../stores/editorStore'
import { useHistoryStore } from '../stores/historyStore'
import { DebugPanel } from './DebugPanel'
import { InspectorPanel } from './InspectorPanel'
import { PDFViewer } from './PDFViewer'
import { Toolbar } from './Toolbar'
import { GlassSurface } from './ui/GlassSurface'
import '../styles/editor.css'

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

export function PDFEditor() {
  const pdfDocument = useDocumentStore((state) => state.pdfDocument)
  const originalBytes = useDocumentStore((state) => state.originalPdfBytes)
  const pages = useDocumentStore((state) => state.pages)
  const fileName = useDocumentStore((state) => state.fileName)
  const isLoading = useDocumentStore((state) => state.isLoading)
  const isExporting = useDocumentStore((state) => state.isExporting)
  const error = useDocumentStore((state) => state.error)
  const openBytes = useDocumentStore((state) => state.openBytes)
  const setExportState = useDocumentStore((state) => state.setExportState)
  const setLastExport = useDocumentStore((state) => state.setLastExport)
  const setError = useDocumentStore((state) => state.setError)

  const objects = useHistoryStore((state) => state.present)
  const canUndo = useHistoryStore((state) => state.canUndo)
  const canRedo = useHistoryStore((state) => state.canRedo)
  const undo = useHistoryStore((state) => state.undo)
  const redo = useHistoryStore((state) => state.redo)
  const resetHistory = useHistoryStore((state) => state.reset)
  const deleteObject = useHistoryStore((state) => state.deleteObject)

  const selectedObjectId = useEditorStore((state) => state.selectedObjectId)
  const selectObject = useEditorStore((state) => state.selectObject)
  const resetSelection = useEditorStore((state) => state.resetSelection)

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (isEditingTarget(event.target)) {
        return
      }

      const modifier = event.ctrlKey || event.metaKey
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        return
      }

      if (
        selectedObjectId &&
        (event.key === 'Delete' || event.key === 'Backspace')
      ) {
        event.preventDefault()
        deleteObject(selectedObjectId)
        selectObject(null)
      }
    }

    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [deleteObject, redo, selectObject, selectedObjectId, undo])

  const handleOpen = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      await openBytes(bytes, file.name)
      resetHistory()
      resetSelection()
    } catch {
      // documentStore already exposes a visible and logged error.
    }
  }

  const createExport = async (reopen: boolean) => {
    if (!originalBytes) {
      setError('Buka PDF sebelum melakukan export.')
      return
    }

    setExportState(true)
    setError(null)
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))

    try {
      const { downloadPDF, exportPDF } = await import('../pdf/exporter')
      const bytes = exportPDF(originalBytes, objects, pages)
      setLastExport(bytes)
      const exportFileName = fileName?.trim() || 'edited.pdf'

      if (reopen) {
        await openBytes(bytes, exportFileName)
        resetHistory()
        resetSelection()
      } else {
        downloadPDF(bytes, exportFileName)
      }
    } catch (exportError) {
      console.error(exportError)
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'Export gagal karena error yang tidak dikenali.',
      )
    } finally {
      setExportState(false)
    }
  }

  return (
    <div className="pdf-editor">
      <Toolbar
        hasDocument={Boolean(pdfDocument)}
        fileName={fileName}
        isLoading={isLoading}
        isExporting={isExporting}
        canUndo={canUndo}
        canRedo={canRedo}
        onOpen={handleOpen}
        onExport={() => createExport(false)}
        onTestExport={() => createExport(true)}
        onUndo={undo}
        onRedo={redo}
      />

      {error ? (
        <GlassSurface level={3} className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </GlassSurface>
      ) : null}

      <div className="workbench">
        <PDFViewer />
        <GlassSurface
          as="aside"
          level={2}
          className="side-panel"
          aria-label="Inspector and debug information"
        >
          <InspectorPanel />
          <DebugPanel />
        </GlassSurface>
      </div>

      <GlassSurface as="footer" level={1} className="status-bar">
        <span className="status-bar__item">
          <ShieldCheck aria-hidden="true" />
          On-device
        </span>
        <span className="status-bar__item">
          <Layers3 aria-hidden="true" />
          {objects.length} editor objects
        </span>
      </GlassSurface>
    </div>
  )
}
