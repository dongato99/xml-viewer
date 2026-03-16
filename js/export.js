import { getColumns } from './grid.js';

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const HOJA1_KEYS = [
    'fechaComprobante', 'serie', 'folio', 'rfcEmisor', 'nombreEmisor',
    'moneda', 'total', 'estatus', 'uuid', 'validez', 'tipoComprobanteDesc'
];

export function exportToXlsx(rows, sortState) {
    if (!rows || rows.length === 0) return;

    const columns = getColumns();
    const wb = XLSX.utils.book_new();

    // Sheet0: Detail
    const sheet0Headers = columns.map(col => {
        let label = col.label;
        if (sortState && sortState.column === col.key) {
            const arrow = sortState.direction === 'asc' ? '▲' : '▼';
            label = `${arrow} ${label}`;
        }
        return label;
    });

    const sheet0Data = rows.map(row =>
        columns.map(col => {
            const val = row[col.key];
            if (col.type === 'numeric') return val ?? null;
            return val ?? '';
        })
    );

    const ws0 = XLSX.utils.aoa_to_sheet([sheet0Headers, ...sheet0Data]);
    XLSX.utils.book_append_sheet(wb, ws0, 'Sheet0');

    // Hoja1: Summary
    const hoja1Columns = columns.filter(col => HOJA1_KEYS.includes(col.key));
    const hoja1Headers = hoja1Columns.map(col => col.label);
    const hoja1Data = rows.map(row =>
        hoja1Columns.map(col => {
            const val = row[col.key];
            if (col.type === 'numeric') return val ?? null;
            return val ?? '';
        })
    );

    const ws1 = XLSX.utils.aoa_to_sheet([hoja1Headers, ...hoja1Data]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Hoja1');

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
