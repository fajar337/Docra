import type { PDFDocument } from 'mupdf'
import { create } from 'zustand'
import { loadPDF } from '../pdf/loader'
import { initializeMuPDF } from '../pdf/mupdf'
import type { PDFPageInfo } from '../types/pdf'

interface DocumentState {
  pdfDocument: PDFDocument | null
  originalPdfBytes: Uint8Array | null
  lastExportBytes: Uint8Array | null
  fileName: string | null
  pageCount: number
  pages: PDFPageInfo[]
  isLoading: boolean
  isExporting: boolean
  error: string | null
  openBytes: (bytes: Uint8Array, fileName: string) => Promise<void>
  setExportState: (isExporting: boolean) => void
  setLastExport: (bytes: Uint8Array) => void
  setError: (error: string | null) => void
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  pdfDocument: null,
  originalPdfBytes: null,
  lastExportBytes: null,
  fileName: null,
  pageCount: 0,
  pages: [],
  isLoading: false,
  isExporting: false,
  error: null,

  openBytes: async (bytes, fileName) => {
    set({ isLoading: true, error: null })
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))

    try {
      await initializeMuPDF()
      const loaded = loadPDF(bytes)
      const previousDocument = get().pdfDocument
      set({
        pdfDocument: loaded.document,
        originalPdfBytes: loaded.bytes,
        lastExportBytes: null,
        fileName,
        pageCount: loaded.pageCount,
        pages: loaded.pages,
        isLoading: false,
        error: null,
      })
      previousDocument?.destroy()
    } catch (error) {
      console.error(error)
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'PDF tidak dapat dibuka karena error yang tidak dikenali.',
      })
      throw error
    }
  },

  setExportState: (isExporting) => set({ isExporting }),
  setLastExport: (lastExportBytes) => set({ lastExportBytes }),
  setError: (error) => set({ error }),
}))
