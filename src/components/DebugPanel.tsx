import { useDocumentStore } from '../stores/documentStore'
import { useEditorStore } from '../stores/editorStore'
import { useHistoryStore } from '../stores/historyStore'

function formatNumber(value: number | undefined): string {
  return value === undefined ? '—' : value.toFixed(2)
}

export function DebugPanel() {
  const pageCount = useDocumentStore((state) => state.pageCount)
  const isLoaded = useDocumentStore((state) => Boolean(state.pdfDocument))
  const activeTool = useEditorStore((state) => state.activeTool)
  const zoom = useEditorStore((state) => state.zoom)
  const selectedPageIndex = useEditorStore((state) => state.selectedPageIndex)
  const selectedPdfText = useEditorStore((state) => state.selectedPdfText)
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId)
  const objects = useHistoryStore((state) => state.present)
  const selectedObject = objects.find(
    (object) => object.id === selectedObjectId,
  )

  return (
    <section className="side-panel__section debug-panel" aria-labelledby="debug-title">
      <h2 id="debug-title">Debug</h2>
      <dl className="debug-list">
        <div>
          <dt>PDF loaded</dt>
          <dd>{isLoaded ? 'yes' : 'no'}</dd>
        </div>
        <div>
          <dt>Pages</dt>
          <dd>{pageCount}</dd>
        </div>
        <div>
          <dt>Selected page</dt>
          <dd>{selectedPageIndex === null ? '—' : selectedPageIndex + 1}</dd>
        </div>
        <div>
          <dt>Tool</dt>
          <dd>{activeTool}</dd>
        </div>
        <div>
          <dt>Zoom</dt>
          <dd>{Math.round(zoom * 100)}%</dd>
        </div>
        <div>
          <dt>Objects</dt>
          <dd>{objects.length}</dd>
        </div>
        <div>
          <dt>Selected object</dt>
          <dd>{selectedObject?.type ?? '—'}</dd>
        </div>
      </dl>

      <div className="debug-selection">
        <h3>Selected PDF text</h3>
        <p>{selectedPdfText ? `“${selectedPdfText.text}”` : '—'}</p>
        <pre>
          {selectedPdfText
            ? [
                `x: ${formatNumber(selectedPdfText.x)}`,
                `y: ${formatNumber(selectedPdfText.y)}`,
                `w: ${formatNumber(selectedPdfText.width)}`,
                `h: ${formatNumber(selectedPdfText.height)}`,
                `font: ${selectedPdfText.fontName ?? 'unknown'}`,
                `size: ${formatNumber(selectedPdfText.fontSize)}`,
              ].join('\n')
            : 'No text selected'}
        </pre>
      </div>
    </section>
  )
}
