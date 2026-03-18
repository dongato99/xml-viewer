import { parseCFDI } from './cfdi-parser.js';
import { parseCFDIForPrint } from './cfdi-print-parser.js';
import { generateCFDIPdf } from './pdf-generator.js';
import { parsePagoCFDI } from './cfdi-pago-parser.js';
import { parsePagoCFDIForPrint } from './cfdi-pago-print-parser.js';
import { generatePagoPdf } from './pago-pdf-generator.js';
import { createGrid } from './grid.js';
import { exportToXlsx } from './export.js';

// ============================================================
// Confirm dialog helper
// ============================================================
const confirmDialog = document.getElementById('confirm-dialog');
const confirmDialogMessage = document.getElementById('confirm-dialog-message');
const confirmDialogOk = document.getElementById('confirm-dialog-ok');
const confirmDialogCancel = document.getElementById('confirm-dialog-cancel');

function showConfirm(message) {
    return new Promise((resolve) => {
        confirmDialogMessage.textContent = message;
        confirmDialog.showModal();
        function cleanup() {
            confirmDialogOk.removeEventListener('click', onOk);
            confirmDialogCancel.removeEventListener('click', onCancel);
            confirmDialog.removeEventListener('cancel', onCancel);
        }
        function onOk() { cleanup(); confirmDialog.close(); resolve(true); }
        function onCancel() { cleanup(); confirmDialog.close(); resolve(false); }
        confirmDialogOk.addEventListener('click', onOk);
        confirmDialogCancel.addEventListener('click', onCancel);
        confirmDialog.addEventListener('cancel', onCancel);
    });
}

// ============================================================
// DOM refs
// ============================================================
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const pasteInput = document.getElementById('paste-input');
const parseBtn = document.getElementById('parse-btn');
const toolbar = document.getElementById('toolbar');
const gridContainer = document.getElementById('grid-container');
const statusBar = document.getElementById('status-bar');
const statusText = document.getElementById('status-text');
const rowCount = document.getElementById('row-count');
const exportAllBtn = document.getElementById('export-all');
const exportFilteredBtn = document.getElementById('export-filtered');
const exportSelectedBtn = document.getElementById('export-selected');
const clearAllBtn = document.getElementById('clear-all');
const clearSelectedBtn = document.getElementById('clear-selected');
const printSelectedBtn = document.getElementById('print-selected');
const columnsToggle = document.getElementById('columns-toggle');
const columnsDropdown = document.getElementById('columns-dropdown');
const warningsDiv = document.getElementById('warnings');
const themeToggle = document.getElementById('theme-toggle');

// ============================================================
// Theme
// ============================================================
function initTheme() {
    const saved = localStorage.getItem('cfdi-theme');
    const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('cfdi-theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', toggleTheme);
initTheme();

// ============================================================
// Unified Grid — all columns for both Facturas and Pagos
// ============================================================
const COLUMNS = [
    // Shared
    { key: 'fechaComprobante', label: 'Fecha Comprobante', type: 'text', rawKey: '_fechaRaw' },
    { key: 'serie', label: 'Serie', type: 'text' },
    { key: 'folio', label: 'Folio', type: 'text' },
    { key: 'rfcEmisor', label: 'RFC Emisor', type: 'text' },
    { key: 'nombreEmisor', label: 'Nombre Emisor', type: 'text' },
    { key: 'uuid', label: 'UUID', type: 'text' },
    { key: 'tipoComprobanteDesc', label: 'Tipo Comprobante', type: 'text' },
    // Facturas
    { key: 'moneda', label: 'Moneda', type: 'text' },
    { key: 'tipoCambio', label: 'Tipo Cambio', type: 'text' },
    { key: 'baseTraslado', label: 'Base Traslado', type: 'numeric' },
    { key: 'importeTraslado', label: 'Importe Traslado', type: 'numeric' },
    { key: 'total', label: 'Total', type: 'numeric' },
    { key: 'formaPago', label: 'Forma Pago', type: 'text' },
    { key: 'formaPagoDesc', label: 'Forma Pago Desc', type: 'text' },
    { key: 'usoCFDI', label: 'Uso CFDI', type: 'text' },
    { key: 'regimenFiscalReceptor', label: 'Régimen Fiscal Receptor', type: 'text' },
    { key: 'claveProdServDesc', label: 'Clave Prod/Serv Desc', type: 'text' },
    { key: 'estatus', label: 'Estatus', type: 'text' },
    { key: 'validez', label: 'Validez', type: 'text' },
    { key: 'versionComprobante', label: 'Versión Comprobante', type: 'text' },
    // Pagos
    { key: 'fechaPago', label: 'Fecha Pago', type: 'text', rawKey: '_fechaPagoRaw' },
    { key: 'formaPagoPagoDesc', label: 'Forma Pago (Pago)', type: 'text' },
    { key: 'monedaP', label: 'Moneda Pago', type: 'text' },
    { key: 'montoPago', label: 'Monto Pago', type: 'numeric' },
    { key: 'numOperacion', label: 'Num Operación', type: 'text' },
    { key: 'rfcReceptor', label: 'RFC Receptor', type: 'text' },
    { key: 'nombreReceptor', label: 'Receptor', type: 'text' },
    { key: 'uuidDocRel', label: 'UUID Doc Rel', type: 'text' },
    { key: 'folioDocRel', label: 'Folio DR', type: 'text' },
    { key: 'serieDocRel', label: 'Serie DR', type: 'text' },
    { key: 'numParcialidad', label: 'Parcialidad', type: 'numeric' },
    { key: 'monedaDR', label: 'Moneda DR', type: 'text' },
    { key: 'impSaldoAnt', label: 'Saldo Anterior', type: 'numeric' },
    { key: 'impPagado', label: 'Imp Pagado', type: 'numeric' },
    { key: 'impSaldoInsoluto', label: 'Saldo Insoluto', type: 'numeric' },
    { key: 'baseDR', label: 'Base IVA DR', type: 'numeric' },
    { key: 'importeDR', label: 'Importe IVA DR', type: 'numeric' },
];

const ROW_STYLES = [
    { field: 'tipoComprobanteDesc', value: 'Egreso', className: 'row--egreso' },
    { field: 'tipoComprobanteDesc', value: 'Pago', className: 'row--pago' },
];

const ROW_COLORS = [
    { field: 'tipoComprobanteDesc', value: 'Egreso', rgb: 'FF0000' },
    { field: 'tipoComprobanteDesc', value: 'Pago', rgb: '0000FF' },
];

const grid = createGrid({
    columns: COLUMNS,
    container: document.getElementById('app'),
    headId: 'grid-head',
    bodyId: 'grid-body',
    rowStyles: ROW_STYLES,
    onFilterChange: (visible, total) => {
        statusText.textContent = `Mostrando ${visible} de ${total} filas`;
        rowCount.textContent = `${total} filas cargadas`;
        exportFilteredBtn.disabled = visible === 0;
    },
    onSelectionChange: (count) => {
        clearSelectedBtn.disabled = count === 0;
        exportSelectedBtn.disabled = count === 0;
        printSelectedBtn.disabled = count === 0;
        clearSelectedBtn.textContent = count > 0 ? `Quitar Seleccionados (${count})` : 'Quitar Seleccionados';
        exportSelectedBtn.textContent = count > 0 ? `Exportar Seleccionados (${count})` : 'Exportar Seleccionados';
        printSelectedBtn.textContent = count > 0 ? `Imprimir Seleccionados (${count})` : 'Imprimir Seleccionados';
    },
    onPdfClick: (uuid) => {
        const xmlStore = grid.getXmlStore();
        const xml = xmlStore.get(uuid);
        if (!xml) return;
        const tipo = detectTipoComprobante(xml);
        if (tipo === 'P') {
            generateAndDownloadPDF(uuid, xmlStore, parsePagoCFDIForPrint, generatePagoPdf);
        } else {
            generateAndDownloadPDF(uuid, xmlStore, parseCFDIForPrint, generateCFDIPdf);
        }
    },
});

// ============================================================
// Toolbar buttons
// ============================================================
exportAllBtn.addEventListener('click', () => {
    exportToXlsx(grid.getAllRows(), grid.getColumns(), ROW_COLORS);
});

exportFilteredBtn.addEventListener('click', () => {
    exportToXlsx(grid.getVisibleRows(), grid.getColumns(), ROW_COLORS, grid.getColumnVisibility());
});

exportSelectedBtn.addEventListener('click', () => {
    exportToXlsx(grid.getSelectedRows(), grid.getColumns(), ROW_COLORS);
});

clearAllBtn.addEventListener('click', async () => {
    const total = grid.getAllRows().length;
    if (!await showConfirm(`¿Estás seguro de quitar las ${total} filas cargadas?`)) return;
    grid.clearData();
    toolbar.hidden = true;
    gridContainer.hidden = true;
    statusBar.hidden = true;
});

clearSelectedBtn.addEventListener('click', async () => {
    const count = grid.getSelectedRows().length;
    if (!await showConfirm(`¿Estás seguro de quitar ${count} fila${count !== 1 ? 's' : ''} seleccionada${count !== 1 ? 's' : ''}?`)) return;
    grid.removeSelectedRows();
    if (grid.getAllRows().length === 0) {
        toolbar.hidden = true;
        gridContainer.hidden = true;
        statusBar.hidden = true;
    }
});

printSelectedBtn.addEventListener('click', () => {
    generateAndDownloadSelectedPDFs();
});

// Column visibility
columnsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    columnsDropdown.hidden = !columnsDropdown.hidden;
    if (!columnsDropdown.hidden) {
        const vis = grid.getColumnVisibility();
        columnsDropdown.innerHTML = '';
        grid.getColumns().forEach(col => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = vis[col.key];
            checkbox.addEventListener('change', () => {
                grid.setColumnVisibility(col.key, checkbox.checked);
            });
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(col.label));
            columnsDropdown.appendChild(label);
        });
    }
});

columnsDropdown.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', () => { columnsDropdown.hidden = true; });

// ============================================================
// File input
// ============================================================
fileInput.addEventListener('change', (e) => {
    handleFiles(Array.from(e.target.files));
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.xml'));
    handleFiles(files);
});

dropZone.addEventListener('click', (e) => {
    if (e.target === fileInput || e.target.closest('.drop-zone__btn')) return;
    fileInput.click();
});

// ============================================================
// Paste
// ============================================================
parseBtn.addEventListener('click', () => {
    const xml = pasteInput.value.trim();
    if (!xml) return;
    processXML(xml, 'pasted-xml');
    pasteInput.value = '';
});

// ============================================================
// XML Routing
// ============================================================
function detectTipoComprobante(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    if (doc.querySelector('parsererror')) return null;

    const ns40 = 'http://www.sat.gob.mx/cfd/4';
    const ns33 = 'http://www.sat.gob.mx/cfd/3';
    let comp = doc.getElementsByTagNameNS(ns40, 'Comprobante')[0];
    if (!comp) comp = doc.getElementsByTagNameNS(ns33, 'Comprobante')[0];
    if (!comp) return null;
    return comp.getAttribute('TipoDeComprobante');
}

function processXML(xmlString, filename) {
    const tipo = detectTipoComprobante(xmlString);

    if (tipo === 'P') {
        const result = parsePagoCFDI(xmlString, filename);
        if (!result) {
            showWarning(`No se pudo parsear: ${filename}`);
            return;
        }
        if (result.error === 'pagos10_unsupported') {
            showWarning(`${filename}: Complemento de Pagos 1.0 no soportado. Solo se soporta Pagos 2.0 (CFDI 4.0).`);
            return;
        }
        if (result.error) {
            showWarning(`${filename}: ${result.error}`);
            return;
        }
        if (result.rows && result.rows.length > 0) {
            addRows(result.rows, result.uuid, xmlString);
        }
    } else {
        const result = parseCFDI(xmlString, filename);
        if (result && result.error) {
            showWarning(`${filename}: versión CFDI no soportada (${result.version})`);
            return;
        }
        if (result) {
            addRows([result], result.uuid, xmlString);
        } else {
            showWarning(`No se pudo parsear: ${filename}`);
        }
    }
}

async function handleFiles(files) {
    for (const file of files) {
        const text = await readFile(file);
        processXML(text, file.name);
    }
}

// ============================================================
// Add rows to grid
// ============================================================
function addRows(newRows, uuid, xmlString) {
    const existing = grid.getAllRows();
    const existingUUIDs = new Set(existing.map(r => r.uuid).filter(Boolean));

    // Dedup at XML level by Comprobante UUID
    if (uuid && existingUUIDs.has(uuid)) {
        showWarning('Todos los archivos ya están cargados (UUID duplicado).');
        return;
    }

    if (uuid) grid.getXmlStore().set(uuid, xmlString);
    grid.setData([...existing, ...newRows]);
    toolbar.hidden = false;
    gridContainer.hidden = false;
    statusBar.hidden = false;
}

// ============================================================
// PDF generation
// ============================================================
function generatePDFBlob(uuid, xmlStore, printParser, pdfGenerator) {
    const xml = xmlStore.get(uuid);
    if (!xml) return null;
    const data = printParser(xml);
    if (!data) return null;
    return pdfGenerator(data);
}

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

function generateAndDownloadPDF(uuid, xmlStore, printParser, pdfGenerator) {
    const blob = generatePDFBlob(uuid, xmlStore, printParser, pdfGenerator);
    if (blob) downloadBlob(blob, uuid + '.pdf');
}

async function generateAndDownloadSelectedPDFs() {
    const selected = grid.getSelectedRows();
    if (selected.length === 0) return;

    const xmlStore = grid.getXmlStore();

    // Deduplicate by UUID (Pagos rows share UUID)
    const uniqueUuids = [...new Set(selected.map(r => r.uuid).filter(Boolean))];

    if (uniqueUuids.length === 1) {
        const xml = xmlStore.get(uniqueUuids[0]);
        const tipo = detectTipoComprobante(xml);
        if (tipo === 'P') {
            generateAndDownloadPDF(uniqueUuids[0], xmlStore, parsePagoCFDIForPrint, generatePagoPdf);
        } else {
            generateAndDownloadPDF(uniqueUuids[0], xmlStore, parseCFDIForPrint, generateCFDIPdf);
        }
        return;
    }

    const zip = new JSZip();
    for (const uuid of uniqueUuids) {
        const xml = xmlStore.get(uuid);
        const tipo = detectTipoComprobante(xml);
        let blob;
        if (tipo === 'P') {
            blob = generatePDFBlob(uuid, xmlStore, parsePagoCFDIForPrint, generatePagoPdf);
        } else {
            blob = generatePDFBlob(uuid, xmlStore, parseCFDIForPrint, generateCFDIPdf);
        }
        if (blob) zip.file(uuid + '.pdf', blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filename = `CFDIs_${dateStr}.zip`;

    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(zipBlob);
            await writable.close();
            return;
        } catch (e) {
            if (e.name === 'AbortError') return;
        }
    }

    downloadBlob(zipBlob, filename);
}

// ============================================================
// Utilities
// ============================================================
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

function showWarning(message) {
    warningsDiv.hidden = false;
    const item = document.createElement('div');
    item.className = 'warnings__item';
    item.textContent = message;
    warningsDiv.appendChild(item);
    setTimeout(() => {
        item.remove();
        if (warningsDiv.children.length === 0) warningsDiv.hidden = true;
    }, 8000);
}
