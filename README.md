# Docra PDF Workbench

Docra adalah prototype editor PDF lokal untuk membuktikan bahwa MuPDF.js dapat menjadi engine utama bagi workflow edit dasar: membuka dan merender PDF, mengekstrak serta memilih teks, mengganti teks melalui redaction + reconstruction, menambahkan teks, membuat redaction/highlight/ink, undo/redo, mengekspor, dan membuka kembali hasil ekspor.

Seluruh pemrosesan berjalan client-side di browser. File PDF tidak dikirim ke server dan aplikasi tidak memiliki backend, database, authentication, atau cloud storage.

## Tech stack

- React 19, TypeScript, dan Vite
- Paket resmi `mupdf` dengan WebAssembly
- Konva dan react-konva untuk interaction overlay
- Zustand untuk document, editor, dan history state
- Vitest untuk verifikasi unit
- Fontsource untuk asset font lokal melalui npm; tidak ada CDN

Project ini sengaja tidak menggunakan PDF.js, pdf-lib, Laravel, Express, atau backend Node.js.

## Menjalankan project

```bash
npm install
npm run dev
```

Buka URL yang ditampilkan Vite, klik **Open PDF**, lalu pilih file PDF lokal.

Perintah verifikasi:

```bash
npm test
npm run lint
npm run build
npm run fixture:pdf
```

`fixture:pdf` membuat `.tmp/docra-test.pdf` menggunakan MuPDF.

## Inisialisasi MuPDF

Paket ESM resmi `mupdf` diimpor secara dinamis dari npm saat pengguna membuka PDF pertama kali. Vite mengecualikannya dari dependency pre-bundling, mempertahankan target build `esnext`, memisahkan engine ke lazy chunk, dan membundel `mupdf-wasm.wasm` sebagai asset lokal. PDF page editor/Konva juga baru dimuat setelah dokumen terbuka, sedangkan exporter dan font embedding baru dimuat saat export. Karena resource berat tersebut tidak lagi berada pada jalur startup, halaman awal dan refresh tidak menunggu download/inisialisasi engine 10 MB. Tidak ada worker atau CDN karena distribusi MuPDF 1.28 dapat menginisialisasi WASM langsung dari modul ESM.

`src/pdf/mupdf.ts` menjadi satu pintu konfigurasi logging. Error dan warning MuPDF diteruskan ke console. `src/pdf/loader.ts` membuka `Uint8Array` dengan magic `application/pdf`, menolak dokumen terenkripsi yang membutuhkan password, memvalidasi bahwa dokumen benar-benar PDF, lalu membaca page count, crop bounds, dan text items.

## Rendering PDF

`src/pdf/renderer.ts` memanggil `PDFPage.toPixmap()` menggunakan `DeviceRGB`. Pixel MuPDF dikonversi menjadi RGBA `ImageData` lalu ditulis ke canvas. Semua halaman dirender vertikal; versi prototype belum memakai virtualization.

Render page dan interaction layer terpisah:

```text
PDFPage
├── canvas hasil MuPDF
└── Stage/Layers dari Konva
```

Zoom merender ulang pixmap dan menskalakan layer Konva. Nilai object dalam store tidak berubah.

## Coordinate conversion

MuPDF page space menggunakan origin kiri-atas, sumbu Y ke bawah, dan 72 unit per inci. Crop box dapat memiliki origin non-zero, sehingga Docra menyimpan seluruh editor object dalam koordinat lokal halaman:

```text
editor x = MuPDF x - CropBox.x0
editor y = MuPDF y - CropBox.y0
screen x = editor x × zoom
screen y = editor y × zoom
```

Saat export, origin CropBox ditambahkan kembali. Seluruh transform tersebut berada di `src/pdf/coordinates.ts`, termasuk rectangle normalization, quad rotation, drawing transform, dan screen/page conversion. Unit test memastikan round-trip tetap stabil pada zoom dan page origin yang berbeda.

## Text extraction dan selection

`src/pdf/textExtractor.ts` menggunakan `Page.toStructuredText().walk()`. Callback `onChar` memberi karakter, quad, font, size, dan color asli. Karakter dikelompokkan menjadi word items berdasarkan whitespace, perubahan font/size/color, jarak horizontal, dan perpindahan line.

Tidak ada metadata font yang direka. Jika MuPDF tidak menyediakan informasi yang dapat dipakai, field optional tetap kosong atau memakai fallback saat reconstruction. Setiap word item memiliki invisible clickable Konva rectangle; hover dan selection menampilkan bounds tipis dan debug panel menampilkan koordinatnya. Double-click dengan mouse atau double-tap di Android/iOS mengubah teks asli menjadi replacement object yang dapat dipindah dan diedit.

Pada perangkat sentuh, satu jari tetap melakukan scroll dan pinch dua jari mengubah zoom dokumen pada rentang 25â€“200%. Titik tengah pinch dipertahankan sebagai anchor agar halaman tidak meloncat, dan native page pinch hanya dinonaktifkan di area viewer PDF.

## Existing-text replacement

Docra tidak mengubah native content stream secara langsung. Replacement bekerja sebagai berikut:

1. Simpan bounds dan teks item asli.
2. Saat export, buat `Redact` annotation pada bounds tersebut.
3. Terapkan redaction tanpa black box agar content asli benar-benar dihapus.
4. Tambahkan replacement menggunakan `FreeText` annotation dengan Helvetica (`Helv`), font size, dan warna terdekat yang tersedia.

Replacement preview menutup bounds asli dengan mask pada Konva layer dan menggambar teks baru di atasnya. Font matching bersifat best-effort.

## Redaction, highlight, dan drawing

- Redaction manual dibuat sebagai rectangle editor. Export membuat `Redact` annotation lalu memanggil `applyRedactions(true, ...)`, sehingga content di area tersebut dihapus dan black box ditambahkan.
- Highlight disimpan sebagai rectangle/rotation editor, dikonversi menjadi quad, lalu diekspor sebagai `Highlight` annotation dengan opacity.
- Drawing merekam pointer points relatif terhadap origin object. Export menerapkan translate/scale/rotation lalu membuat `Ink` annotation.

Redaction replacement dan redaction manual diterapkan dalam dua tahap agar replacement tidak memperoleh black box.

## State dan undo/redo

- `documentStore` menyimpan MuPDF document, source bytes, pages, status loading/export, dan visible error.
- `editorStore` menyimpan active tool, selection, selected page, dan zoom.
- `historyStore` menyimpan `past`, `present`, dan `future` snapshots untuk editor objects.

History mencakup add, move, resize, rotate, delete, edit text, redact, highlight, dan drawing. Shortcut yang didukung:

- `Ctrl/Cmd + Z`: undo
- `Ctrl/Cmd + Y`: redo
- `Ctrl/Cmd + Shift + Z`: redo
- `Delete` atau `Backspace`: hapus selected object

Delete/Backspace tidak menghapus object saat fokus berada pada input, textarea, select, atau editable content.

## Export dan re-open validation

`src/pdf/exporter.ts` membuka ulang original bytes menjadi editable `PDFDocument`, menerapkan redactions terlebih dahulu, menambahkan FreeText/Highlight/Ink annotations, lalu menyimpan dengan:

```text
garbage=4,compress=yes,compress-images=yes,compress-fonts=yes
```

Sebelum `saveToBuffer()`, appearance hasil edit Docra di-*bake* menjadi content stream halaman. Langkah ini mencegah viewer Android/iOS meregenerasi anotasi `FreeText` dengan font atau baseline yang berbeda, sedangkan anotasi pihak ketiga tetap dipertahankan sebagai anotasi interaktif. Hasil `saveToBuffer()` kemudian disalin keluar dari memory WASM, dibuat menjadi Blob, dan diunduh sebagai `edited.pdf`. **Test Export** menjalankan pipeline yang sama tetapi membuka output kembali di aplikasi. Unmodified page content tidak dirasterisasi, sehingga text asli di luar area edit tetap berupa content PDF asli.

## Error handling

Error ditulis ke `console.error` dan ditampilkan melalui banner. Kondisi yang ditangani meliputi invalid PDF, encrypted PDF yang membutuhkan password, load/WASM failure, page render failure, dan export failure.

## Known Experimental Limitations

- Font matching belum sempurna. Replacement memakai base-14 Helvetica, bukan embedded font asli.
- Complex text layout, ligature, vertical writing, atau rotated text dapat terpecah menjadi word items yang kurang ideal.
- Scanned PDF belum mendukung OCR.
- Encrypted PDF yang membutuhkan password belum memiliki password prompt.
- Rotasi text object dapat dipreview di Konva tetapi belum direkonstruksi sebagai rotated FreeText saat export.
- Rotated redaction diekspor sebagai axis-aligned bounds yang menutup seluruh area rotasinya.
- Hasil ekspor bersifat final: FreeText, Highlight, dan Ink di-*bake* ke content stream agar tampil konsisten lintas PDF viewer.
- Rendering dan text extraction masih berjalan di main thread. Dokumen sangat besar dapat membuat UI berhenti sejenak.
- Semua halaman dirender sekaligus; belum ada virtual scrolling atau progressive page rendering.
- Existing-text replacement adalah redact + reconstruction, bukan native content-stream editing.
- Unicode di luar cakupan font standar dapat membutuhkan strategi font embedding tambahan.

## License note

Paket resmi MuPDF.js tersedia di bawah AGPL-3.0-or-later atau lisensi komersial Artifex. Evaluasi kewajiban lisensi sebelum memakai prototype ini di produk tertutup atau layanan produksi. Referensi API: [MuPDF.js documentation](https://mupdf.readthedocs.io/en/latest/reference/javascript/) dan [official npm package](https://www.npmjs.com/package/mupdf).
