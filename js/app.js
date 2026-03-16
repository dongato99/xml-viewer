import { parseCFDI } from './cfdi-parser.js';
import { parseCFDIForPrint } from './cfdi-print-parser.js';
import { generateCFDIPdf } from './pdf-generator.js';
import { initGrid, setData, getVisibleRows, getAllRows, getSelectedRows, getSortState, getColumns, setColumnVisibility, getColumnVisibility, clearData, removeSelectedRows, xmlStore } from './grid.js';
import { exportToXlsx } from './export.js';

// Confirm dialog helper
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

// DOM refs
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
const clearAllBtn = document.getElementById('clear-all');
const clearSelectedBtn = document.getElementById('clear-selected');
const exportSelectedBtn = document.getElementById('export-selected');
const printSelectedBtn = document.getElementById('print-selected');
const columnsToggle = document.getElementById('columns-toggle');
const columnsDropdown = document.getElementById('columns-dropdown');
const warningsDiv = document.getElementById('warnings');
const themeToggle = document.getElementById('theme-toggle');

// Theme
function initTheme() {
    const saved = localStorage.getItem('cfdi-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
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

// Grid init
initGrid('grid-head', 'grid-body', (visible, total) => {
    statusText.textContent = `Mostrando ${visible} de ${total} filas`;
    rowCount.textContent = `${total} filas cargadas`;
    exportFilteredBtn.disabled = visible === 0;
}, (count) => {
    clearSelectedBtn.disabled = count === 0;
    exportSelectedBtn.disabled = count === 0;
    printSelectedBtn.disabled = count === 0;
    clearSelectedBtn.textContent = count > 0 ? `Quitar Seleccionados (${count})` : 'Quitar Seleccionados';
    exportSelectedBtn.textContent = count > 0 ? `Exportar Seleccionados (${count})` : 'Exportar Seleccionados';
    printSelectedBtn.textContent = count > 0 ? 'Imprimir Seleccionados (' + count + ')' : 'Imprimir Seleccionados';
}, generateAndDownloadPDF);

// File input
fileInput.addEventListener('change', (e) => {
    handleFiles(Array.from(e.target.files));
});

// Drag and drop
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

// Paste
parseBtn.addEventListener('click', () => {
    const xml = pasteInput.value.trim();
    if (!xml) return;
    const result = parseCFDI(xml, 'pasted-xml');
    if (result && result.error) {
        showWarning(`XML pegado: versión CFDI no soportada (${result.version})`);
    } else if (result) {
        addRows([result]);
        xmlStore.set(result.uuid, xml);
        pasteInput.value = '';
    } else {
        showWarning('El XML pegado no es un CFDI válido o tiene errores de formato.');
    }
});

// Export
exportAllBtn.addEventListener('click', () => {
    exportToXlsx(getAllRows());
});

exportFilteredBtn.addEventListener('click', () => {
    exportToXlsx(getVisibleRows(), true);
});

// Clear
clearAllBtn.addEventListener('click', async () => {
    const total = getAllRows().length;
    if (!await showConfirm(`¿Estás seguro de quitar las ${total} filas cargadas?`)) return;
    clearData();
    toolbar.hidden = true;
    gridContainer.hidden = true;
    statusBar.hidden = true;
});

clearSelectedBtn.addEventListener('click', async () => {
    const count = getSelectedRows().length;
    if (!await showConfirm(`¿Estás seguro de quitar ${count} fila${count !== 1 ? 's' : ''} seleccionada${count !== 1 ? 's' : ''}?`)) return;
    removeSelectedRows();
    if (getAllRows().length === 0) {
        toolbar.hidden = true;
        gridContainer.hidden = true;
        statusBar.hidden = true;
    }
});

exportSelectedBtn.addEventListener('click', () => {
    exportToXlsx(getSelectedRows());
});

// PDF generation
function generatePDFBlob(uuid) {
    const xml = xmlStore.get(uuid);
    if (!xml) return null;
    const data = parseCFDIForPrint(xml);
    if (!data) return null;
    return generateCFDIPdf(data);
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

function generateAndDownloadPDF(uuid) {
    const blob = generatePDFBlob(uuid);
    if (blob) downloadBlob(blob, uuid + '.pdf');
}

async function generateAndDownloadSelectedPDFs() {
    const selected = getSelectedRows();
    if (selected.length === 0) return;

    // Single PDF — direct download
    if (selected.length === 1) {
        generateAndDownloadPDF(selected[0].uuid);
        return;
    }

    // Multiple PDFs — bundle into ZIP
    const zip = new JSZip();
    for (const row of selected) {
        const blob = generatePDFBlob(row.uuid);
        if (blob) zip.file(row.uuid + '.pdf', blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Build filename from date
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filename = `CFDIs_${dateStr}.zip`;

    // Try File System Access API (no MOTW) with fallback to regular download
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
            if (e.name === 'AbortError') return; // user cancelled
            // fallback to regular download
        }
    }

    // Fallback: regular download (will have MOTW on Windows)
    downloadBlob(zipBlob, filename);
}

printSelectedBtn.addEventListener('click', () => {
    generateAndDownloadSelectedPDFs();
});

// Column visibility
columnsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    columnsDropdown.hidden = !columnsDropdown.hidden;
    if (!columnsDropdown.hidden) {
        buildColumnsDropdown();
    }
});

document.addEventListener('click', () => {
    columnsDropdown.hidden = true;
});

columnsDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
});

function buildColumnsDropdown() {
    const vis = getColumnVisibility();
    columnsDropdown.innerHTML = '';
    getColumns().forEach(col => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = vis[col.key];
        checkbox.addEventListener('change', () => {
            setColumnVisibility(col.key, checkbox.checked);
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(col.label));
        columnsDropdown.appendChild(label);
    });
}

// Core logic
async function handleFiles(files) {
    const rows = [];
    for (const file of files) {
        const text = await readFile(file);
        const result = parseCFDI(text, file.name);
        if (result && result.error) {
            if (result.error === 'unsupported_version') {
                showWarning(`${file.name}: versión CFDI no soportada (${result.version})`);
            } else {
                showWarning(`No se pudo parsear: ${file.name}`);
            }
        } else if (result) {
            rows.push(result);
            xmlStore.set(result.uuid, text);
        } else {
            showWarning(`No se pudo parsear: ${file.name}`);
        }
    }
    if (rows.length > 0) {
        addRows(rows);
    }
}

function addRows(newRows) {
    const existing = getAllRows();
    const existingUUIDs = new Set(existing.map(r => r.uuid).filter(Boolean));
    const unique = newRows.filter(r => !r.uuid || !existingUUIDs.has(r.uuid));

    if (unique.length === 0) {
        showWarning('Todos los archivos ya están cargados (UUID duplicado).');
        return;
    }

    setData([...existing, ...unique]);
    toolbar.hidden = false;
    gridContainer.hidden = false;
    statusBar.hidden = false;
}

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
