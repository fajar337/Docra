import type mupdfType from 'mupdf'

type MuPDF = typeof mupdfType

let loadedMuPDF: MuPDF | null = null
let loadingMuPDF: Promise<MuPDF> | null = null

function configureMuPDF(mupdf: MuPDF): MuPDF {
  mupdf.setLog({
      error: (message) => console.error('[MuPDF]', message),
      warning: (message) => console.warn('[MuPDF]', message),
  })
  return mupdf
}

export async function initializeMuPDF(): Promise<MuPDF> {
  if (loadedMuPDF) {
    return loadedMuPDF
  }

  loadingMuPDF ??= import('mupdf')
    .then((module) => configureMuPDF(module.default))
    .then((mupdf) => {
      loadedMuPDF = mupdf
      return mupdf
    })
    .catch((error) => {
      loadingMuPDF = null
      throw error
    })

  return loadingMuPDF
}

export function getMuPDF(): MuPDF {
  if (!loadedMuPDF) {
    throw new Error('MuPDF belum selesai dimuat.')
  }
  return loadedMuPDF
}
