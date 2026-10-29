import { useEffect, useState, type ComponentProps } from 'react'
import { Image as KonvaImage } from 'react-konva'
import { loadImage } from '../tools/images'

export function ImageNode({ dataUrl, ...props }: Omit<ComponentProps<typeof KonvaImage>, 'image'> & { dataUrl: string }) {
  const [image, setImage] = useState<HTMLImageElement>()
  useEffect(() => {
    let active = true
    loadImage(dataUrl).then((loaded) => { if (active) setImage(loaded) }).catch(() => {})
    return () => { active = false }
  }, [dataUrl])
  return <KonvaImage {...props} image={image} />
}
