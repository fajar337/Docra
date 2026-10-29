import type { ImageObject } from '../types/editor'

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Gambar tidak dapat dibaca. Pilih file PNG, JPG, atau WebP.'))
    image.src = dataUrl
  })
}

export async function imageFromFile(file: File, page: { pageIndex: number; width: number; height: number }): Promise<ImageObject> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Gambar tidak dapat diproses.')
    context.drawImage(image, 0, 0)
    const scale = Math.min(1, page.width * 0.6 / canvas.width, page.height * 0.6 / canvas.height)
    const width = canvas.width * scale
    const height = canvas.height * scale
    return {
      id: `image:${crypto.randomUUID()}`, type: 'image', pageIndex: page.pageIndex,
      x: (page.width - width) / 2, y: (page.height - height) / 2,
      width, height, rotation: 0, dataUrl: canvas.toDataURL('image/png'), name: file.name,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function cropImage(object: ImageObject, crop: { left: number; top: number; right: number; bottom: number }): Promise<Partial<ImageObject>> {
  const image = await loadImage(object.dataUrl)
  const sx = Math.min(image.naturalWidth - 1, Math.round(image.naturalWidth * crop.left / 100))
  const sy = Math.min(image.naturalHeight - 1, Math.round(image.naturalHeight * crop.top / 100))
  const sw = Math.max(1, Math.round(image.naturalWidth * (100 - crop.right) / 100) - sx)
  const sh = Math.max(1, Math.round(image.naturalHeight * (100 - crop.bottom) / 100) - sy)
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Gambar tidak dapat dipotong.')
  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh)
  const dx = object.width * sx / image.naturalWidth
  const dy = object.height * sy / image.naturalHeight
  const radians = object.rotation * Math.PI / 180
  return {
    dataUrl: canvas.toDataURL('image/png'),
    x: object.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: object.y + dx * Math.sin(radians) + dy * Math.cos(radians),
    width: object.width * sw / image.naturalWidth,
    height: object.height * sh / image.naturalHeight,
  }
}
