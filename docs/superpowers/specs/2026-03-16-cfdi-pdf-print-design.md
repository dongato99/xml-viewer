# CFDI PDF Print Feature — Design Spec

## Overview

Add PDF generation and download capability to the XML Viewer CFDI app. Users can print individual CFDIs from grid rows or bulk-print selected CFDIs as a ZIP archive. The PDF replicates the standard SAT printed representation with all fields from the CFDI XML.

## Requirements

- Generate PDF from any loaded CFDI XML (versions 4.0 and 3.3)
- Single CFDI downloads as `{UUID}.pdf`
- Multiple CFDIs download as `CFDIs_{fecha}.zip`
- PDF contains all fields present in the standard SAT printed representation
- QR code with SAT verification URL
- Two entry points: per-row button and toolbar bulk action

## Architecture

### Bundle Strategy

The app uses individual ES module source files (`js/*.js`) and a concatenated `js/bundle.js` for runtime. New JS files follow the same pattern: developed as individual modules, then concatenated into `bundle.js`. Library files (UMD globals) are loaded via separate `<script>` tags before `bundle.js`.

### New Files

| File | Purpose |
|------|---------|
| `js/cfdi-print-parser.js` | Full XML parser extracting all CFDI fields for PDF rendering |
| `js/pdf-generator.js` | PDF construction using jsPDF |

Both must be concatenated into `bundle.js` after development.

### New Libraries (in `lib/`)

| Library | Size | Purpose |
|---------|------|---------|
| `jspdf.umd.min.js` | ~300KB | PDF generation |
| `qrcode.min.js` (qrcode-generator by kazuhikoarase) | ~30KB | QR code generation — functional API: `qrcode(0, 'M')`, then `.addData(url)`, `.make()`, `.createDataURL()` |
| `jszip.min.js` | ~25KB | ZIP packaging for bulk downloads |

### Modified Files

| File | Changes |
|------|---------|
| `index.html` | Add `<script>` tags for jspdf, qrcode, jszip libraries (before bundle.js) |
| `js/app.js` | Store raw XML strings in `xmlStore` Map, wire print event handlers |
| `js/grid.js` | Add PDF button column per row, add "Imprimir Seleccionados" toolbar button, cleanup xmlStore on clear/remove |
| `js/sat-catalogs.js` | Add `lookupExportacion`, `lookupObjetoImp`, `lookupMetodoPago` lookup functions |
| `css/style.css` | Styles for PDF button in rows and toolbar |

## Data Extraction (`cfdi-print-parser.js`)

Parses the raw XML string and returns a structured object with all fields needed for the PDF. Separate from the existing `cfdi-parser.js` which extracts a flat row for the grid.

### Fields Extracted

**Comprobante attributes:**
- Version, Serie, Folio, Fecha, Sello, FormaPago, NoCertificado, SubTotal, Descuento (comprobante-level global discount), Moneda, TipoCambio, Total, TipoDeComprobante, MetodoPago, LugarExpedicion, Exportacion

**Emisor:**
- Rfc, Nombre, RegimenFiscal

**Receptor:**
- Rfc, Nombre, UsoCFDI, RegimenFiscalReceptor, DomicilioFiscalReceptor

Note: RegimenFiscalReceptor, DomicilioFiscalReceptor, Exportacion, and ObjetoImp are CFDI 4.0-only fields. For 3.3 documents these will be empty — the PDF layout must conditionally render them (omit the label entirely when value is absent).

**Conceptos (array, one per cfdi:Concepto):**
- ClaveProdServ, NoIdentificacion, Cantidad, ClaveUnidad, Unidad, Descripcion, ValorUnitario, Importe, Descuento, ObjetoImp
- Impuestos per concept: array of { Impuesto, Tipo (Traslado/Retencion), Base, TipoFactor, TasaOCuota, Importe }
- NumeroPedimento, CuentaPredial (if present)

**Impuestos (Comprobante-level):**
- TotalImpuestosTrasladados
- TotalImpuestosRetenidos
- Traslados: array of { Base, Impuesto, TipoFactor, TasaOCuota, Importe }
- Retenciones: array of { Impuesto, Importe }

**TimbreFiscalDigital:**
- Version, UUID, FechaTimbrado, RfcProvCertif, SelloCFD, NoCertificadoSAT, SelloSAT

**Important:** All numeric values (Total, SubTotal, etc.) are read directly from the raw XML attributes without sign adjustment. The sign flip for Egresos is a display concern in the grid only, not for the printed representation.

### SAT Catalog Lookups

Reuses existing `sat-catalogs.js` for:
- `lookupFormaPago` — FormaPago description (already exists)
- `lookupTipoComprobante` — TipoDeComprobante description (already exists)
- `lookupRegimenFiscal` — RegimenFiscal description for both emisor and receptor (already exists)
- `lookupUsoCFDI` — UsoCFDI description (already exists)

New lookups to add to `sat-catalogs.js`:
- `lookupExportacion` — 01="No aplica", 02="Definitiva", 03="Temporal", 04="Definitiva con clave A1"
- `lookupObjetoImp` — 01="No objeto de impuesto", 02="Sí objeto de impuesto", 03="Sí objeto del impuesto y no obligado al desglose", 04="Sí objeto del impuesto y no causa impuesto"
- `lookupMetodoPago` — PUE="Pago en una sola exhibición", PPD="Pago en parcialidades o diferido"

## PDF Layout (`pdf-generator.js`)

Built with jsPDF directly (no autotable plugin). Page size: Letter. Margins: ~15mm.

### Section 1: Header (two columns)

**Left column — labels and values, stacked vertically:**
- RFC emisor
- Nombre emisor
- Folio
- RFC receptor
- Nombre receptor
- Código postal del receptor (4.0 only, conditional)
- Régimen fiscal receptor (description, 4.0 only, conditional)
- Uso CFDI (description)

**Right column — labels and values, stacked vertically:**
- Folio fiscal (UUID)
- No. de serie del CSD (NoCertificado)
- Serie
- Código postal, fecha y hora de emisión
- Efecto de comprobante (TipoDeComprobante description)
- Régimen fiscal (emisor description)
- Exportación (description, 4.0 only, conditional)

### Section 2: Conceptos Table

Table with columns: ClaveProdServ, NoIdentificacion, Cantidad, ClaveUnidad, Unidad, ValorUnitario, Importe, Descuento, ObjetoImp

Below each concept row:
- Description row spanning full width
- Tax sub-table: Impuesto, Tipo, Base, TipoFactor, TasaOCuota, Importe
- Número de pedimento / Número de cuenta predial (if present)

### Section 3: Payment Info + Totals

**Left side:**
- Moneda (description)
- Forma de pago (description)
- Método de pago (description)

**Right side:**
- Subtotal
- Descuento (if present at comprobante level)
- Impuestos trasladados (IVA X%) — amount
- Impuestos retenidos (if present) — amount
- Total

### Section 4: Digital Seals

- "Sello digital del CFDI:" + wrapped text of Sello
- "Sello digital del SAT:" + wrapped text of SelloSAT

Font size reduced for seals (they are very long strings).

### Section 5: QR + Certification Chain

**Left side:**
- QR code image (generated via qrcode-generator)

**Right side:**
- "Cadena Original del complemento de certificación digital del SAT:" + wrapped text
- RFC del proveedor de certificación
- No. de serie del certificado SAT
- Fecha y hora de certificación

**Cadena Original construction:** The cadena original is NOT stored in the XML. It is constructed from TFD attributes using the SAT template:
```
||{TFD.Version}|{UUID}|{FechaTimbrado}|{RfcProvCertif}|{SelloCFD}|{NoCertificadoSAT}||
```

### Section 6: Footer

- "Este documento es una representación impresa de un CFDI"
- "Página X de Y" (right-aligned)

### Multi-page Handling

Track `cursorY` position. Before drawing any section, check if remaining space is sufficient. If not, call `doc.addPage()` and reset `cursorY` to top margin. Footer rendered on every page using jsPDF's `putTotalPages('{total_pages}')` placeholder for the "de Y" part — render all content first, then iterate pages to stamp the footer with the correct total.

## QR Code Generation

SAT verification URL format:
```
https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id={UUID}&re={RFC_Emisor}&rr={RFC_Receptor}&tt={Total_18chars}&fe={last8_sello}
```

- `tt`: Total from raw XML (always positive, no sign flip) formatted as 18 characters with leading zeros and 6 decimal places (e.g., `000000000000868.000000`)
- `fe`: Last 8 characters of the Sello digital del CFDI

Generated using qrcode-generator library (kazuhikoarase):
```js
const qr = qrcode(0, 'M');
qr.addData(verificationUrl);
qr.make();
const dataUrl = qr.createDataURL(4); // cell size = 4px
```

Then embedded in the PDF via `doc.addImage(dataUrl, 'PNG', x, y, width, height)`.

## Raw XML Storage

`app.js` maintains a `Map` keyed by UUID:

```js
const xmlStore = new Map(); // uuid → xmlString
```

### Population Hook Points

1. **File load path** (`handleFiles`): After `parseCFDI(text, file.name)` returns successfully, call `xmlStore.set(result.uuid, text)`
2. **Paste path** (`parseBtn` click handler): After `parseCFDI(xml, 'pasted-xml')` returns successfully, call `xmlStore.set(result.uuid, xml)`

### Cleanup Hook Points (in `grid.js`, not `app.js`)

3. **Clear all** (`clearData()` in `grid.js`): Call `xmlStore.clear()`
4. **Remove selected** (`removeSelectedRows()` in `grid.js`): Capture UUIDs of selected rows **before** the `allRows.filter(...)` call, then delete each from `xmlStore`. This is needed because `selectedRows.clear()` runs after the filter, losing the references.

```js
// Example: capture before filtering
const removedUuids = [...selectedRows].map(row => row.uuid);
allRows = allRows.filter(row => !selectedRows.has(row));
selectedRows.clear();
removedUuids.forEach(uuid => xmlStore.delete(uuid));
```

Note: `xmlStore` must be accessible from the grid module scope (e.g., passed in during initialization or stored at bundle-level scope).

## UI Integration

### Per-row PDF button (`grid.js`)

- New column at the end of the grid: narrow, no header text, contains a button
- Button text: "PDF"
- On click: calls `generateAndDownloadPDF(uuid)` which retrieves XML from `xmlStore`, parses, generates PDF, triggers download

### Toolbar button (`grid.js` + `app.js`)

- New button "Imprimir Seleccionados" in toolbar right section, next to export buttons
- Styled as `toolbar__btn--primary`
- Disabled when no rows selected (same logic as "Exportar Seleccionados")
- On click: generates PDFs for all selected UUIDs, packages in ZIP, triggers download

### Download Logic

**Single PDF:**
```js
const blob = doc.output('blob');
const url = URL.createObjectURL(blob);
// trigger download with filename {UUID}.pdf via hidden <a> element
```

**Multiple PDFs (ZIP):**
```js
const zip = new JSZip();
for (const { uuid, blob } of pdfs) {
    zip.file(`${uuid}.pdf`, blob);
}
const zipBlob = await zip.generateAsync({ type: 'blob' });
// trigger download with filename CFDIs_{date}.zip
```

## Flow Summary

```
User clicks "PDF" (row) or "Imprimir Seleccionados" (toolbar)
  │
  ├─ Get raw XML(s) from xmlStore by UUID
  │
  ├─ For each XML:
  │   ├─ cfdi-print-parser.js → extract all fields (no sign adjustment)
  │   ├─ Build SAT verification URL (tt from raw Total)
  │   ├─ Construct cadena original from TFD attributes
  │   ├─ qrcode-generator → generate QR as data URL
  │   ├─ pdf-generator.js → build PDF with jsPDF
  │   │   ├─ Draw header (two columns, conditional 4.0-only fields)
  │   │   ├─ Draw conceptos table with tax sub-tables
  │   │   ├─ Draw payment + totals (including Descuento and Retenciones if present)
  │   │   ├─ Draw digital seals (wrapped text, reduced font)
  │   │   ├─ Draw QR + cadena original + certification data
  │   │   ├─ Stamp footer on all pages using putTotalPages
  │   │   └─ Handle page breaks when cursorY exceeds margin
  │   └─ Return PDF blob
  │
  ├─ If single CFDI:
  │   └─ Download as {UUID}.pdf
  │
  └─ If multiple:
      ├─ JSZip packages all blobs
      └─ Download as CFDIs_{date}.zip
```
