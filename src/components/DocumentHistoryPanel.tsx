import { useCallback, useEffect, useState } from 'react'
import { listDocumentHistory, type SavedDocument } from '../pdf/documentHistory'

export function DocumentHistoryPanel({ onOpen }: { onOpen: (entry: SavedDocument) => Promise<void> }) {
  const [entries, setEntries] = useState<SavedDocument[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const refresh = useCallback(() => {
    void listDocumentHistory().then(setEntries).catch(() => setEntries([]))
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener('docra-history-change', refresh)
    return () => window.removeEventListener('docra-history-change', refresh)
  }, [refresh])

  const openEntry = async (entry: SavedDocument) => {
    setLoadingId(entry.id)
    try {
      await onOpen(entry)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <section className="side-panel__section" aria-labelledby="document-history-title">
      <h2 id="document-history-title">Riwayat dokumen</h2>
      {entries.length === 0 ? (
        <p className="empty-copy">Dokumen yang dibuka akan tersimpan otomatis di perangkat ini.</p>
      ) : (
        <ul className="document-history-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button type="button" disabled={loadingId !== null} onClick={() => void openEntry(entry)}>
                <strong>{entry.fileName}</strong>
                <span>{new Date(entry.savedAt).toLocaleString()}</span>
                <span>{loadingId === entry.id ? 'Membuka…' : `${entry.objects.length} perubahan tersimpan`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
