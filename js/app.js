import { parseCFDI } from './cfdi-parser.js';
import { initGrid, setData, getVisibleRows, getAllRows, getSortState, getColumns, setColumnVisibility, getColumnVisibility } from './grid.js';
import { exportToXlsx } from './export.js';

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
});

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
        pasteInput.value = '';
    } else {
        showWarning('El XML pegado no es un CFDI válido o tiene errores de formato.');
    }
});

// Export
exportAllBtn.addEventListener('click', () => {
    exportToXlsx(getAllRows(), getSortState());
});

exportFilteredBtn.addEventListener('click', () => {
    exportToXlsx(getVisibleRows(), getSortState());
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
