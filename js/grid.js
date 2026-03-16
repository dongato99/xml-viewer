// Column definitions — order matches spec
const COLUMNS = [
    { key: 'fechaComprobante', label: 'Fecha Comprobante', type: 'text' },
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

let allRows = [];
let filteredRows = [];
let sortState = { column: 'fechaComprobante', direction: 'desc' };
let filters = {};
let columnVisibility = {};
let onFilterChange = null;

export function getColumns() {
    return COLUMNS;
}

export function initGrid(headId, bodyId, statusCallback) {
    onFilterChange = statusCallback;
    COLUMNS.forEach(col => { columnVisibility[col.key] = true; });
    renderHead(headId);
}

export function setData(rows) {
    allRows = rows;
    applySort();
    applyFilters();
}

export function getVisibleRows() {
    return filteredRows;
}

export function getAllRows() {
    return allRows;
}

export function getSortState() {
    return { ...sortState };
}

export function getColumnVisibility() {
    return { ...columnVisibility };
}

export function setColumnVisibility(key, visible) {
    columnVisibility[key] = visible;
    refreshGrid();
}

function renderHead(headId) {
    const thead = document.getElementById(headId);

    // Header row
    const headerRow = document.createElement('tr');
    COLUMNS.forEach(col => {
        const th = document.createElement('th');
        th.dataset.key = col.key;
        th.innerHTML = `${col.label}<span class="sort-indicator"></span>`;
        th.addEventListener('click', () => {
            if (sortState.column === col.key) {
                sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortState.column = col.key;
                sortState.direction = 'asc';
            }
            applySort();
            applyFilters();
            updateSortIndicators();
        });
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Filter row
    const filterRow = document.createElement('tr');
    filterRow.className = 'filter-row';
    COLUMNS.forEach(col => {
        const th = document.createElement('th');
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = col.type === 'numeric' ? 'Ej: >1000' : 'Filtrar...';
        input.dataset.key = col.key;
        input.addEventListener('input', (e) => {
            filters[col.key] = e.target.value;
            applyFilters();
        });
        th.appendChild(input);
        filterRow.appendChild(th);
    });
    thead.appendChild(filterRow);

    updateSortIndicators();
}

function updateSortIndicators() {
    document.querySelectorAll('.sort-indicator').forEach(el => {
        el.textContent = '';
    });
    const activeTh = document.querySelector(`th[data-key="${sortState.column}"] .sort-indicator`);
    if (activeTh) {
        activeTh.textContent = sortState.direction === 'asc' ? ' ▲' : ' ▼';
    }
}

function applySort() {
    const col = COLUMNS.find(c => c.key === sortState.column);
    if (!col) return;

    allRows.sort((a, b) => {
        let valA = a[col.key];
        let valB = b[col.key];

        // Sort by raw fecha for date columns
        if (col.key === 'fechaComprobante') {
            valA = a._fechaRaw || '';
            valB = b._fechaRaw || '';
        }

        if (col.type === 'numeric') {
            valA = valA ?? -Infinity;
            valB = valB ?? -Infinity;
            return sortState.direction === 'asc' ? valA - valB : valB - valA;
        }

        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
        const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
        return sortState.direction === 'asc' ? cmp : -cmp;
    });
}

function applyFilters() {
    filteredRows = allRows.filter(row => {
        return COLUMNS.every(col => {
            const filterVal = (filters[col.key] || '').trim();
            if (!filterVal) return true;

            const cellVal = row[col.key];

            // Numeric range filter
            if (col.type === 'numeric') {
                const num = parseFloat(cellVal);
                if (isNaN(num)) return false;
                const match = filterVal.match(/^(>=|<=|>|<|=)\s*(-?\d+\.?\d*)$/);
                if (match) {
                    const op = match[1];
                    const target = parseFloat(match[2]);
                    if (op === '>') return num > target;
                    if (op === '>=') return num >= target;
                    if (op === '<') return num < target;
                    if (op === '<=') return num <= target;
                    if (op === '=') return num === target;
                }
                // Fallback: text contains
                return String(cellVal).includes(filterVal);
            }

            // Text contains (case-insensitive)
            return String(cellVal || '').toLowerCase().includes(filterVal.toLowerCase());
        });
    });

    renderBody();
    if (onFilterChange) {
        onFilterChange(filteredRows.length, allRows.length);
    }
}

function renderBody() {
    const tbody = document.getElementById('grid-body');
    tbody.innerHTML = '';

    filteredRows.forEach(row => {
        const tr = document.createElement('tr');
        COLUMNS.forEach(col => {
            const td = document.createElement('td');
            if (!columnVisibility[col.key]) {
                td.hidden = true;
            }
            const val = row[col.key];
            if (col.type === 'numeric' && val !== null && val !== undefined) {
                td.textContent = typeof val === 'number' ? val.toFixed(4).replace(/\.?0+$/, '') : val;
            } else {
                td.textContent = val ?? '';
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    // Also update header visibility
    document.querySelectorAll('#grid-head th[data-key]').forEach(th => {
        th.hidden = !columnVisibility[th.dataset.key];
    });
    document.querySelectorAll('.filter-row input').forEach(input => {
        input.parentElement.hidden = !columnVisibility[input.dataset.key];
    });
}

function refreshGrid() {
    renderBody();
}
