import { useState } from 'react'
import type { ImageObject } from '../types/editor'
import { useHistoryStore } from '../stores/historyStore'
import { useEditorStore } from '../stores/editorStore'
import { useDocumentStore } from '../stores/documentStore'
import { cropImage } from '../tools/images'
import { pasteImage } from '../tools/imageClipboard'

const EMPTY_CROP = { left: 0, top: 0, right: 0, bottom: 0 }
const CROP_SIDES = [
  ['left', 'Kiri'], ['top', 'Atas'], ['right', 'Kanan'], ['bottom', 'Bawah'],
] as const
const OPPOSITE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' } as const

export function ImageObjectEditor({ object }: { object: ImageObject }) {
  const updateObject = useHistoryStore((state) => state.updateObject)
  const deleteObject = useHistoryStore((state) => state.deleteObject)
  const copyImage = useEditorStore((state) => state.copyImage)
  const selectObject = useEditorStore((state) => state.selectObject)
  const [cropping, setCropping] = useState(false)
  const [crop, setCrop] = useState(EMPTY_CROP)
  const [busy, setBusy] = useState(false)

  const applyCrop = async () => {
    setBusy(true)
    try {
      const updates = await cropImage(object, crop)
      updateObject(object.id, updates)
      setCrop(EMPTY_CROP)
      setCropping(false)
    } catch (error) {
      useDocumentStore.getState().setError(error instanceof Error ? error.message : 'Gagal memotong gambar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inspector-form">
      <p className="image-name">{object.name}</p>
      <p className="inspector-note">Drag untuk memindahkan. Tarik sudut untuk mengubah ukuran, atau handle atas untuk memutar.</p>
      <div className="inspector-actions">
        <button type="button" onClick={() => updateObject(object.id, { width: object.width * 0.8, height: object.height * 0.8 })}>Perkecil</button>
        <button type="button" onClick={() => updateObject(object.id, { width: object.width * 1.25, height: object.height * 1.25 })}>Perbesar</button>
      </div>
      <div className="inspector-actions">
        <button type="button" onClick={() => updateObject(object.id, { rotation: object.rotation - 90 })}>Putar −90°</button>
        <button type="button" onClick={() => updateObject(object.id, { rotation: object.rotation + 90 })}>Putar +90°</button>
      </div>
      <div className="inspector-actions">
        <button type="button" onClick={() => copyImage(object)}>Copy</button>
        <button type="button" onClick={() => { copyImage(object); pasteImage() }}>Duplikat</button>
        <button type="button" aria-expanded={cropping} onClick={() => { setCrop(EMPTY_CROP); setCropping(!cropping) }}>Crop</button>
      </div>
      {cropping ? (
        <div className="image-crop">
          <p className="inspector-note">Geser batas potongan. Bagian gambar yang terang akan disimpan.</p>
          <div className="image-crop__preview">
            <img className="image-crop__original" src={object.dataUrl} alt="" />
            <img src={object.dataUrl} alt="Preview hasil crop" style={{ clipPath: `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)` }} />
          </div>
          {CROP_SIDES.map(([side, label]) => (
            <label key={side} className="field-stack">
              <span>{label} <output>{crop[side]}%</output></span>
              <input
                type="range" min="0" max={Math.max(0, 99 - crop[OPPOSITE[side]])}
                value={crop[side]} disabled={busy}
                onChange={(event) => setCrop({ ...crop, [side]: Number(event.target.value) })}
              />
            </label>
          ))}
          <div className="inspector-actions">
            <button type="button" className="button--accent" disabled={busy || Object.values(crop).every((value) => value === 0)} onClick={() => void applyCrop()}>{busy ? 'Memotong…' : 'Terapkan crop'}</button>
            <button type="button" disabled={busy} onClick={() => setCropping(false)}>Batal</button>
          </div>
        </div>
      ) : null}
      <p className="inspector-note">Ctrl+C untuk copy, Ctrl+V untuk paste. Undo juga mengembalikan hasil crop.</p>
      <button className="button--danger" type="button" onClick={() => { deleteObject(object.id); selectObject(null) }}>Hapus gambar</button>
    </div>
  )
}
