const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const HOJA1_KEYS = [
    'fechaComprobante', 'serie', 'folio', 'rfcEmisor', 'nombreEmisor',
    'moneda', 'total', 'estatus', 'uuid', 'validez', 'tipoComprobanteDesc'
];

const EGRESO_FILL = { fgColor: { rgb: 'FFFFC7CE' } };
const EGRESO_FONT = { color: { rgb: 'FF9C0006' } };
const HEADER_FILL = { fgColor: { rgb: 'FF4472C4' } };
const HEADER_FONT = { color: { rgb: 'FFFFFFFF' }, bold: true };

function applySheetFormatting(ws, columns, rows, egresoKey) {
    const colCount = columns.length;
    const rowCount = rows.length;

    // Autofilter on header row
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }) };

    // Column widths (autofit approximation)
    ws['!cols'] = columns.map((col, i) => {
        let maxLen = col.label.length;
        for (let r = 0; r < rows.length && r < 100; r++) {
            const val = rows[r][i];
            const len = val != null ? String(val).length : 0;
            if (len > maxLen) maxLen = len;
        }
        return { wch: Math.min(Math.max(maxLen + 2, 8), 50) };
    });

    // Style header row
    for (let c = 0; c < colCount; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) {
            ws[addr].s = { fill: HEADER_FILL, font: HEADER_FONT };
        }
    }

    // Style egreso rows in red
    if (egresoKey) {
        const egresoColIdx = columns.findIndex(col => col.key === egresoKey);
        if (egresoColIdx >= 0) {
            for (let r = 0; r < rowCount; r++) {
                const cellAddr = XLSX.utils.encode_cell({ r: r + 1, c: egresoColIdx });
                const cell = ws[cellAddr];
                if (cell && String(cell.v) === 'Egreso') {
                    // Color entire row
                    for (let c = 0; c < colCount; c++) {
                        const addr = XLSX.utils.encode_cell({ r: r + 1, c });
                        if (ws[addr]) {
                            ws[addr].s = { fill: EGRESO_FILL, font: EGRESO_FONT };
                        }
                    }
                }
            }
        }
    }
}

export function exportToXlsx(rows, columns, egresoKey) {
    if (!rows || rows.length === 0) return;

    const wb = XLSX.utils.book_new();

    const sheet0Headers = columns.map(col => col.label);

    const sheet0Data = rows.map(row =>
        columns.map(col => {
            const val = row[col.key];
            if (col.type === 'numeric') return val ?? null;
            return val ?? '';
        })
    );

    const ws0 = XLSX.utils.aoa_to_sheet([sheet0Headers, ...sheet0Data]);
    applySheetFormatting(ws0, columns, sheet0Data, egresoKey ? 'tipoComprobanteDesc' : null);
    XLSX.utils.book_append_sheet(wb, ws0, 'Sheet0');

    const hoja1Columns = columns.filter(col => HOJA1_KEYS.includes(col.key));
    if (hoja1Columns.length > 0) {
        const hoja1Headers = hoja1Columns.map(col => col.label);
        const hoja1Data = rows.map(row =>
            hoja1Columns.map(col => {
                const val = row[col.key];
                if (col.type === 'numeric') return val ?? null;
                return val ?? '';
            })
        );
        const ws1 = XLSX.utils.aoa_to_sheet([hoja1Headers, ...hoja1Data]);
        applySheetFormatting(ws1, hoja1Columns, hoja1Data, egresoKey ? 'tipoComprobanteDesc' : null);
        XLSX.utils.book_append_sheet(wb, ws1, 'Hoja1');
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
