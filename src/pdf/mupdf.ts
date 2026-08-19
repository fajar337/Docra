import mupdf from 'mupdf'

let logConfigured = false

export function getMuPDF() {
  if (!logConfigured) {
    mupdf.setLog({
      error: (message) => console.error('[MuPDF]', message),
      warning: (message) => console.warn('[MuPDF]', message),
    })
    logConfigured = true
  }

  return mupdf
}

export { mupdf }
