import { beforeEach, expect, it } from 'vitest'
import { useEditorStore } from '../stores/editorStore'
import { useHistoryStore } from '../stores/historyStore'
import { useDocumentStore } from '../stores/documentStore'
import { pasteImage } from './imageClipboard'
import type { ImageObject } from '../types/editor'

beforeEach(() => {
  useHistoryStore.getState().reset()
  useEditorStore.setState({ imageClipboard: null, selectedPageIndex: 1 })
  useDocumentStore.setState({ pages: [0, 1].map((pageIndex) => ({ pageIndex, bounds: [0, 0, 300, 200], width: 300, height: 200, textItems: [] })) })
})

it('pastes an independent copy on the selected page and supports undo/redo', () => {
  const source: ImageObject = {
    id: 'image:source', type: 'image', pageIndex: 0, x: 20, y: 30, width: 80, height: 40,
    rotation: 37, dataUrl: 'data:image/png;base64,cropped-image', name: 'photo.png',
  }
  useHistoryStore.getState().addObject(source)
  useEditorStore.getState().copyImage(source)
  useHistoryStore.getState().updateObject(source.id, { rotation: 90 })
  pasteImage()
  const pasted = useHistoryStore.getState().present[1]
  expect(pasted).toMatchObject({ ...source, id: expect.any(String), pageIndex: 1, x: 36, y: 46 })
  expect(pasted.id).not.toBe(source.id)
  expect(useEditorStore.getState().selectedObjectId).toBe(pasted.id)
  useHistoryStore.getState().undo()
  expect(useHistoryStore.getState().present).toHaveLength(1)
  useHistoryStore.getState().redo()
  expect(useHistoryStore.getState().present[1]).toEqual(pasted)
})
