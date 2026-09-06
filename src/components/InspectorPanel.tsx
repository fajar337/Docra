import { useMemo, useState, type FormEvent } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useHistoryStore } from '../stores/historyStore'
import type { EditorTextObject, TextFontChoice } from '../types/editor'
import type { PDFTextItem } from '../types/pdf'
import { createReplacementObject, defaultReplacementFont } from '../tools/objectFactory'
import { minimumPreviewTextWidth } from '../pdf/textMetrics'
import { LiquidGlassSelect } from './ui/LiquidGlassSelect'

const FONT_OPTIONS: Array<{ value: TextFontChoice; label: string }> = [
  { value: 'original', label: 'Original PDF font' },
  { value: 'arial', label: 'Arial' },
  { value: 'helvetica', label: 'Helvetica' },
  { value: 'helvetica-neue-light', label: 'Helvetica Neue Light' },
  { value: 'roboto-regular', label: 'Roboto Regular (default)' },
  { value: 'roboto-light', label: 'Roboto Light' },
]

function FontSelect({
  id,
  value,
  sourceFontName,
  onChange,
}: {
  id: string
  value: TextFontChoice
  sourceFontName?: string
  onChange: (font: TextFontChoice) => void
}) {
  const labelId = `${id}-label`
  const options = FONT_OPTIONS.map((option) => ({
    ...option,
    label:
      option.value === 'original' && sourceFontName
        ? `${option.label} (${sourceFontName})`
        : option.label,
  }))

  return (
    <div className="field-stack">
      <label id={labelId} htmlFor={id}>
        Font
      </label>
      <LiquidGlassSelect
        id={id}
        labelledBy={labelId}
        value={value}
        options={options}
        onChange={onChange}
      />
    </div>
  )
}

function SelectedPDFTextEditor({ item }: { item: PDFTextItem }) {
  const objects = useHistoryStore((state) => state.present)
  const addObject = useHistoryStore((state) => state.addObject)
  const updateObject = useHistoryStore((state) => state.updateObject)
  const selectObject = useEditorStore((state) => state.selectObject)
  const existing = useMemo(
    () =>
      objects.find(
        (object): object is EditorTextObject =>
          object.type === 'text' &&
          object.source === 'replacement' &&
          object.replacementFor?.textItemId === item.id,
      ),
    [item.id, objects],
  )
  const [replacement, setReplacement] = useState(existing?.text ?? item.text)
  const [fontChoice, setFontChoice] = useState<TextFontChoice>(
    existing?.fontChoice ?? defaultReplacementFont(item.text),
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (existing) {
      updateObject(existing.id, { text: replacement, fontChoice })
      selectObject(existing.id)
      return
    }

    const object = createReplacementObject(item, replacement, fontChoice)
    addObject(object)
    selectObject(object.id)
  }

  return (
    <form className="inspector-form" onSubmit={submit}>
      <div className="field-stack">
        <label htmlFor="current-text">Current</label>
        <textarea id="current-text" value={item.text} readOnly />
      </div>
      <div className="field-stack">
        <label htmlFor="replacement-text">Replacement</label>
        <textarea
          id="replacement-text"
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
        />
      </div>
      <FontSelect
        id="replacement-font"
        value={fontChoice}
        sourceFontName={item.fontName}
        onChange={setFontChoice}
      />
      <button className="button--accent" type="submit">
        Apply replacement
      </button>
      <p className="inspector-note">
        Export memakai redaction pada bounds asli lalu menambahkan FreeText pada
        baseline yang sama.
      </p>
    </form>
  )
}

function TextObjectEditor({ object }: { object: EditorTextObject }) {
  const updateObject = useHistoryStore((state) => state.updateObject)
  const deleteObject = useHistoryStore((state) => state.deleteObject)
  const selectObject = useEditorStore((state) => state.selectObject)
  const [text, setText] = useState(object.text)
  const [fontSize, setFontSize] = useState(String(object.fontSize))
  const [fontChoice, setFontChoice] = useState<TextFontChoice>(
    object.fontChoice ??
      (object.source === 'replacement' ? 'original' : 'helvetica'),
  )
  const [color, setColor] = useState(object.color)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextFontSize = Math.max(6, Number(fontSize) || 16)
    updateObject(object.id, {
      text,
      color,
      fontSize: nextFontSize,
      fontChoice,
      width: Math.max(
        object.width,
        minimumPreviewTextWidth(
          text,
          nextFontSize,
          fontChoice,
          object.fontName,
        ),
      ),
    })
  }

  const remove = () => {
    deleteObject(object.id)
    selectObject(null)
  }

  return (
    <form className="inspector-form" onSubmit={submit}>
      <div className="field-stack">
        <label htmlFor="object-text">Text</label>
        <textarea
          id="object-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <FontSelect
        id="object-font"
        value={fontChoice}
        sourceFontName={object.fontName}
        onChange={setFontChoice}
      />
      <div className="inspector-grid">
        <div className="field-stack">
          <label htmlFor="font-size">Font size</label>
          <input
            id="font-size"
            type="number"
            min="6"
            max="144"
            value={fontSize}
            onChange={(event) => setFontSize(event.target.value)}
          />
        </div>
        <div className="field-stack">
          <label htmlFor="text-color">Color</label>
          <input
            id="text-color"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </div>
      </div>
      <div className="inspector-actions">
        <button className="button--accent" type="submit">
          Apply text
        </button>
        <button className="button--danger" type="button" onClick={remove}>
          Delete object
        </button>
      </div>
    </form>
  )
}

export function InspectorPanel() {
  const selectedPdfText = useEditorStore((state) => state.selectedPdfText)
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId)
  const selectObject = useEditorStore((state) => state.selectObject)
  const objects = useHistoryStore((state) => state.present)
  const deleteObject = useHistoryStore((state) => state.deleteObject)
  const selectedObject = objects.find(
    (object) => object.id === selectedObjectId,
  )

  const removeSelected = () => {
    if (selectedObject) {
      deleteObject(selectedObject.id)
      selectObject(null)
    }
  }

  return (
    <section className="side-panel__section" aria-labelledby="inspector-title">
      <h2 id="inspector-title">Inspector</h2>
      {selectedPdfText ? (
        <SelectedPDFTextEditor key={selectedPdfText.id} item={selectedPdfText} />
      ) : selectedObject?.type === 'text' ? (
        <TextObjectEditor key={selectedObject.id} object={selectedObject} />
      ) : selectedObject ? (
        <div className="object-summary">
          <p>
            <strong>{selectedObject.type}</strong> on page{' '}
            {selectedObject.pageIndex + 1}
          </p>
          <p>
            Drag untuk memindahkan. Gunakan handle Transformer untuk resize atau
            rotate.
          </p>
          <button className="button--danger" type="button" onClick={removeSelected}>
            Delete object
          </button>
        </div>
      ) : (
        <p className="empty-copy">
          Pilih teks PDF atau object editor untuk melihat propertinya.
        </p>
      )}
    </section>
  )
}
