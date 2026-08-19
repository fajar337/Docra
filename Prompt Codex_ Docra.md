# Prompt Codex: Local MuPDF PDF Editor Experiment

Saya ingin membuat prototype web PDF editor lokal yang fokus pada functionality terlebih dahulu, bukan UI/UX.

Tujuan utama project ini adalah menguji apakah MuPDF.js dapat digunakan sebagai engine utama untuk membuat editor PDF sederhana seperti fitur dasar Sejda Edit PDF.

## Tech Stack

Gunakan:

- React
- TypeScript
- Vite
- MuPDF.js / MuPDF WebAssembly
- Konva.js
- react-konva
- Zustand
- CSS sederhana atau Tailwind jika benar-benar diperlukan

Jangan gunakan:

- Laravel
- Express
- Node.js backend
- database
- authentication
- cloud storage
- PDF.js
- pdf-lib

Semua proses PDF harus dilakukan client-side di browser.

Project harus dapat dijalankan lokal menggunakan:

```bash
npm install
npm run dev
```

---

# Prioritas Utama

Jangan fokus pada desain UI.

UI cukup sederhana dan bahkan boleh terlihat seperti developer tool.

Yang penting seluruh workflow PDF bekerja dengan benar.

Prioritas:

1. PDF bisa dibuka
2. PDF bisa dirender
3. halaman PDF bisa ditampilkan
4. teks PDF bisa diekstrak
5. bounding box teks bisa diketahui
6. teks bisa dipilih
7. teks lama bisa diganti
8. text baru bisa ditambahkan
9. redaction bekerja
10. highlight bekerja
11. drawing bekerja
12. PDF bisa diekspor kembali

---

# Phase 1: Project Setup

Buat project menggunakan:

```bash
npm create vite@latest pdf-editor -- --template react-ts
```

Install dependency yang diperlukan untuk:

```text
MuPDF.js
Konva
react-konva
Zustand
```

Pastikan MuPDF WebAssembly dapat berjalan dengan benar di Vite.

Jika MuPDF memerlukan worker, WASM asset configuration, atau custom Vite configuration, buat konfigurasi tersebut dengan benar.

Jangan menggunakan CDN.

Semua dependencies harus melalui npm.

---

# Phase 2: Open PDF

Buat tombol:

```text
Open PDF
```

Gunakan:

```html
<input type="file" accept="application/pdf">
```

PDF harus dibaca menggunakan browser API:

```text
File
↓
ArrayBuffer / Uint8Array
↓
MuPDF Document
```

Jangan upload file ke server.

Semua data harus tetap di browser.

---

# Phase 3: Render PDF

Setelah PDF dibuka:

1. Baca jumlah halaman.
2. Render setiap halaman menggunakan MuPDF.
3. Tampilkan halaman di browser.
4. Pertahankan aspect ratio PDF.
5. Support dokumen multi-page.

Untuk versi awal tidak perlu virtual scrolling.

Render semua halaman secara vertikal.

Contoh:

```text
Page 1

────────────

Page 2

────────────

Page 3
```

Buat komponen seperti:

```text
src/components/PDFViewer.tsx
src/components/PDFPage.tsx
```

---

# Phase 4: Coordinate System

Ini bagian penting.

Buat utility khusus untuk konversi koordinat antara:

```text
PDF coordinates
MuPDF coordinates
screen/browser coordinates
Konva coordinates
```

Jangan menyimpan object berdasarkan ukuran layar aktual.

Gunakan coordinate system yang konsisten berdasarkan ukuran asli halaman PDF.

Contoh:

```text
PDF:
x = 100
y = 250

zoom 100%
screen x = 100
screen y = 250

zoom 200%
screen x = 200
screen y = 500

state tetap:
x = 100
y = 250
```

Buat file:

```text
src/pdf/coordinates.ts
```

Semua transform coordinate harus melalui utility ini.

---

# Phase 5: Zoom

Tambahkan zoom sederhana:

```text
50%
75%
100%
125%
150%
200%
```

Zoom hanya memengaruhi rendering.

Data editor tidak boleh berubah ketika zoom berubah.

---

# Phase 6: Text Extraction

Gunakan MuPDF untuk mengekstrak text dari halaman.

Untuk setiap text/span/word yang memungkinkan, simpan:

```ts
interface PDFTextItem {
  id: string;
  pageIndex: number;

  text: string;

  x: number;
  y: number;

  width: number;
  height: number;

  fontSize?: number;
  fontName?: string;

  color?: string;
}
```

Jika MuPDF tidak memberikan seluruh informasi font dengan mudah, gunakan field yang tersedia terlebih dahulu.

Jangan memalsukan data.

Jika informasi tertentu tidak tersedia, beri fallback.

---

# Phase 7: Text Selection Overlay

Di atas hasil render MuPDF, buat layer interaktif transparan menggunakan Konva.

Arsitektur setiap halaman:

```text
Page Container
│
├── MuPDF rendered page
│
└── Konva interaction layer
```

Untuk setiap text item hasil extraction, buat invisible clickable bounding box.

Contoh:

```text
PDF text:

Nama: Budi Santoso

overlay:

┌────────────────────┐
│ Nama: Budi Santoso │
└────────────────────┘
```

Ketika pointer diarahkan ke text:

```text
bounding box boleh terlihat tipis
```

Ketika diklik:

```text
selectedTextItem
```

disimpan di Zustand.

---

# Phase 8: Existing Text Editing

Buat mode:

```text
Select / Edit Text
```

Ketika user double-click text PDF:

Tampilkan input sederhana.

Contoh:

```text
Current:
Budi Santoso

Replacement:
[Fajar Mustofa]
```

Kemudian tombol:

```text
Apply
```

Untuk prototype ini jangan mencoba melakukan native content-stream text editing.

Gunakan strategi:

```text
original text
↓
redact original bounds
↓
insert replacement text
```

Contoh:

```text
Nama: Budi Santoso
```

menjadi:

```text
Nama: Fajar Mustofa
```

Gunakan MuPDF redaction untuk benar-benar menghapus visual/text content yang berada di area tersebut jika API MuPDF mendukungnya.

Setelah redaction:

tambahkan replacement text menggunakan annotation atau API drawing/text MuPDF yang paling sesuai.

Pertahankan sebisa mungkin:

```text
x
y
font size
text color
```

Jika original font tidak dapat digunakan, gunakan fallback font standar.

Prioritasnya adalah functionality, bukan perfect font matching.

---

# Phase 9: Add Text

Buat tool:

```text
Add Text
```

User klik pada halaman.

Kemudian buat text object baru.

Default:

```text
Text
font size: 16
black
```

Object harus bisa:

```text
select
move
edit text
delete
```

Gunakan Konva untuk interactive editing.

State object contoh:

```ts
interface EditorTextObject {
  id: string;
  type: "text";

  pageIndex: number;

  x: number;
  y: number;

  text: string;

  fontSize: number;
  color: string;

  rotation: number;
}
```

---

# Phase 10: Konva Selection

Gunakan:

```text
Konva.Transformer
```

Selected editor object harus dapat:

```text
drag
resize
rotate
delete
```

Keyboard:

```text
Delete
Backspace
```

untuk menghapus selected editor object.

Jangan izinkan Backspace/Delete menghapus object ketika user sedang mengetik pada input.

---

# Phase 11: Redact Tool

Buat tool:

```text
Redact
```

User drag rectangular area.

Contoh:

```text
mouse down
↓
drag
↓
mouse up
```

hasil:

```text
Redaction Object
```

Saat Apply / Export:

gunakan MuPDF redaction API.

State:

```ts
interface RedactionObject {
  id: string;
  type: "redaction";

  pageIndex: number;

  x: number;
  y: number;

  width: number;
  height: number;
}
```

Tampilkan overlay semi-transparan saat editing.

---

# Phase 12: Highlight

Buat tool:

```text
Highlight
```

Untuk prototype pertama boleh rectangular highlight.

User drag area dan menghasilkan:

```text
HighlightObject
```

Jika MuPDF memiliki highlight annotation yang cocok, gunakan API tersebut saat export.

---

# Phase 13: Drawing

Buat mode:

```text
Draw
```

Gunakan Konva.Line untuk menangkap pointer movements.

State:

```ts
interface DrawingObject {
  id: string;
  type: "drawing";

  pageIndex: number;

  points: number[];

  width: number;
}
```

Saat PDF disimpan:

ubah drawing menjadi MuPDF Ink annotation atau mekanisme MuPDF yang setara.

---

# Phase 14: Zustand Store

Gunakan Zustand.

Pisahkan state minimal menjadi:

```text
documentStore
editorStore
historyStore
```

Contoh:

```text
documentStore
- pdfDocument
- originalPdfBytes
- pageCount
- pageSizes

editorStore
- activeTool
- selectedObjectId
- selectedPdfText
- objects
- zoom

historyStore
- past
- present
- future
```

Hindari global state yang tidak diperlukan.

---

# Phase 15: Undo / Redo

Implementasikan:

```text
Ctrl + Z
Ctrl + Y

Ctrl + Shift + Z
```

Minimal mendukung:

```text
add object
move object
resize object
delete object
edit text
add redaction
add drawing
add highlight
```

Gunakan snapshot atau command history sederhana.

Jangan over-engineer.

---

# Phase 16: Export PDF

Buat tombol:

```text
Export PDF
```

Flow:

```text
original PDF
↓
clone / open editable document
↓
apply redactions
↓
apply replacement texts
↓
apply added texts
↓
apply highlights
↓
apply drawings
↓
saveToBuffer()
↓
Blob
↓
download edited.pdf
```

Jangan rasterize seluruh PDF menjadi gambar.

PDF hasil export harus tetap berupa PDF asli yang dimodifikasi.

Tujuan penting:

Jika original PDF memiliki selectable text, sebisa mungkin text lain yang tidak diedit tetap selectable.

---

# Phase 17: Re-open Validation

Setelah export:

PDF hasil export harus dapat:

```text
dibuka kembali di browser
dibuka kembali di aplikasi kita
dirender kembali oleh MuPDF
```

Tambahkan tombol optional:

```text
Test Export
```

yang membuka hasil export kembali di aplikasi tanpa harus reload seluruh project.

---

# Phase 18: Minimal UI

UI cukup seperti ini:

```text
┌────────────────────────────────────────────────────┐
│ Open PDF │ Export │ Undo │ Redo │ Zoom 100%       │
├────────────────────────────────────────────────────┤
│ Select │ Add Text │ Redact │ Highlight │ Draw     │
├────────────────────────────────────────────────────┤
│                                                    │
│                    PAGE 1                          │
│                                                    │
│                                                    │
│                                                    │
├────────────────────────────────────────────────────┤
│                    PAGE 2                          │
│                                                    │
└────────────────────────────────────────────────────┘
```

Gunakan warna sederhana.

Jangan menghabiskan waktu untuk:

```text
animations
dark mode
responsive mobile
beautiful icon set
design system
complex sidebar
modals
landing page
authentication screen
```

Ini developer prototype.

---

# Suggested Project Structure

Gunakan struktur modular seperti:

```text
src/
│
├── components/
│   ├── PDFEditor.tsx
│   ├── PDFViewer.tsx
│   ├── PDFPage.tsx
│   ├── EditorLayer.tsx
│   └── Toolbar.tsx
│
├── pdf/
│   ├── mupdf.ts
│   ├── loader.ts
│   ├── renderer.ts
│   ├── textExtractor.ts
│   ├── exporter.ts
│   └── coordinates.ts
│
├── tools/
│   ├── selectTool.ts
│   ├── textTool.ts
│   ├── redactTool.ts
│   ├── highlightTool.ts
│   └── drawTool.ts
│
├── stores/
│   ├── documentStore.ts
│   ├── editorStore.ts
│   └── historyStore.ts
│
├── types/
│   ├── pdf.ts
│   └── editor.ts
│
├── App.tsx
└── main.tsx
```

Tidak wajib 100% sama jika implementasi MuPDF membutuhkan struktur berbeda, tetapi tetap jaga separation of concerns.

---

# Error Handling

Handle minimal:

```text
invalid PDF
encrypted PDF
MuPDF load failure
WASM initialization error
rendering failure
export failure
unsupported operation
```

Error harus tampil melalui:

```text
console.error
+
simple visible error message
```

Jangan silently fail.

---

# Debug Panel

Karena ini eksperimen, tambahkan debug panel kecil.

Tampilkan:

```text
PDF loaded: yes/no
Page count
Selected page
Selected text
Selected object
Active tool
Zoom
Object count
```

Contoh:

```text
DEBUG

Pages: 3
Tool: Select
Zoom: 100%
Objects: 4

Selected PDF text:
"Budi Santoso"

Bounds:
x: 122
y: 311
w: 98
h: 15
```

Debug panel ini sangat penting untuk development.

---

# Important Implementation Rules

1. Gunakan TypeScript secara benar.

2. Jangan gunakan `any` kecuali benar-benar dibutuhkan untuk API MuPDF yang tidak memiliki typing.

3. Jangan membuat giant component.

4. Jangan membuat satu file `App.tsx` berisi seluruh editor.

5. Jangan menggunakan backend.

6. Jangan menggunakan PDF.js.

7. Jangan menggunakan pdf-lib.

8. Jangan melakukan rasterization seluruh PDF saat export.

9. Jangan fokus UI sebelum engine bekerja.

10. Jangan menghapus fitur hanya karena implementasinya sulit tanpa menjelaskan alasannya.

Jika ada API MuPDF yang berbeda dengan asumsi dalam prompt ini:

- periksa API MuPDF yang benar
- gunakan implementasi yang benar
- jangan membuat API palsu
- jangan membuat placeholder function yang pura-pura bekerja

Jika sebuah fitur tidak dapat diimplementasikan dengan API MuPDF yang tersedia, jelaskan pada kode/README apa batasannya dan implementasikan fallback terbaik.

---

# Development Strategy

Kerjakan secara incremental.

Urutan:

```text
STEP 1
MuPDF initialization

STEP 2
Open PDF

STEP 3
Render first page

STEP 4
Render multi-page

STEP 5
Zoom

STEP 6
Extract text

STEP 7
Show text bounding boxes

STEP 8
Select existing text

STEP 9
Add text

STEP 10
Move text using Konva

STEP 11
Redaction

STEP 12
Existing text replacement

STEP 13
Highlight

STEP 14
Drawing

STEP 15
Undo / Redo

STEP 16
Export

STEP 17
Re-open exported PDF
```

Jangan langsung mencoba membuat seluruh fitur sekaligus.

Pastikan setiap step bekerja sebelum lanjut.

---

# README

Buat README.md yang menjelaskan:

```text
Project purpose
Tech stack
How MuPDF is initialized
How PDF rendering works
How coordinate conversion works
How text extraction works
How existing-text replacement works
How redaction works
How export works
Known limitations
How to run
```

Tambahkan juga bagian:

```text
Known Experimental Limitations
```

seperti:

```text
font matching belum sempurna
complex PDF text layout mungkin tidak terdeteksi sebagai satu text block
scanned PDF belum mendukung OCR
encrypted PDF mungkin terbatas
rotated text mungkin belum sempurna
existing text replacement menggunakan redact + reconstruction
```

---

# Definition of Done

Prototype dianggap berhasil jika saya dapat melakukan workflow berikut:

```text
1. npm run dev

2. browser terbuka

3. klik Open PDF

4. pilih PDF lokal

5. PDF tampil

6. semua halaman tampil

7. saya dapat klik existing text

8. debug panel menunjukkan text dan bounding box

9. saya dapat mengganti existing text

10. saya dapat Add Text

11. text baru dapat dipindahkan

12. saya dapat membuat redaction

13. saya dapat highlight

14. saya dapat menggambar

15. Ctrl+Z bekerja

16. klik Export PDF

17. edited.pdf berhasil dibuat

18. edited.pdf dapat dibuka kembali

19. perubahan benar-benar terlihat di PDF hasil export
```

Fokus utama sekarang adalah membuktikan bahwa engine PDF editing ini bekerja.

Jangan polishing UI sebelum Definition of Done di atas terpenuhi.