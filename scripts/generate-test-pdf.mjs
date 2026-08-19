import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import mupdf from 'mupdf'

const outputDirectory = resolve('.tmp')
const outputPath = resolve(outputDirectory, 'docra-test.pdf')
mkdirSync(outputDirectory, { recursive: true })

const document = new mupdf.PDFDocument()
try {
  const font = document.addSimpleFont(new mupdf.Font('Helvetica'), 'Latin')
  const fonts = document.newDictionary()
  fonts.put('F1', font)
  const resources = document.addObject(document.newDictionary())
  resources.put('Font', fonts)

  const pageOne = document.addPage(
    [0, 0, 420, 560],
    0,
    resources,
    [
      'BT',
      '/F1 22 Tf',
      '32 500 Td',
      '(Editable Name) Tj',
      '0 -38 Td',
      '/F1 12 Tf',
      '(Local MuPDF browser fixture) Tj',
      'ET',
    ].join('\n'),
  )
  document.insertPage(-1, pageOne)

  const pageTwo = document.addPage(
    [0, 0, 420, 560],
    0,
    resources,
    'BT /F1 18 Tf 32 500 Td (Second page) Tj ET',
  )
  document.insertPage(-1, pageTwo)

  const buffer = document.saveToBuffer('compress=yes')
  try {
    writeFileSync(outputPath, buffer.asUint8Array())
  } finally {
    buffer.destroy()
  }
} finally {
  document.destroy()
}

console.log(outputPath)
