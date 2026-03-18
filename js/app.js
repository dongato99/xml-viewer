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
// Shared DOM refs
// ============================================================
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const pasteInput = document.getElementById('paste-input');
const parseBtn = document.getElementById('parse-btn');
const warningsDiv = document.getElementById('warnings');
const themeToggle = document.getElementById('theme-toggle');

// ============================================================
// Tab switching
// ============================================================
let activeTab = 'facturas';
const tabBtns = document.querySelectorAll('.tabs__btn');
const tabContents = {
    facturas: document.getElementById('tab-facturas'),
    pagos: document.getElementById('tab-pagos'),
};

function switchTab(tab) {
    activeTab = tab;
    tabBtns.forEach(btn => {
        btn.classList.toggle('tabs__btn--active', btn.dataset.tab === tab);
    });
    Object.entries(tabContents).forEach(([key, el]) => {
        el.classList.toggle('tab-content--active', key === tab);
    });
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

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
// Facturas Grid
// ============================================================
const FACTURAS_COLUMNS = [
    { key: 'fechaComprobante', label: 'Fecha Comprobante', type: 'text', rawKey: '_fechaRaw' },
    { key: 'serie', label: 'Serie', type: 'text' },
    { key: 'folio', label: 'Folio', type: 'text' },
    { key: 'rfcEmisor', label: 'RFC Emisor', type: 'text' },
    { key: 'nombreEmisor', label: 'Nombre Emisor', type: 'text' },
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
    { key: 'uuid', label: 'UUID', type: 'text' },
    { key: 'estatus', label: 'Estatus', type: 'text' },
    { key: 'validez', label: 'Validez', type: 'text' },
    { key: 'tipoDocumento', label: 'Tipo Documento', type: 'text' },
    { key: 'versionComprobante', label: 'Versión Comprobante', type: 'text' },
    { key: 'tipoComprobanteDesc', label: 'Tipo Comprobante Desc', type: 'text' },
    { key: 'tipoComprobante', label: 'Tipo Comprobante', type: 'text' },
];

const facturasUI = {
    toolbar: document.getElementById('toolbar-facturas'),
    gridContainer: document.getElementById('grid-container-facturas'),
    statusBar: document.getElementById('status-bar-facturas'),
    statusText: document.getElementById('status-text-facturas'),
    rowCount: document.getElementById('row-count-facturas'),
    exportAll: document.getElementById('export-all-facturas'),
    exportFiltered: document.getElementById('export-filtered-facturas'),
    exportSelected: document.getElementById('export-selected-facturas'),
    clearAll: document.getElementById('clear-all-facturas'),
    clearSelected: document.getElementById('clear-selected-facturas'),
    printSelected: document.getElementById('print-selected-facturas'),
    columnsToggle: document.getElementById('columns-toggle-facturas'),
    columnsDropdown: document.getElementById('columns-dropdown-facturas'),
};

const facturasGrid = createGrid({
    columns: FACTURAS_COLUMNS,
    container: tabContents.facturas,
    headId: 'grid-head-facturas',
    bodyId: 'grid-body-facturas',
    egresoField: 'tipoComprobanteDesc',
    onFilterChange: (visible, total) => {
        facturasUI.statusText.textContent = `Mostrando ${visible} de ${total} filas`;
        facturasUI.rowCount.textContent = `${total} filas cargadas`;
        facturasUI.exportFiltered.disabled = visible === 0;
    },
    onSelectionChange: (count) => {
        facturasUI.clearSelected.disabled = count === 0;
        facturasUI.exportSelected.disabled = count === 0;
        facturasUI.printSelected.disabled = count === 0;
        facturasUI.clearSelected.textContent = count > 0 ? `Quitar Seleccionados (${count})` : 'Quitar Seleccionados';
        facturasUI.exportSelected.textContent = count > 0 ? `Exportar Seleccionados (${count})` : 'Exportar Seleccionados';
        facturasUI.printSelected.textContent = count > 0 ? `Imprimir Seleccionados (${count})` : 'Imprimir Seleccionados';
    },
    onPdfClick: (uuid) => generateAndDownloadPDF(uuid, facturasGrid.getXmlStore(), parseCFDIForPrint, generateCFDIPdf),
});

// ============================================================
// Pagos Grid
// ============================================================
const PAGOS_COLUMNS = [
    { key: 'fechaPago', label: 'Fecha Pago', type: 'text', rawKey: '_fechaPagoRaw' },
    { key: 'formaPagoDesc', label: 'Forma Pago', type: 'text' },
    { key: 'monedaP', label: 'Moneda Pago', type: 'text' },
    { key: 'montoPago', label: 'Monto Pago', type: 'numeric' },
    { key: 'numOperacion', label: 'Num Operación', type: 'text' },
    { key: 'rfcEmisor', label: 'RFC Emisor', type: 'text' },
    { key: 'nombreEmisor', label: 'Emisor', type: 'text' },
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
    { key: 'uuid', label: 'UUID Pago', type: 'text' },
    { key: 'serie', label: 'Serie', type: 'text' },
    { key: 'folio', label: 'Folio', type: 'text' },
    { key: 'fechaComprobante', label: 'Fecha Emisión', type: 'text', rawKey: '_fechaComprobanteRaw' },
];

const pagosUI = {
    toolbar: document.getElementById('toolbar-pagos'),
    gridContainer: document.getElementById('grid-container-pagos'),
    statusBar: document.getElementById('status-bar-pagos'),
    statusText: document.getElementById('status-text-pagos'),
    rowCount: document.getElementById('row-count-pagos'),
    exportAll: document.getElementById('export-all-pagos'),
    exportFiltered: document.getElementById('export-filtered-pagos'),
    exportSelected: document.getElementById('export-selected-pagos'),
    clearAll: document.getElementById('clear-all-pagos'),
    clearSelected: document.getElementById('clear-selected-pagos'),
    printSelected: document.getElementById('print-selected-pagos'),
    columnsToggle: document.getElementById('columns-toggle-pagos'),
    columnsDropdown: document.getElementById('columns-dropdown-pagos'),
};

const pagosGrid = createGrid({
    columns: PAGOS_COLUMNS,
    container: tabContents.pagos,
    headId: 'grid-head-pagos',
    bodyId: 'grid-body-pagos',
    onFilterChange: (visible, total) => {
        pagosUI.statusText.textContent = `Mostrando ${visible} de ${total} filas`;
        pagosUI.rowCount.textContent = `${total} filas cargadas`;
        pagosUI.exportFiltered.disabled = visible === 0;
    },
    onSelectionChange: (count) => {
        pagosUI.clearSelected.disabled = count === 0;
        pagosUI.exportSelected.disabled = count === 0;
        pagosUI.printSelected.disabled = count === 0;
        pagosUI.clearSelected.textContent = count > 0 ? `Quitar Seleccionados (${count})` : 'Quitar Seleccionados';
        pagosUI.exportSelected.textContent = count > 0 ? `Exportar Seleccionados (${count})` : 'Exportar Seleccionados';
        pagosUI.printSelected.textContent = count > 0 ? `Imprimir Seleccionados (${count})` : 'Imprimir Seleccionados';
    },
    onPdfClick: (uuid) => generateAndDownloadPDF(uuid, pagosGrid.getXmlStore(), parsePagoCFDIForPrint, generatePagoPdf),
});

// ============================================================
// Wire up toolbar buttons for both tabs
// ============================================================
function wireToolbar(ui, grid, printParser, pdfGenerator) {
    ui.exportAll.addEventListener('click', () => {
        exportToXlsx(grid.getAllRows(), grid.getColumns(), grid.getSortState());
    });

    ui.exportFiltered.addEventListener('click', () => {
        exportToXlsx(grid.getVisibleRows(), grid.getColumns(), grid.getSortState());
    });

    ui.exportSelected.addEventListener('click', () => {
        exportToXlsx(grid.getSelectedRows(), grid.getColumns(), grid.getSortState());
    });

    ui.clearAll.addEventListener('click', async () => {
        const total = grid.getAllRows().length;
        if (!await showConfirm(`¿Estás seguro de quitar las ${total} filas cargadas?`)) return;
        grid.clearData();
        ui.toolbar.hidden = true;
        ui.gridContainer.hidden = true;
        ui.statusBar.hidden = true;
    });

    ui.clearSelected.addEventListener('click', async () => {
        const count = grid.getSelectedRows().length;
        if (!await showConfirm(`¿Estás seguro de quitar ${count} fila${count !== 1 ? 's' : ''} seleccionada${count !== 1 ? 's' : ''}?`)) return;
        grid.removeSelectedRows();
        if (grid.getAllRows().length === 0) {
            ui.toolbar.hidden = true;
            ui.gridContainer.hidden = true;
            ui.statusBar.hidden = true;
        }
    });

    ui.printSelected.addEventListener('click', () => {
        generateAndDownloadSelectedPDFs(grid, printParser, pdfGenerator);
    });

    // Column visibility
    ui.columnsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        ui.columnsDropdown.hidden = !ui.columnsDropdown.hidden;
        if (!ui.columnsDropdown.hidden) {
            buildColumnsDropdown(ui.columnsDropdown, grid);
        }
    });

    ui.columnsDropdown.addEventListener('click', (e) => e.stopPropagation());
}

function buildColumnsDropdown(dropdown, grid) {
    const vis = grid.getColumnVisibility();
    dropdown.innerHTML = '';
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
        dropdown.appendChild(label);
    });
}

wireToolbar(facturasUI, facturasGrid, parseCFDIForPrint, generateCFDIPdf);
wireToolbar(pagosUI, pagosGrid, parsePagoCFDIForPrint, generatePagoPdf);

// Close dropdowns on outside click
document.addEventListener('click', () => {
    facturasUI.columnsDropdown.hidden = true;
    pagosUI.columnsDropdown.hidden = true;
});

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
    const tab = processXML(xml, 'pasted-xml');
    if (tab && tab !== 'error') switchTab(tab);
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
        // Pago
        const result = parsePagoCFDI(xmlString, filename);
        if (!result) {
            showWarning(`No se pudo parsear: ${filename}`);
            return 'error';
        }
        if (result.error === 'pagos10_unsupported') {
            showWarning(`${filename}: Complemento de Pagos 1.0 no soportado. Solo se soporta Pagos 2.0 (CFDI 4.0).`);
            return 'error';
        }
        if (result.error) {
            showWarning(`${filename}: ${result.error}`);
            return 'error';
        }
        if (result.rows && result.rows.length > 0) {
            addPagosRows(result.rows, result.uuid, xmlString);
        }
        return 'pagos';
    } else {
        // Facturas (I, E, T, N)
        const result = parseCFDI(xmlString, filename);
        if (result && result.error) {
            showWarning(`${filename}: versión CFDI no soportada (${result.version})`);
            return 'error';
        }
        if (result) {
            addFacturasRows([result], xmlString);
            return 'facturas';
        }
        showWarning(`No se pudo parsear: ${filename}`);
        return 'error';
    }
}

async function handleFiles(files) {
    let lastTab = null;
    for (const file of files) {
        const text = await readFile(file);
        const tab = processXML(text, file.name);
        if (tab && tab !== 'error') lastTab = tab;
    }
    if (lastTab) switchTab(lastTab);
}

// ============================================================
// Add rows to grids
// ============================================================
function addFacturasRows(newRows, xmlString) {
    const existing = facturasGrid.getAllRows();
    const existingUUIDs = new Set(existing.map(r => r.uuid).filter(Boolean));
    const unique = newRows.filter(r => !r.uuid || !existingUUIDs.has(r.uuid));

    if (unique.length === 0) {
        showWarning('Todos los archivos ya están cargados (UUID duplicado).');
        return;
    }

    unique.forEach(r => facturasGrid.getXmlStore().set(r.uuid, xmlString));
    facturasGrid.setData([...existing, ...unique]);
    facturasUI.toolbar.hidden = false;
    facturasUI.gridContainer.hidden = false;
    facturasUI.statusBar.hidden = false;
}

function addPagosRows(newRows, uuid, xmlString) {
    const existing = pagosGrid.getAllRows();
    const existingUUIDs = new Set(existing.map(r => r.uuid).filter(Boolean));

    // Dedup at XML level (by Comprobante UUID)
    if (existingUUIDs.has(uuid)) {
        showWarning('Todos los archivos ya están cargados (UUID duplicado).');
        return;
    }

    pagosGrid.getXmlStore().set(uuid, xmlString);
    pagosGrid.setData([...existing, ...newRows]);
    pagosUI.toolbar.hidden = false;
    pagosUI.gridContainer.hidden = false;
    pagosUI.statusBar.hidden = false;
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

async function generateAndDownloadSelectedPDFs(grid, printParser, pdfGenerator) {
    const selected = grid.getSelectedRows();
    if (selected.length === 0) return;

    const xmlStore = grid.getXmlStore();

    // Deduplicate by UUID (multiple rows may share same UUID in Pagos)
    const uniqueUuids = [...new Set(selected.map(r => r.uuid).filter(Boolean))];

    if (uniqueUuids.length === 1) {
        generateAndDownloadPDF(uniqueUuids[0], xmlStore, printParser, pdfGenerator);
        return;
    }

    const zip = new JSZip();
    for (const uuid of uniqueUuids) {
        const blob = generatePDFBlob(uuid, xmlStore, printParser, pdfGenerator);
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
