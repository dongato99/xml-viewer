/* Bundled build — works without a server (file:// protocol) */
(function () {
'use strict';

// === sat-catalogs.js ===

const FORMA_PAGO = {
    '01': 'Efectivo',
    '02': 'Cheque nominativo',
    '03': 'Transferencia electrónica de fondos',
    '04': 'Tarjeta de crédito',
    '05': 'Monedero electrónico',
    '06': 'Dinero electrónico',
    '08': 'Vales de despensa',
    '12': 'Dación en pago',
    '13': 'Pago por subrogación',
    '14': 'Pago por consignación',
    '15': 'Condonación',
    '17': 'Compensación',
    '23': 'Novación',
    '24': 'Confusión',
    '25': 'Remisión de deuda',
    '26': 'Prescripción o caducidad',
    '27': 'A satisfacción del acreedor',
    '28': 'Tarjeta de débito',
    '29': 'Tarjeta de servicios',
    '30': 'Aplicación de anticipos',
    '31': 'Intermediario pagos',
    '99': 'Por definir',
};

const TIPO_COMPROBANTE = {
    'I': 'Ingreso',
    'E': 'Egreso',
    'T': 'Traslado',
    'N': 'Nómina',
    'P': 'Pago',
};

const REGIMEN_FISCAL = {
    '601': 'General de Ley Personas Morales',
    '603': 'Personas Morales con Fines no Lucrativos',
    '605': 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
    '606': 'Arrendamiento',
    '607': 'Régimen de Enajenación o Adquisición de Bienes',
    '608': 'Demás ingresos',
    '610': 'Residentes en el Extranjero sin Establecimiento Permanente en México',
    '611': 'Ingresos por Dividendos (socios y accionistas)',
    '612': 'Personas Físicas con Actividades Empresariales y Profesionales',
    '614': 'Ingresos por intereses',
    '615': 'Régimen de los ingresos por obtención de premios',
    '616': 'Sin obligaciones fiscales',
    '620': 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos',
    '621': 'Incorporación Fiscal',
    '622': 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
    '623': 'Opcional para Grupos de Sociedades',
    '624': 'Coordinados',
    '625': 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
    '626': 'Régimen Simplificado de Confianza',
};

function lookupFormaPago(code) {
    return FORMA_PAGO[code] || code || '';
}

function lookupTipoComprobante(code) {
    return TIPO_COMPROBANTE[code] || code || '';
}

function lookupRegimenFiscal(code) {
    return REGIMEN_FISCAL[code] || code || '';
}

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

// === cfdi-parser.js ===

const NS_CFDI_40 = 'http://www.sat.gob.mx/cfd/4';
const NS_CFDI_33 = 'http://www.sat.gob.mx/cfd/3';
const NS_TFD = 'http://www.sat.gob.mx/TimbreFiscalDigital';

function parseCFDI(xmlString, filename) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    if (doc.querySelector('parsererror')) {
        return null;
    }

    let ns = NS_CFDI_40;
    let comprobante = doc.getElementsByTagNameNS(ns, 'Comprobante')[0];
    if (!comprobante) {
        ns = NS_CFDI_33;
        comprobante = doc.getElementsByTagNameNS(ns, 'Comprobante')[0];
    }
    if (!comprobante) {
        const anyComprobante = doc.querySelector('*|Comprobante') || doc.documentElement;
        const detectedVersion = anyComprobante?.getAttribute('Version') || 'desconocida';
        return { error: 'unsupported_version', version: detectedVersion, filename };
    }

    const attr = (el, name) => el?.getAttribute(name) || '';
    const tipoComprobante = attr(comprobante, 'TipoDeComprobante');
    const isEgreso = tipoComprobante === 'E';

    const emisor = doc.getElementsByTagNameNS(ns, 'Emisor')[0];
    const receptor = doc.getElementsByTagNameNS(ns, 'Receptor')[0];

    const impuestos = doc.getElementsByTagNameNS(ns, 'Impuestos');
    let baseTraslado = null;
    let importeTraslado = null;
    for (let i = 0; i < impuestos.length; i++) {
        const imp = impuestos[i];
        if (imp.parentElement !== comprobante) continue;
        const traslados = imp.getElementsByTagNameNS(ns, 'Traslado');
        for (let j = 0; j < traslados.length; j++) {
            const t = traslados[j];
            const b = parseFloat(t.getAttribute('Base'));
            const importe = parseFloat(t.getAttribute('Importe'));
            if (!isNaN(b)) baseTraslado = (baseTraslado || 0) + b;
            if (!isNaN(importe)) importeTraslado = (importeTraslado || 0) + importe;
        }
        break;
    }

    const sign = isEgreso ? -1 : 1;
    const total = parseFloat(attr(comprobante, 'Total')) * sign;
    if (baseTraslado !== null) baseTraslado *= sign;
    if (importeTraslado !== null) importeTraslado *= sign;

    const tfd = doc.getElementsByTagNameNS(NS_TFD, 'TimbreFiscalDigital')[0];
    const uuid = attr(tfd, 'UUID');

    const fechaRaw = attr(comprobante, 'Fecha');
    const fechaComprobante = formatFecha(fechaRaw);

    const moneda = attr(comprobante, 'Moneda');
    const tipoCambioRaw = attr(comprobante, 'TipoCambio');
    let tipoCambio;
    if (tipoCambioRaw) {
        tipoCambio = tipoCambioRaw;
    } else if (moneda === 'MXN' || !moneda) {
        tipoCambio = '1';
    } else {
        tipoCambio = 'N/A';
    }

    const concepto = doc.getElementsByTagNameNS(ns, 'Concepto')[0];
    const claveProdServDesc = attr(concepto, 'Descripcion');

    const formaPago = attr(comprobante, 'FormaPago');

    return {
        fechaComprobante,
        serie: attr(comprobante, 'Serie'),
        folio: attr(comprobante, 'Folio'),
        rfcEmisor: attr(emisor, 'Rfc'),
        nombreEmisor: attr(emisor, 'Nombre'),
        moneda,
        tipoCambio,
        baseTraslado,
        importeTraslado,
        total,
        formaPago,
        formaPagoDesc: lookupFormaPago(formaPago),
        usoCFDI: attr(receptor, 'UsoCFDI'),
        regimenFiscalReceptor: attr(receptor, 'RegimenFiscalReceptor'),
        claveProdServDesc,
        uuid,
        estatus: uuid ? 'Timbrado' : '',
        validez: 'OK',
        tipoDocumento: 'CFDI',
        versionComprobante: attr(comprobante, 'Version'),
        tipoComprobanteDesc: lookupTipoComprobante(tipoComprobante),
        tipoComprobante: 'CFDI',
        _fechaRaw: fechaRaw,
        _filename: filename,
    };
}

function formatFecha(isoDate) {
    if (!isoDate) return '';
    const [datePart] = isoDate.split('T');
    const [yyyy, mm, dd] = datePart.split('-');
    if (!yyyy || !mm || !dd) return isoDate;
    return `${dd}/${mm}/${yyyy}`;
}

// === grid.js ===

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
let onSelectionChange = null;
const selectedRows = new Set();

function getColumns() {
    return COLUMNS;
}

function initGrid(headId, bodyId, statusCallback, selectionCallback) {
    onFilterChange = statusCallback;
    onSelectionChange = selectionCallback;
    COLUMNS.forEach(col => { columnVisibility[col.key] = true; });
    renderHead(headId);
}

function setData(rows) {
    allRows = rows;
    applySort();
    applyFilters();
}

function getVisibleRows() {
    return filteredRows;
}

function getAllRows() {
    return allRows;
}

function getColumnVisibility() {
    return { ...columnVisibility };
}

function setColumnVisibility(key, visible) {
    columnVisibility[key] = visible;
    refreshGrid();
}

function clearData() {
    allRows = [];
    filteredRows = [];
    filters = {};
    selectedRows.clear();
    document.querySelectorAll('.filter-row input').forEach(input => { input.value = ''; });
    renderBody();
    if (onFilterChange) {
        onFilterChange(0, 0);
    }
    fireSelectionChange();
}

function getSelectedRows() {
    return allRows.filter(row => selectedRows.has(row));
}

function removeSelectedRows() {
    allRows = allRows.filter(row => !selectedRows.has(row));
    selectedRows.clear();
    applySort();
    applyFilters();
    fireSelectionChange();
}

function fireSelectionChange() {
    if (onSelectionChange) {
        onSelectionChange(selectedRows.size);
    }
}

function renderHead(headId) {
    const thead = document.getElementById(headId);

    const headerRow = document.createElement('tr');

    // Select-all checkbox column
    const selectAllTh = document.createElement('th');
    selectAllTh.className = 'select-col';
    const selectAllCb = document.createElement('input');
    selectAllCb.type = 'checkbox';
    selectAllCb.id = 'select-all';
    selectAllCb.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    selectAllCb.addEventListener('change', () => {
        if (selectAllCb.checked) {
            filteredRows.forEach(row => selectedRows.add(row));
        } else {
            filteredRows.forEach(row => selectedRows.delete(row));
        }
        renderBody();
        fireSelectionChange();
    });
    selectAllTh.appendChild(selectAllCb);
    headerRow.appendChild(selectAllTh);

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

    const filterRow = document.createElement('tr');
    filterRow.className = 'filter-row';

    // Empty cell for checkbox column in filter row
    const filterSelectTh = document.createElement('th');
    filterSelectTh.className = 'select-col';
    filterRow.appendChild(filterSelectTh);

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
                return String(cellVal).includes(filterVal);
            }

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
        if (row.tipoComprobanteDesc === 'Egreso') {
            tr.classList.add('row--egreso');
        }

        // Checkbox cell
        const selectTd = document.createElement('td');
        selectTd.className = 'select-col';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selectedRows.has(row);
        cb.addEventListener('change', () => {
            if (cb.checked) {
                selectedRows.add(row);
            } else {
                selectedRows.delete(row);
            }
            updateSelectAll();
            fireSelectionChange();
        });
        selectTd.appendChild(cb);
        tr.appendChild(selectTd);

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

    updateSelectAll();

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

function updateSelectAll() {
    const selectAllCb = document.getElementById('select-all');
    if (!selectAllCb) return;
    if (filteredRows.length === 0) {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = false;
    } else {
        const count = filteredRows.filter(r => selectedRows.has(r)).length;
        selectAllCb.checked = count === filteredRows.length;
        selectAllCb.indeterminate = count > 0 && count < filteredRows.length;
    }
}

// === export.js ===

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const HOJA1_KEYS = [
    'fechaComprobante', 'serie', 'folio', 'rfcEmisor', 'nombreEmisor',
    'moneda', 'total', 'estatus', 'uuid', 'validez', 'tipoComprobanteDesc'
];

function autofitColumns(ws, aoa) {
    const colWidths = [];
    aoa.forEach(row => {
        row.forEach((cell, c) => {
            const len = cell != null ? String(cell).length : 0;
            if (!colWidths[c] || len > colWidths[c]) colWidths[c] = len;
        });
    });
    ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w + 2, 60) }));
}

function buildSheet(cols, rows) {
    const headers = cols.map(col => col.label);
    const data = rows.map(row =>
        cols.map(col => {
            const val = row[col.key];
            if (col.type === 'numeric') return val ?? null;
            return val ?? '';
        })
    );

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }) };

    // Red font for Egreso rows
    rows.forEach((row, i) => {
        if (row.tipoComprobanteDesc === 'Egreso') {
            const r = i + 1;
            for (let c = 0; c < cols.length; c++) {
                const addr = XLSX.utils.encode_cell({ r, c });
                if (ws[addr]) {
                    ws[addr].s = { font: { color: { rgb: 'FF0000' } } };
                }
            }
        }
    });

    autofitColumns(ws, [headers, ...data]);
    return ws;
}

function exportToXlsx(rows, visibleOnly) {
    if (!rows || rows.length === 0) return;

    const allColumns = getColumns();
    const vis = visibleOnly ? getColumnVisibility() : null;
    const columns = vis ? allColumns.filter(col => vis[col.key]) : allColumns;

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, buildSheet(columns, rows), 'Sheet0');

    const hoja1Columns = columns.filter(col => HOJA1_KEYS.includes(col.key));
    if (hoja1Columns.length > 0) {
        XLSX.utils.book_append_sheet(wb, buildSheet(hoja1Columns, rows), 'Hoja1');
    }

    const filename = generateFilename(rows);
    XLSX.writeFile(wb, filename);
}

function generateFilename(rows) {
    let latestDate = null;
    rows.forEach(row => {
        if (row._fechaRaw) {
            const d = new Date(row._fechaRaw);
            if (!isNaN(d.getTime()) && (!latestDate || d > latestDate)) {
                latestDate = d;
            }
        }
    });

    if (latestDate) {
        const mes = MESES[latestDate.getMonth()];
        const year = latestDate.getFullYear();
        return `Gastos ${mes} ${year}.xlsx`;
    }

    return 'Gastos.xlsx';
}

// === app.js ===

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
const columnsToggle = document.getElementById('columns-toggle');
const columnsDropdown = document.getElementById('columns-dropdown');
const warningsDiv = document.getElementById('warnings');
const themeToggle = document.getElementById('theme-toggle');

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

initGrid('grid-head', 'grid-body', (visible, total) => {
    statusText.textContent = `Mostrando ${visible} de ${total} filas`;
    rowCount.textContent = `${total} filas cargadas`;
    exportFilteredBtn.disabled = visible === 0;
}, (count) => {
    clearSelectedBtn.disabled = count === 0;
    exportSelectedBtn.disabled = count === 0;
    clearSelectedBtn.textContent = count > 0 ? `Quitar Seleccionados (${count})` : 'Quitar Seleccionados';
    exportSelectedBtn.textContent = count > 0 ? `Exportar Seleccionados (${count})` : 'Exportar Seleccionados';
});

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

exportAllBtn.addEventListener('click', () => {
    exportToXlsx(getAllRows());
});

exportFilteredBtn.addEventListener('click', () => {
    exportToXlsx(getVisibleRows(), true);
});

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

})();
