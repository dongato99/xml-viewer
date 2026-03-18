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

function buildSheet(cols, rows, egresoKey) {
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
    if (egresoKey) {
        rows.forEach((row, i) => {
            if (row[egresoKey] === 'Egreso') {
                const r = i + 1;
                for (let c = 0; c < cols.length; c++) {
                    const addr = XLSX.utils.encode_cell({ r, c });
                    if (ws[addr]) {
                        ws[addr].s = { font: { color: { rgb: 'FF0000' } } };
                    }
                }
            }
        });
    }

    autofitColumns(ws, [headers, ...data]);
    return ws;
}

export function exportToXlsx(rows, columns, egresoKey, columnVisibility) {
    if (!rows || rows.length === 0) return;

    // Filter columns by visibility if provided
    const cols = columnVisibility
        ? columns.filter(col => columnVisibility[col.key])
        : columns;

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, buildSheet(cols, rows, egresoKey), 'Sheet0');

    const hoja1Columns = cols.filter(col => HOJA1_KEYS.includes(col.key));
    if (hoja1Columns.length > 0) {
        XLSX.utils.book_append_sheet(wb, buildSheet(hoja1Columns, rows, egresoKey), 'Hoja1');
    }

    const filename = generateFilename(rows);
    XLSX.writeFile(wb, filename);
}

function generateFilename(rows) {
    let latestDate = null;
    const dateKeys = ['_fechaRaw', '_fechaPagoRaw', '_fechaComprobanteRaw'];
    rows.forEach(row => {
        for (const key of dateKeys) {
            if (row[key]) {
                const d = new Date(row[key]);
                if (!isNaN(d.getTime()) && (!latestDate || d > latestDate)) {
                    latestDate = d;
                }
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
