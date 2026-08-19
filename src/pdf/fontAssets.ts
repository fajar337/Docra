import robotoLightDataUrl from '@expo-google-fonts/roboto/300Light/Roboto_300Light.ttf?inline'
import robotoRegularDataUrl from '@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf?inline'
import type { TextFontChoice } from '../types/editor'

interface BundledFont {
  name: string
  bytes: Uint8Array
}

const fontCache = new Map<TextFontChoice, BundledFont>()

function decodeDataUrl(dataUrl: string): Uint8Array {
  const separator = dataUrl.indexOf(',')
  if (separator < 0 || !dataUrl.slice(0, separator).includes(';base64')) {
    throw new Error('Aset font lokal tidak dapat dibaca.')
  }

  const binary = atob(dataUrl.slice(separator + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function getBundledFont(
  fontChoice: TextFontChoice,
): BundledFont | null {
  const cached = fontCache.get(fontChoice)
  if (cached) {
    return cached
  }

  const definition =
    fontChoice === 'roboto-regular'
      ? { name: 'Roboto', dataUrl: robotoRegularDataUrl }
      : fontChoice === 'roboto-light'
        ? { name: 'Roboto Light', dataUrl: robotoLightDataUrl }
        : null

  if (!definition) {
    return null
  }

  const font = {
    name: definition.name,
    bytes: decodeDataUrl(definition.dataUrl),
  }
  fontCache.set(fontChoice, font)
  return font
}
