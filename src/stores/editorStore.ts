import { create } from 'zustand'
import type { EditorTool } from '../types/editor'
import type { PDFTextItem } from '../types/pdf'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2
export const ZOOM_STEP = 0.01

export function normalizeZoom(zoom: number): number {
  const finiteZoom = Number.isFinite(zoom) ? zoom : 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(finiteZoom * 100) / 100))
}

interface EditorState {
  activeTool: EditorTool
  selectedObjectId: string | null
  selectedPdfText: PDFTextItem | null
  selectedPageIndex: number | null
  zoom: number
  setActiveTool: (tool: EditorTool) => void
  selectObject: (objectId: string | null) => void
  selectPdfText: (item: PDFTextItem | null) => void
  setSelectedPage: (pageIndex: number | null) => void
  setZoom: (zoom: number) => void
  resetSelection: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTool: 'select',
  selectedObjectId: null,
  selectedPdfText: null,
  selectedPageIndex: null,
  zoom: 1,

  setActiveTool: (activeTool) =>
    set({ activeTool, selectedPdfText: null, selectedObjectId: null }),
  selectObject: (selectedObjectId) =>
    set({ selectedObjectId, selectedPdfText: null }),
  selectPdfText: (selectedPdfText) =>
    set({ selectedPdfText, selectedObjectId: null }),
  setSelectedPage: (selectedPageIndex) => set({ selectedPageIndex }),
  setZoom: (zoom) => set({ zoom: normalizeZoom(zoom) }),
  resetSelection: () =>
    set({
      selectedObjectId: null,
      selectedPdfText: null,
      selectedPageIndex: null,
    }),
}))
