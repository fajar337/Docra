import { useDocumentStore } from '../stores/documentStore'
import { useEditorStore } from '../stores/editorStore'
import { useHistoryStore } from '../stores/historyStore'

export function pasteImage(): void {
  const editor = useEditorStore.getState()
  const source = editor.imageClipboard
  const pages = useDocumentStore.getState().pages
  const page = pages.find((item) => item.pageIndex === editor.selectedPageIndex) ?? pages[0]
  if (!source || !page) return
  const image = {
    ...source,
    id: `image:${crypto.randomUUID()}`,
    pageIndex: page.pageIndex,
    x: Math.max(0, Math.min(source.x + 16, page.width - source.width)),
    y: Math.max(0, Math.min(source.y + 16, page.height - source.height)),
  }
  useHistoryStore.getState().addObject(image)
  editor.setActiveTool('select')
  editor.selectObject(image.id)
  editor.setSelectedPage(page.pageIndex)
}
