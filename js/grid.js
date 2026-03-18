/**
 * Creates a grid instance with its own encapsulated state.
 * @param {Object} config
 * @param {Array} config.columns - Column definitions [{key, label, type, rawKey?}]
 * @param {HTMLElement} config.container - Root container element for scoped DOM queries
 * @param {string} config.headId - ID of thead element
 * @param {string} config.bodyId - ID of tbody element
 * @param {Function} config.onFilterChange - (visible, total) callback
 * @param {Function} config.onSelectionChange - (count) callback
 * @param {Function} config.onPdfClick - (uuid) callback
 * @param {Array} [config.rowStyles] - [{field, value, className}] for conditional row styling
 * @returns {Object} Grid instance with public methods
 */
export function createGrid(config) {
    const { columns, container, headId, bodyId, onFilterChange, onSelectionChange, onPdfClick, rowStyles } = config;

    let allRows = [];
    let filteredRows = [];
    let sortState = { column: columns[0]?.key || '', direction: 'desc' };
    let filters = {};
    let columnVisibility = {};
    const selectedRows = new Set();
    const xmlStore = new Map();

    // Initialize column visibility
    columns.forEach(col => { columnVisibility[col.key] = true; });

    function getColumns() { return columns; }
    function getAllRows() { return allRows; }
    function getVisibleRows() { return filteredRows; }
    function getSortState() { return { ...sortState }; }
    function getColumnVisibility() { return { ...columnVisibility }; }
    function getSelectedRows() { return allRows.filter(row => selectedRows.has(row)); }
    function getXmlStore() { return xmlStore; }

    function setColumnVisibility(key, visible) {
        columnVisibility[key] = visible;
        renderBody();
    }

    function setData(rows) {
        allRows = rows;
        applySort();
        applyFilters();
    }

    function clearData() {
        xmlStore.clear();
        allRows = [];
        filteredRows = [];
        filters = {};
        selectedRows.clear();
        container.querySelectorAll('.filter-row input').forEach(input => { input.value = ''; });
        renderBody();
        if (onFilterChange) onFilterChange(0, 0);
        fireSelectionChange();
    }

    function removeSelectedRows() {
        const selectedUuids = new Set([...selectedRows].map(row => row.uuid));
        allRows = allRows.filter(row => !selectedRows.has(row));
        selectedRows.clear();

        for (const uuid of selectedUuids) {
            const stillHasRows = allRows.some(row => row.uuid === uuid);
            if (!stillHasRows) {
                xmlStore.delete(uuid);
            }
        }

        applySort();
        applyFilters();
        fireSelectionChange();
    }

    function fireSelectionChange() {
        if (onSelectionChange) onSelectionChange(selectedRows.size);
    }

    function renderHead() {
        const thead = container.querySelector('#' + headId);
        thead.innerHTML = '';

        const headerRow = document.createElement('tr');

        const pdfTh = document.createElement('th');
        pdfTh.className = 'pdf-col';
        pdfTh.style.cursor = 'default';
        headerRow.appendChild(pdfTh);

        const selectAllTh = document.createElement('th');
        selectAllTh.className = 'select-col';
        const selectAllCb = document.createElement('input');
        selectAllCb.type = 'checkbox';
        selectAllCb.className = 'select-all-cb';
        selectAllCb.addEventListener('click', (e) => e.stopPropagation());
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

        columns.forEach(col => {
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

        const filterPdfTh = document.createElement('th');
        filterPdfTh.className = 'pdf-col';
        filterRow.appendChild(filterPdfTh);

        const filterSelectTh = document.createElement('th');
        filterSelectTh.className = 'select-col';
        filterRow.appendChild(filterSelectTh);

        columns.forEach(col => {
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
        container.querySelectorAll('.sort-indicator').forEach(el => {
            el.textContent = '';
        });
        const activeTh = container.querySelector(`th[data-key="${sortState.column}"] .sort-indicator`);
        if (activeTh) {
            activeTh.textContent = sortState.direction === 'asc' ? ' ▲' : ' ▼';
        }
    }

    function applySort() {
        const col = columns.find(c => c.key === sortState.column);
        if (!col) return;

        allRows.sort((a, b) => {
            let valA = a[col.key];
            let valB = b[col.key];

            if (col.rawKey) {
                valA = a[col.rawKey] || '';
                valB = b[col.rawKey] || '';
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
            return columns.every(col => {
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
        if (onFilterChange) onFilterChange(filteredRows.length, allRows.length);
    }

    function renderBody() {
        const tbody = container.querySelector('#' + bodyId);
        tbody.innerHTML = '';

        filteredRows.forEach(row => {
            const tr = document.createElement('tr');
            if (rowStyles) {
                for (const rs of rowStyles) {
                    if (row[rs.field] === rs.value) {
                        tr.classList.add(rs.className);
                    }
                }
            }

            const pdfTd = document.createElement('td');
            pdfTd.className = 'pdf-col';
            const pdfBtn = document.createElement('button');
            pdfBtn.className = 'pdf-btn';
            pdfBtn.textContent = 'PDF';
            pdfBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onPdfClick) onPdfClick(row.uuid);
            });
            pdfTd.appendChild(pdfBtn);
            tr.appendChild(pdfTd);

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

            columns.forEach(col => {
                const td = document.createElement('td');
                if (!columnVisibility[col.key]) td.hidden = true;
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

        container.querySelectorAll('th[data-key]').forEach(th => {
            th.hidden = !columnVisibility[th.dataset.key];
        });
        container.querySelectorAll('.filter-row input').forEach(input => {
            if (input.dataset.key) {
                input.parentElement.hidden = !columnVisibility[input.dataset.key];
            }
        });
    }

    function updateSelectAll() {
        const selectAllCb = container.querySelector('.select-all-cb');
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

    renderHead();

    return {
        getColumns,
        getAllRows,
        getVisibleRows,
        getSortState,
        getColumnVisibility,
        setColumnVisibility,
        getSelectedRows,
        getXmlStore,
        setData,
        clearData,
        removeSelectedRows,
    };
}
