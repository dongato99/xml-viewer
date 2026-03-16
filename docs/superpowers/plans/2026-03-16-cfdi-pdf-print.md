# CFDI PDF Print Feature — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PDF generation and download for CFDI invoices, with per-row and bulk-print actions, QR code, and ZIP packaging.

**Architecture:** New `cfdi-print-parser.js` extracts all XML fields; `pdf-generator.js` draws the PDF with jsPDF. Raw XML strings stored in a Map by UUID. Three new libraries (jsPDF, qrcode-generator, JSZip) loaded as UMD globals. All new code integrated into `bundle.js`.

**Tech Stack:** Vanilla JS, jsPDF (~300KB), qrcode-generator (~30KB), JSZip (~25KB)

**Important codebase note:** The individual source files (`js/app.js`, `js/grid.js`, etc.) are **out of sync** with `js/bundle.js`. The bundle is the authoritative runtime — it contains features (row selection, confirm dialog, bulk actions) not present in the individual source files. All modifications must target `bundle.js` as the primary file. Individual source files should also be updated for maintainability, but `bundle.js` is what the app loads.

**Spec:** `docs/superpowers/specs/2026-03-16-cfdi-pdf-print-design.md`

---

## Chunk 1: Libraries and SAT Catalogs

### Task 1: Download and add third-party libraries

**Files:**
- Create: `lib/jspdf.umd.min.js`
- Create: `lib/qrcode.min.js` (qrcode-generator by kazuhikoarase)
- Create: `lib/jszip.min.js`

- [ ] **Step 1: Download jsPDF UMD bundle**

Download from CDN and save to `lib/`:
```bash
curl -L "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js" -o lib/jspdf.umd.min.js
```

Verify it defines `window.jspdf` by checking the first few characters contain "jspdf".

- [ ] **Step 2: Download qrcode-generator**

```bash
curl -L "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js" -o lib/qrcode.min.js
```

Verify it defines `window.qrcode` function.

- [ ] **Step 3: Download JSZip**

```bash
curl -L "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js" -o lib/jszip.min.js
```

Verify it defines `window.JSZip`.

- [ ] **Step 4: Add script tags to index.html**

Modify `index.html` — add before the existing `bundle.js` script tag (line 76):

```html
    <script src="lib/jspdf.umd.min.js"></script>
    <script src="lib/qrcode.min.js"></script>
    <script src="lib/jszip.min.js"></script>
    <script src="lib/xlsx.full.min.js"></script>
    <script src="js/bundle.js"></script>
```

The existing `xlsx.full.min.js` tag stays in place. New libraries go before it.

- [ ] **Step 5: Verify libraries load**

Open `index.html` in a browser. Open the console and verify:
```js
typeof jspdf          // "object"
typeof qrcode         // "function"
typeof JSZip          // "function"
```

- [ ] **Step 6: Commit**

```bash
git add lib/jspdf.umd.min.js lib/qrcode.min.js lib/jszip.min.js index.html
git commit -m "chore: add jsPDF, qrcode-generator, and JSZip libraries"
```

---

### Task 2: Add new SAT catalog lookups

**Files:**
- Modify: `js/sat-catalogs.js` (add 3 new lookup functions at end)
- Modify: `js/bundle.js:5-72` (mirror changes in bundle's sat-catalogs section)

- [ ] **Step 1: Add catalog constants and lookup functions to `js/sat-catalogs.js`**

Append before the closing of the file (after line 98):

```js
export const EXPORTACION = {
    '01': 'No aplica',
    '02': 'Definitiva',
    '03': 'Temporal',
    '04': 'Definitiva con clave A1',
};

export const OBJETO_IMP = {
    '01': 'No objeto de impuesto',
    '02': 'Sí objeto de impuesto.',
    '03': 'Sí objeto del impuesto y no obligado al desglose',
    '04': 'Sí objeto del impuesto y no causa impuesto',
};

export const METODO_PAGO = {
    'PUE': 'Pago en una sola exhibición',
    'PPD': 'Pago en parcialidades o diferido',
};

export function lookupExportacion(code) {
    return EXPORTACION[code] || code || '';
}

export function lookupObjetoImp(code) {
    return OBJETO_IMP[code] || code || '';
}

export function lookupMetodoPago(code) {
    return METODO_PAGO[code] || code || '';
}
```

- [ ] **Step 2: Mirror catalog additions in `js/bundle.js`**

In `bundle.js`, after the `lookupRegimenFiscal` function (around line 72), add the same constants and functions (without `export` keywords since bundle uses IIFE scope):

```js
const EXPORTACION = {
    '01': 'No aplica',
    '02': 'Definitiva',
    '03': 'Temporal',
    '04': 'Definitiva con clave A1',
};

const OBJETO_IMP = {
    '01': 'No objeto de impuesto',
    '02': 'Sí objeto de impuesto.',
    '03': 'Sí objeto del impuesto y no obligado al desglose',
    '04': 'Sí objeto del impuesto y no causa impuesto',
};

const METODO_PAGO = {
    'PUE': 'Pago en una sola exhibición',
    'PPD': 'Pago en parcialidades o diferido',
};

function lookupExportacion(code) {
    return EXPORTACION[code] || code || '';
}

function lookupObjetoImp(code) {
    return OBJETO_IMP[code] || code || '';
}

function lookupMetodoPago(code) {
    return METODO_PAGO[code] || code || '';
}
```

Also add the `USO_CFDI` constant and `lookupUsoCFDI` function to `bundle.js` (they exist in `sat-catalogs.js` but were omitted from the bundle):

```js
const USO_CFDI = {
    'G01': 'Adquisición de mercancías',
    'G02': 'Devoluciones, descuentos o bonificaciones',
    'G03': 'Gastos en general',
    'I01': 'Construcciones',
    'I02': 'Mobiliario y equipo de oficina por inversiones',
    'I03': 'Equipo de transporte',
    'I04': 'Equipo de cómputo y accesorios',
    'I05': 'Dados, troqueles, moldes, matrices y herramental',
    'I06': 'Comunicaciones telefónicas',
    'I07': 'Comunicaciones satelitales',
    'I08': 'Otra maquinaria y equipo',
    'D01': 'Honorarios médicos, dentales y gastos hospitalarios',
    'D02': 'Gastos médicos por incapacidad o discapacidad',
    'D03': 'Gastos funerales',
    'D04': 'Donativos',
    'D05': 'Intereses reales efectivamente pagados por créditos hipotecarios',
    'D06': 'Aportaciones voluntarias al SAR',
    'D07': 'Primas por seguros de gastos médicos',
    'D08': 'Gastos de transportación escolar obligatoria',
    'D09': 'Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones',
    'D10': 'Pagos por servicios educativos (colegiaturas)',
    'S01': 'Sin efectos fiscales',
    'CP01': 'Pagos',
    'CN01': 'Nómina',
};

function lookupUsoCFDI(code) {
    return USO_CFDI[code] || code || '';
}
```

- [ ] **Step 3: Commit**

```bash
git add js/sat-catalogs.js js/bundle.js
git commit -m "feat: add Exportacion, ObjetoImp, MetodoPago SAT catalog lookups"
```

---

## Chunk 2: CFDI Print Parser

### Task 3: Create `js/cfdi-print-parser.js`

**Files:**
- Create: `js/cfdi-print-parser.js`

This parser extracts ALL CFDI fields needed for the PDF. It reads raw XML values without sign adjustment.

- [ ] **Step 1: Create the print parser file**

Create `js/cfdi-print-parser.js` with the full parser:

```js
import { lookupFormaPago, lookupTipoComprobante, lookupRegimenFiscal, lookupUsoCFDI, lookupExportacion, lookupObjetoImp, lookupMetodoPago } from './sat-catalogs.js';

const NS_CFDI_40 = 'http://www.sat.gob.mx/cfd/4';
const NS_CFDI_33 = 'http://www.sat.gob.mx/cfd/3';
const NS_TFD = 'http://www.sat.gob.mx/TimbreFiscalDigital';

/**
 * Parse a CFDI XML string into a full structured object for PDF rendering.
 * Returns null on parse errors.
 * All numeric values are raw from XML (no sign adjustment for Egresos).
 */
export function parseCFDIForPrint(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    if (doc.querySelector('parsererror')) return null;

    let ns = NS_CFDI_40;
    let comprobante = doc.getElementsByTagNameNS(ns, 'Comprobante')[0];
    if (!comprobante) {
        ns = NS_CFDI_33;
        comprobante = doc.getElementsByTagNameNS(ns, 'Comprobante')[0];
    }
    if (!comprobante) return null;

    const attr = (el, name) => el?.getAttribute(name) || '';
    const version = attr(comprobante, 'Version');

    // Emisor
    const emisorEl = doc.getElementsByTagNameNS(ns, 'Emisor')[0];
    const emisor = {
        rfc: attr(emisorEl, 'Rfc'),
        nombre: attr(emisorEl, 'Nombre'),
        regimenFiscal: attr(emisorEl, 'RegimenFiscal'),
        regimenFiscalDesc: lookupRegimenFiscal(attr(emisorEl, 'RegimenFiscal')),
    };

    // Receptor
    const receptorEl = doc.getElementsByTagNameNS(ns, 'Receptor')[0];
    const receptor = {
        rfc: attr(receptorEl, 'Rfc'),
        nombre: attr(receptorEl, 'Nombre'),
        usoCFDI: attr(receptorEl, 'UsoCFDI'),
        usoCFDIDesc: lookupUsoCFDI(attr(receptorEl, 'UsoCFDI')),
        regimenFiscalReceptor: attr(receptorEl, 'RegimenFiscalReceptor'),
        regimenFiscalReceptorDesc: lookupRegimenFiscal(attr(receptorEl, 'RegimenFiscalReceptor')),
        domicilioFiscalReceptor: attr(receptorEl, 'DomicilioFiscalReceptor'),
    };

    // Conceptos
    const conceptoEls = doc.getElementsByTagNameNS(ns, 'Concepto');
    const conceptos = [];
    for (let i = 0; i < conceptoEls.length; i++) {
        const c = conceptoEls[i];
        const concepto = {
            claveProdServ: attr(c, 'ClaveProdServ'),
            noIdentificacion: attr(c, 'NoIdentificacion'),
            cantidad: attr(c, 'Cantidad'),
            claveUnidad: attr(c, 'ClaveUnidad'),
            unidad: attr(c, 'Unidad'),
            descripcion: attr(c, 'Descripcion'),
            valorUnitario: attr(c, 'ValorUnitario'),
            importe: attr(c, 'Importe'),
            descuento: attr(c, 'Descuento'),
            objetoImp: attr(c, 'ObjetoImp'),
            objetoImpDesc: lookupObjetoImp(attr(c, 'ObjetoImp')),
            impuestos: [],
        };

        // Per-concept taxes
        const impuestosEl = c.getElementsByTagNameNS(ns, 'Impuestos')[0];
        if (impuestosEl) {
            const traslados = impuestosEl.getElementsByTagNameNS(ns, 'Traslado');
            for (let j = 0; j < traslados.length; j++) {
                const t = traslados[j];
                concepto.impuestos.push({
                    tipo: 'Traslado',
                    impuesto: attr(t, 'Impuesto'),
                    base: attr(t, 'Base'),
                    tipoFactor: attr(t, 'TipoFactor'),
                    tasaOCuota: attr(t, 'TasaOCuota'),
                    importe: attr(t, 'Importe'),
                });
            }
            const retenciones = impuestosEl.getElementsByTagNameNS(ns, 'Retencion');
            for (let j = 0; j < retenciones.length; j++) {
                const r = retenciones[j];
                concepto.impuestos.push({
                    tipo: 'Retención',
                    impuesto: attr(r, 'Impuesto'),
                    base: attr(r, 'Base'),
                    tipoFactor: attr(r, 'TipoFactor'),
                    tasaOCuota: attr(r, 'TasaOCuota'),
                    importe: attr(r, 'Importe'),
                });
            }
        }

        // Numero de pedimento / Cuenta predial
        const pedimentoEl = c.getElementsByTagNameNS(ns, 'InformacionAduanera')[0];
        concepto.numeroPedimento = pedimentoEl ? attr(pedimentoEl, 'NumeroPedimento') : '';
        const predialEl = c.getElementsByTagNameNS(ns, 'CuentaPredial')[0];
        concepto.cuentaPredial = predialEl ? attr(predialEl, 'Numero') : '';

        conceptos.push(concepto);
    }

    // Comprobante-level Impuestos
    const impuestosEls = doc.getElementsByTagNameNS(ns, 'Impuestos');
    let totalImpuestosTrasladados = '';
    let totalImpuestosRetenidos = '';
    const trasladosSummary = [];
    const retencionesSummary = [];
    for (let i = 0; i < impuestosEls.length; i++) {
        const imp = impuestosEls[i];
        if (imp.parentElement !== comprobante) continue;
        totalImpuestosTrasladados = attr(imp, 'TotalImpuestosTrasladados');
        totalImpuestosRetenidos = attr(imp, 'TotalImpuestosRetenidos');

        const traslados = imp.getElementsByTagNameNS(ns, 'Traslado');
        for (let j = 0; j < traslados.length; j++) {
            const t = traslados[j];
            trasladosSummary.push({
                base: attr(t, 'Base'),
                impuesto: attr(t, 'Impuesto'),
                tipoFactor: attr(t, 'TipoFactor'),
                tasaOCuota: attr(t, 'TasaOCuota'),
                importe: attr(t, 'Importe'),
            });
        }

        const retenciones = imp.getElementsByTagNameNS(ns, 'Retencion');
        for (let j = 0; j < retenciones.length; j++) {
            const r = retenciones[j];
            retencionesSummary.push({
                impuesto: attr(r, 'Impuesto'),
                importe: attr(r, 'Importe'),
            });
        }
        break;
    }

    // TimbreFiscalDigital
    const tfdEl = doc.getElementsByTagNameNS(NS_TFD, 'TimbreFiscalDigital')[0];
    const tfd = {
        version: attr(tfdEl, 'Version'),
        uuid: attr(tfdEl, 'UUID'),
        fechaTimbrado: attr(tfdEl, 'FechaTimbrado'),
        rfcProvCertif: attr(tfdEl, 'RfcProvCertif'),
        selloCFD: attr(tfdEl, 'SelloCFD'),
        noCertificadoSAT: attr(tfdEl, 'NoCertificadoSAT'),
        selloSAT: attr(tfdEl, 'SelloSAT'),
    };

    // Build cadena original from TFD attributes
    const cadenaOriginal = `||${tfd.version}|${tfd.uuid}|${tfd.fechaTimbrado}|${tfd.rfcProvCertif}|${tfd.selloCFD}|${tfd.noCertificadoSAT}||`;

    const sello = attr(comprobante, 'Sello');
    const formaPago = attr(comprobante, 'FormaPago');
    const metodoPago = attr(comprobante, 'MetodoPago');
    const tipoDeComprobante = attr(comprobante, 'TipoDeComprobante');
    const exportacion = attr(comprobante, 'Exportacion');

    return {
        version,
        serie: attr(comprobante, 'Serie'),
        folio: attr(comprobante, 'Folio'),
        fecha: attr(comprobante, 'Fecha'),
        sello,
        formaPago,
        formaPagoDesc: lookupFormaPago(formaPago),
        noCertificado: attr(comprobante, 'NoCertificado'),
        subTotal: attr(comprobante, 'SubTotal'),
        descuento: attr(comprobante, 'Descuento'),
        moneda: attr(comprobante, 'Moneda'),
        tipoCambio: attr(comprobante, 'TipoCambio'),
        total: attr(comprobante, 'Total'),
        tipoDeComprobante,
        tipoDeComprobanteDesc: lookupTipoComprobante(tipoDeComprobante),
        metodoPago,
        metodoPagoDesc: lookupMetodoPago(metodoPago),
        lugarExpedicion: attr(comprobante, 'LugarExpedicion'),
        exportacion,
        exportacionDesc: lookupExportacion(exportacion),
        emisor,
        receptor,
        conceptos,
        totalImpuestosTrasladados,
        totalImpuestosRetenidos,
        trasladosSummary,
        retencionesSummary,
        tfd,
        cadenaOriginal,
    };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/cfdi-print-parser.js
git commit -m "feat: add full CFDI print parser for PDF generation"
```

---

## Chunk 3: PDF Generator

### Task 4: Create `js/pdf-generator.js`

**Files:**
- Create: `js/pdf-generator.js`

This file uses jsPDF to draw the complete CFDI printed representation. It relies on the global `jspdf` and `qrcode` objects loaded via script tags.

- [ ] **Step 1: Create the PDF generator file**

Create `js/pdf-generator.js`. The file exports a single function `generateCFDIPdf(data)` that takes the parsed print data and returns a jsPDF document blob.

Key implementation details:
- Page size: Letter (215.9 x 279.4 mm)
- Margins: 15mm all sides
- Font: Helvetica (built into jsPDF)
- Track `cursorY` for vertical positioning
- `checkPageBreak(neededHeight)` — if `cursorY + neededHeight > pageHeight - bottomMargin`, add new page
- Labels in bold (font style 'bold'), values in normal
- Two-column header using left half / right half of page width
- Tables drawn with `doc.rect()` for borders and `doc.text()` for content
- Seals in font size 6 with `doc.splitTextToSize()` for wrapping
- Footer stamped on all pages using `putTotalPages` placeholder

The function structure:

```js
function generateCFDIPdf(data) {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();   // 215.9
    const pageHeight = doc.internal.pageSize.getHeight();  // 279.4
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let y = margin;
    // Helper: check page break
    function checkPageBreak(needed) {
        if (y + needed > pageHeight - margin - 10) {
            doc.addPage();
            y = margin;
        }
    }

    // Helper: draw label-value pair
    function drawLabelValue(x, label, value, maxWidth) { ... }

    // Helper: format tax rate as percentage
    function formatTaxRate(tasaOCuota) { ... }

    // Helper: format impuesto code to name
    function impuestoName(code) { ... }  // 001=ISR, 002=IVA, 003=IEPS

    // Section 1: Header (two columns)
    drawHeader(data);

    // Section 2: Conceptos table
    drawConceptos(data.conceptos);

    // Section 3: Payment info + totals
    drawPaymentAndTotals(data);

    // Section 4: Digital seals
    drawSeals(data);

    // Section 5: QR + certification
    drawQRAndCertification(data);

    // Stamp footer on all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Este documento es una representación impresa de un CFDI', margin, pageHeight - 8);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    return doc.output('blob');
}
```

Full implementation should include:

**drawHeader(data):**
- Left column (x=margin, width=contentWidth/2):
  - "RFC emisor:" + data.emisor.rfc
  - "Nombre emisor:" + data.emisor.nombre
  - "Folio:" + data.folio
  - "RFC receptor:" + data.receptor.rfc
  - "Nombre receptor:" + data.receptor.nombre
  - If data.receptor.domicilioFiscalReceptor: "Código postal del receptor:" + value
  - If data.receptor.regimenFiscalReceptorDesc: "Régimen fiscal receptor:" + value
  - "Uso CFDI:" + data.receptor.usoCFDIDesc
- Right column (x=margin + contentWidth/2, width=contentWidth/2):
  - "Folio fiscal:" + data.tfd.uuid
  - "No. de serie del CSD:" + data.noCertificado
  - "Serie:" + data.serie
  - "Código postal, fecha y hora de emisión:" + data.lugarExpedicion + " " + data.fecha
  - "Efecto de comprobante:" + data.tipoDeComprobanteDesc
  - "Régimen fiscal:" + data.emisor.regimenFiscalDesc
  - If data.exportacionDesc: "Exportación:" + value

**drawConceptos(conceptos):**
- Title "Conceptos" in bold
- Table header row with gray background: ClaveProdServ | NoIdentificacion | Cantidad | ClaveUnidad | Unidad | ValorUnitario | Importe | Descuento | ObjetoImp
- For each concepto:
  - Data row with values
  - Description row (full width, merged)
  - If concepto.impuestos.length > 0: tax sub-table with header Impuesto | Tipo | Base | TipoFactor | TasaOCuota | Importe
  - If numeroPedimento or cuentaPredial: row with those values

**drawPaymentAndTotals(data):**
- Left side: Moneda, Forma de pago, Método de pago (label: value pairs)
- Right side: box with Subtotal, Descuento (if present), Impuestos trasladados per rate, Impuestos retenidos (if present), Total

**drawSeals(data):**
- "Sello digital del CFDI:" in bold, then wrapped text at font size 6
- "Sello digital del SAT:" in bold, then wrapped text at font size 6

**drawQRAndCertification(data):**
- Generate QR data URL using qrcode-generator
- SAT verification URL: `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id={UUID}&re={RFC_Emisor}&rr={RFC_Receptor}&tt={Total_18chars}&fe={last8_sello}`
- tt format: pad Total to 18 chars with leading zeros, 6 decimal places
- fe: last 8 chars of data.sello
- Left: QR image (40x40mm)
- Right: cadena original (wrapped, font size 6), RFC proveedor, No. serie SAT, Fecha timbrado

- [ ] **Step 2: Commit**

```bash
git add js/pdf-generator.js
git commit -m "feat: add PDF generator for CFDI printed representation"
```

---

## Chunk 4: UI Integration

### Task 5: Add xmlStore and wire PDF generation into `bundle.js`

**Files:**
- Modify: `js/bundle.js`

This task adds:
1. The `xmlStore` Map at bundle scope
2. The print parser code (from cfdi-print-parser.js, without exports)
3. The PDF generator code (from pdf-generator.js, without exports)
4. PDF button in each grid row
5. "Imprimir Seleccionados" toolbar button
6. xmlStore population in handleFiles and paste handlers
7. xmlStore cleanup in clearData and removeSelectedRows
8. Download helper (single PDF and ZIP)

- [ ] **Step 1: Add xmlStore declaration**

In `bundle.js`, in the `// === grid.js ===` section, after `const selectedRows = new Set();` (line 221), add:

```js
const xmlStore = new Map(); // uuid → raw XML string
```

This placement ensures `xmlStore` is in scope for both `clearData()` and `removeSelectedRows()` (which are in the grid section) and for the app section functions that populate it.

- [ ] **Step 2: Add xmlStore population in handleFiles**

In `bundle.js`, inside `handleFiles` (around line 784), after `rows.push(result);`, also store the raw XML:

```js
} else if (result) {
    rows.push(result);
    xmlStore.set(result.uuid, text);  // <-- add this line
} else {
```

- [ ] **Step 3: Add xmlStore population in paste handler**

In `bundle.js`, inside the `parseBtn` click handler (around line 700-701), after `addRows([result]);`, store the XML:

```js
} else if (result) {
    addRows([result]);
    xmlStore.set(result.uuid, xml);  // <-- add this line
    pasteInput.value = '';
} else {
```

- [ ] **Step 4: Add xmlStore cleanup in clearData**

In `bundle.js`, inside `clearData()` (around line 257), add `xmlStore.clear();` at the beginning of the function:

```js
function clearData() {
    xmlStore.clear();  // <-- add this line
    allRows = [];
    ...
}
```

- [ ] **Step 5: Add xmlStore cleanup in removeSelectedRows**

In `bundle.js`, modify `removeSelectedRows()` (around line 274) to capture UUIDs before filtering:

```js
function removeSelectedRows() {
    const removedUuids = [...selectedRows].map(row => row.uuid);  // <-- add
    allRows = allRows.filter(row => !selectedRows.has(row));
    selectedRows.clear();
    removedUuids.forEach(uuid => xmlStore.delete(uuid));  // <-- add
    applySort();
    applyFilters();
    fireSelectionChange();
}
```

- [ ] **Step 6: Add print parser code to bundle.js**

After the existing `// === cfdi-parser.js ===` section in bundle.js (after line 185), add a new section:

```js
// === cfdi-print-parser.js ===
```

Paste the full `parseCFDIForPrint` function from Task 3, removing `import` and `export` keywords (the lookup functions are already in bundle scope). **IMPORTANT:** Also remove the three `const NS_CFDI_40`, `const NS_CFDI_33`, `const NS_TFD` declarations from the pasted code — these constants already exist in the `cfdi-parser.js` section (lines 76-78) and re-declaring them with `const` in the same IIFE scope will cause a `SyntaxError`.

- [ ] **Step 7: Add PDF generator code to bundle.js**

After the print parser section, add:

```js
// === pdf-generator.js ===
```

Paste the full `generateCFDIPdf` function from Task 4 (without `export`).

- [ ] **Step 8: Add download helpers to bundle.js**

In the app section of bundle.js, add download functions:

```js
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function generateAndDownloadPDF(uuid) {
    const xml = xmlStore.get(uuid);
    if (!xml) {
        showWarning('No se encontró el XML original para este CFDI.');
        return;
    }
    const data = parseCFDIForPrint(xml);
    if (!data) {
        showWarning('Error al parsear el XML para impresión.');
        return;
    }
    const blob = generateCFDIPdf(data);
    downloadBlob(blob, `${uuid}.pdf`);
}

async function generateAndDownloadSelectedPDFs() {
    const selected = getSelectedRows();
    if (selected.length === 0) return;

    if (selected.length === 1) {
        await generateAndDownloadPDF(selected[0].uuid);
        return;
    }

    const zip = new JSZip();
    let count = 0;
    for (const row of selected) {
        const xml = xmlStore.get(row.uuid);
        if (!xml) continue;
        const data = parseCFDIForPrint(xml);
        if (!data) continue;
        const blob = generateCFDIPdf(data);
        zip.file(`${row.uuid}.pdf`, blob);
        count++;
    }

    if (count === 0) {
        showWarning('No se pudo generar ningún PDF.');
        return;
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    downloadBlob(zipBlob, `CFDIs_${dateStr}.zip`);
}
```

- [ ] **Step 9: Commit**

```bash
git add js/bundle.js
git commit -m "feat: add xmlStore, print parser, and PDF generator to bundle"
```

---

### Task 6: Add PDF button to grid rows

**Files:**
- Modify: `js/bundle.js` (renderBody function around line 429)

- [ ] **Step 1: Add PDF button cell in renderBody**

In the `renderBody` function in `bundle.js`, after the COLUMNS forEach loop (after `tr.appendChild(td);` on line 468), and before `tbody.appendChild(tr);` (line 470), add a PDF button cell:

```js
        // PDF button cell
        const pdfTd = document.createElement('td');
        pdfTd.className = 'pdf-col';
        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'pdf-btn';
        pdfBtn.textContent = 'PDF';
        pdfBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            generateAndDownloadPDF(row.uuid);
        });
        pdfTd.appendChild(pdfBtn);
        tr.appendChild(pdfTd);
```

- [ ] **Step 2: Add PDF column header in renderHead**

In `renderHead`, **after** the COLUMNS forEach loop closes (after line 330's closing `});`) and **before** `thead.appendChild(headerRow)` (line 331), add an empty header for the PDF column:

```js
    // PDF column header (empty)
    const pdfTh = document.createElement('th');
    pdfTh.className = 'pdf-col';
    pdfTh.textContent = '';
    pdfTh.style.cursor = 'default';
    headerRow.appendChild(pdfTh);
```

Also in the filter row section, **after** the COLUMNS forEach loop closes (after line 353's closing `});`) and **before** `thead.appendChild(filterRow)` (line 354), add:

```js
    // Empty cell for PDF column in filter row
    const filterPdfTh = document.createElement('th');
    filterPdfTh.className = 'pdf-col';
    filterRow.appendChild(filterPdfTh);
```

- [ ] **Step 3: Commit**

```bash
git add js/bundle.js
git commit -m "feat: add per-row PDF download button in grid"
```

---

### Task 7: Add "Imprimir Seleccionados" toolbar button

**Files:**
- Modify: `index.html` (toolbar section)
- Modify: `js/bundle.js` (app section, event listeners)

- [ ] **Step 1: Add button to index.html toolbar**

In `index.html`, inside `<div class="toolbar__right">` (around line 42-48), add the print button after "Exportar Filtrado":

```html
                <button id="print-selected" class="toolbar__btn toolbar__btn--primary" disabled>Imprimir Seleccionados</button>
```

- [ ] **Step 2: Wire up the button in bundle.js**

In the app section of `bundle.js`, after the `exportSelectedBtn` DOM ref (around line 631), add:

```js
const printSelectedBtn = document.getElementById('print-selected');
```

In the `selectionCallback` (around line 662-667), add the print button state update:

```js
}, (count) => {
    clearSelectedBtn.disabled = count === 0;
    exportSelectedBtn.disabled = count === 0;
    printSelectedBtn.disabled = count === 0;  // <-- add
    clearSelectedBtn.textContent = count > 0 ? `Quitar Seleccionados (${count})` : 'Quitar Seleccionados';
    exportSelectedBtn.textContent = count > 0 ? `Exportar Seleccionados (${count})` : 'Exportar Seleccionados';
    printSelectedBtn.textContent = count > 0 ? `Imprimir Seleccionados (${count})` : 'Imprimir Seleccionados';  // <-- add
});
```

After the `exportSelectedBtn` click handler (around line 738), add:

```js
printSelectedBtn.addEventListener('click', () => {
    generateAndDownloadSelectedPDFs();
});
```

- [ ] **Step 3: Commit**

```bash
git add index.html js/bundle.js
git commit -m "feat: add bulk print toolbar button"
```

---

### Task 8: Add CSS styles for PDF button

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Add PDF button styles**

Append after the `.select-col` styles (around line 305), add:

```css
/* === PDF column === */
.pdf-col {
    width: 50px;
    min-width: 50px;
    text-align: center;
}

.pdf-btn {
    padding: 4px 10px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
    transition: background var(--transition);
}

.pdf-btn:hover {
    background: var(--accent-hover);
}
```

- [ ] **Step 2: Commit**

```bash
git add css/style.css
git commit -m "feat: add PDF button styles"
```

---

## Chunk 5: Testing and Final Bundle

### Task 9: Manual integration test

- [ ] **Step 1: Open the app and load a CFDI XML**

Open `index.html` in a browser. Load the sample XML `5AF7DF63-2312-4929-85E8-06E33C9C92AF.xml` (from the user's provided file).

Verify:
- Grid displays correctly with existing columns
- A "PDF" button appears at the end of each row
- "Imprimir Seleccionados" button appears in toolbar (disabled)

- [ ] **Step 2: Test single PDF download**

Click the "PDF" button on the loaded row.

Verify:
- A file `5AF7DF63-2312-4929-85E8-06E33C9C92AF.pdf` downloads
- Open the PDF and check:
  - Header shows RFC emisor (RDI841003QJ4), Nombre emisor (RADIOMOVIL DIPSA)
  - Receptor data shows RFC, Nombre, CP, Régimen fiscal, Uso CFDI
  - UUID matches, Serie FA, NoCertificado present
  - Conceptos table shows "Servicios de Telecomunicaciones"
  - Tax sub-table shows IVA Traslado 748.28 Tasa 16.00% 119.72
  - Totals: Subtotal $748.28, IVA 16.00% $119.72, Total $868.00
  - Moneda: Peso Mexicano, Forma de pago: Por definir, Método de pago: Pago en parcialidades o diferido
  - Sellos digitales present (long wrapped text)
  - QR code present
  - Cadena original present
  - Footer: "Este documento es una representación impresa de un CFDI"

- [ ] **Step 3: Test bulk PDF download**

Select the row checkbox. Verify "Imprimir Seleccionados (1)" button is enabled. Click it.

Verify single PDF downloads (not ZIP, since only 1 selected).

Load more XMLs if available. Select multiple and verify ZIP download with correct filename.

- [ ] **Step 4: Test clear and remove**

After loading XMLs, clear all. Verify no errors.
Reload, load XMLs, select some, remove selected. Verify no errors.

- [ ] **Step 5: Fix any issues found**

Address any layout, data, or functionality issues discovered during testing.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete CFDI PDF print feature with QR and ZIP support"
```
