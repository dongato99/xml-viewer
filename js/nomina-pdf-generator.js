/**
 * Nómina PDF Generator — renders a CFDI nómina as a SAT-format receipt.
 * Depends on globals: jspdf (jsPDF UMD), qrcode (qrcode-generator).
 */

const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_ZONE = 25;
const GRAY_BG = [220, 220, 220];
const TABLE_FONT = 6;
const SMALL_FONT = 5.5;
const NORMAL_FONT = 7;
const HEADER_FONT = 7;
const SECTION_GAP = 6;
const ROW_H = 5;
const HEADER_ROW_H = 6;

function fmtMoney(val) {
    if (!val && val !== 0) return '';
    const n = parseFloat(val);
    if (isNaN(n)) return String(val);
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ensureSpace(doc, y, needed) {
    if (y + needed > PAGE_H - FOOTER_ZONE) {
        doc.addPage();
        return MARGIN;
    }
    return y;
}

function drawLabelValue(doc, x, y, maxWidth, label, value, fontSize) {
    if (!value && value !== 0) return y;
    const fs = fontSize || HEADER_FONT;
    doc.setFontSize(fs);
    doc.setFont('helvetica', 'bold');
    const labelW = doc.getTextWidth(label);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    const valueX = x + labelW + 1;
    const availW = maxWidth - labelW - 1;
    if (availW <= 0) {
        const lines = doc.splitTextToSize(String(value), maxWidth);
        doc.text(lines, x, y + fs * 0.4);
        return y + lines.length * fs * 0.4 + fs * 0.35;
    }
    const lines = doc.splitTextToSize(String(value), availW);
    doc.text(lines, valueX, y);
    return y + lines.length * fs * 0.4 + fs * 0.35;
}

function drawSectionTitle(doc, y, title) {
    y = ensureSpace(doc, y, 10);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(title, MARGIN, y);
    return y + 4;
}

function drawDataTable(doc, y, columns, rows) {
    const totalW = columns.reduce((s, c) => s + c.w, 0);
    const LINE_H = 2.2;
    const CELL_PAD = 1;

    // Header lines + height
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TABLE_FONT);
    const headerLines = columns.map(col => doc.splitTextToSize(col.label, col.w - 2));
    const maxHeaderLines = Math.max(1, ...headerLines.map(l => l.length));
    const headerH = Math.max(HEADER_ROW_H, maxHeaderLines * LINE_H + CELL_PAD * 2);

    y = ensureSpace(doc, y, headerH + rows.length * ROW_H);

    // Header
    doc.setFillColor(...GRAY_BG);
    doc.rect(MARGIN, y, totalW, headerH, 'F');
    doc.setDrawColor(100, 100, 100);
    let cx = MARGIN;
    for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        doc.rect(cx, y, col.w, headerH);
        const lines = headerLines[i];
        const align = col.align === 'right' ? 'right' : (col.align === 'center' ? 'center' : 'left');
        const textX = align === 'right' ? cx + col.w - 1 : (align === 'center' ? cx + col.w / 2 : cx + 1);
        for (let li = 0; li < lines.length; li++) {
            doc.text(lines[li], textX, y + 2.3 + li * LINE_H, { align });
        }
        cx += col.w;
    }
    y += headerH;

    // Data rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TABLE_FONT);
    for (const row of rows) {
        // Compute per-cell wrapped lines and row height
        const cellLines = [];
        let maxLines = 1;
        for (let i = 0; i < columns.length; i++) {
            const lines = doc.splitTextToSize(String(row[i] ?? ''), columns[i].w - 2);
            cellLines.push(lines);
            if (lines.length > maxLines) maxLines = lines.length;
        }
        const rowH = Math.max(ROW_H, maxLines * LINE_H + CELL_PAD * 2);
        y = ensureSpace(doc, y, rowH);

        cx = MARGIN;
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            doc.rect(cx, y, col.w, rowH);
            const align = col.align === 'right' ? 'right' : (col.align === 'center' ? 'center' : 'left');
            const textX = align === 'right' ? cx + col.w - 1 : (align === 'center' ? cx + col.w / 2 : cx + 1);
            for (let li = 0; li < cellLines[i].length; li++) {
                doc.text(cellLines[i][li], textX, y + CELL_PAD + LINE_H * 0.9 + li * LINE_H, { align });
            }
            cx += col.w;
        }
        y += rowH;
    }

    return y;
}

function drawTotalRow(doc, y, columns, values) {
    const totalW = columns.reduce((s, c) => s + c.w, 0);
    y = ensureSpace(doc, y, ROW_H);
    doc.setDrawColor(100, 100, 100);
    let cx = MARGIN;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TABLE_FONT);
    for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        // No fill, just border
        doc.rect(cx, y, col.w, ROW_H);
        const align = col.align === 'right' ? 'right' : (col.align === 'center' ? 'center' : 'left');
        const textX = align === 'right' ? cx + col.w - 1 : (align === 'center' ? cx + col.w / 2 : cx + 1);
        doc.text(String(values[i] ?? ''), textX, y + 3.2, { align });
        cx += col.w;
    }
    return y + ROW_H;
}

function buildQRUrl(data) {
    const uuid = data.tfd?.uuid || '';
    const reEmisor = data.emisor?.rfc || '';
    const rrReceptor = data.receptor?.rfc || '';
    const totalNum = parseFloat(data.total || '0');
    const totalFixed = totalNum.toFixed(6);
    const tt = totalFixed.padStart(18, '0');
    const fe = (data.sello || '').slice(-8);
    return `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${reEmisor}&rr=${rrReceptor}&tt=${tt}&fe=${fe}`;
}

/**
 * Generate the nómina PDF.
 * @param {object} data Result of parseNominaCFDIForPrint.
 * @returns {Blob}
 */
export function generateNominaPdf(data) {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    let y = MARGIN;

    const colW = CONTENT_W / 2 - 2;
    const leftX = MARGIN;
    const rightX = MARGIN + colW + 4;

    // ============================================================
    // 1. Title
    // ============================================================
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Recibo de pago de nómina', MARGIN, y);
    y += 5;

    // ============================================================
    // 2. Emisor (two columns)
    // ============================================================
    y = drawSectionTitle(doc, y, 'Emisor');
    let leftY = y, rightY = y;

    leftY = drawLabelValue(doc, leftX, leftY, colW, 'RFC: ', data.emisor?.rfc || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Nombre: ', data.emisor?.nombre || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Registro patronal: ', data.nomina?.nomEmisor?.registroPatronal || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Régimen fiscal: ', data.emisor?.regimenFiscalDesc || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Folio: ', data.folio || '');

    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Folio fiscal: ', data.tfd?.uuid || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'No. de serie del CSD: ', data.noCertificado || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Lugar, fecha y hora de emisión: ', (data.lugarExpedicion || '') + ' ' + (data.fecha || ''));
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Efecto del comprobante: ', data.tipoDeComprobanteDesc || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'RFC Patrón Origen: ', data.nomina?.nomEmisor?.rfcPatronOrigen || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Serie: ', data.serie || '');

    y = Math.max(leftY, rightY) + SECTION_GAP;

    // ============================================================
    // 3. Receptor (two columns)
    // ============================================================
    y = drawSectionTitle(doc, y, 'Receptor');
    const nr = data.nomina?.nomReceptor || {};
    leftY = y; rightY = y;

    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Nombre: ', data.receptor?.nombre || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'RFC: ', data.receptor?.rfc || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'No. Empleado: ', nr.numEmpleado || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Departamento: ', nr.departamento || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Riesgo puesto: ', nr.riesgoPuestoDesc || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Fecha de inicio relación laboral: ', nr.fechaInicioRelLaboral || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Régimen de contratación: ', nr.tipoRegimenDesc || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Tipo de jornada: ', nr.tipoJornadaDesc || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Clave Entidad Federativa: ', nr.claveEntFed || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Uso CFDI: ', data.receptor?.usoCFDIDesc || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Código postal del receptor: ', data.receptor?.domicilioFiscalReceptor || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Régimen fiscal del receptor: ', data.receptor?.regimenFiscalReceptorDesc || '');

    rightY = drawLabelValue(doc, rightX, rightY, colW, 'No. de Seguridad Social: ', nr.numSeguridadSocial || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'CURP: ', nr.curp || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Puesto: ', nr.puesto || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Antigüedad: ', nr.antiguedad || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Tipo contrato: ', nr.tipoContratoDesc || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Periodicidad de pago: ', nr.periodicidadPagoDesc || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Salario diario: ', nr.salarioDiarioIntegrado || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Salario base: ', nr.salarioBaseCotApor || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Sindicalizado: ', nr.sindicalizado || '');

    y = Math.max(leftY, rightY) + SECTION_GAP;

    // ============================================================
    // 4. Datos Generales (two columns)
    // ============================================================
    y = drawSectionTitle(doc, y, 'Datos Generales');
    const nm = data.nomina || {};
    leftY = y; rightY = y;

    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Tipo nómina: ', nm.tipoNominaDesc || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Fecha pago: ', nm.fechaPago || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Fecha Inicial de pago: ', nm.fechaInicialPago || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Forma pago: ', data.formaPagoDesc || data.formaPago || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Banco: ', nr.banco || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Moneda: ', data.moneda || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Exportación: ', data.exportacionDesc || '');

    rightY = drawLabelValue(doc, rightX, rightY, colW, 'No. de días pagados: ', nm.numDiasPagados || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Fecha final de pago: ', nm.fechaFinalPago || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Método de pago: ', data.metodoPagoDesc || data.metodoPago || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Cuenta Bancaria: ', nr.cuentaBancaria || '');

    y = Math.max(leftY, rightY) + SECTION_GAP;

    // ============================================================
    // 5. Concepto (single row)
    // ============================================================
    y = drawSectionTitle(doc, y, 'Concepto');

    const conceptCols = [
        { label: 'Cve del producto/servicio', w: 22, align: 'left' },
        { label: 'No. identificación', w: 18, align: 'left' },
        { label: 'Cantidad', w: 14, align: 'right' },
        { label: 'Clave unidad', w: 16, align: 'left' },
        { label: 'Unidad', w: 14, align: 'left' },
        { label: 'Descripcion', w: 26, align: 'left' },
        { label: 'Valor unitario', w: 18, align: 'right' },
        { label: 'Importe', w: 18, align: 'right' },
        { label: 'Descuento', w: 18, align: 'right' },
        { label: 'Objeto impuesto', w: CONTENT_W - (22 + 18 + 14 + 16 + 14 + 26 + 18 + 18 + 18), align: 'left' },
    ];

    const c0 = (data.conceptos && data.conceptos[0]) || {};
    const conceptVals = [
        c0.claveProdServ || '',
        c0.noIdentificacion || '',
        c0.cantidad || '',
        c0.claveUnidad || '',
        c0.unidad || '',
        c0.descripcion || '',
        fmtMoney(c0.valorUnitario),
        fmtMoney(c0.importe),
        c0.descuento ? fmtMoney(c0.descuento) : '',
        c0.objetoImpDesc || c0.objetoImp || '',
    ];

    const LINE_H = 2.2;
    const CELL_PAD = 1;

    y = ensureSpace(doc, y, HEADER_ROW_H + ROW_H + 2);

    // Header row
    doc.setFillColor(...GRAY_BG);
    doc.rect(MARGIN, y, CONTENT_W, HEADER_ROW_H, 'F');
    doc.setDrawColor(100, 100, 100);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TABLE_FONT);
    let cx = MARGIN;
    for (const col of conceptCols) {
        doc.rect(cx, y, col.w, HEADER_ROW_H);
        const lines = doc.splitTextToSize(col.label, col.w - 2);
        const textX = col.align === 'right' ? cx + col.w - 1 : cx + 1;
        for (let li = 0; li < lines.length; li++) {
            doc.text(lines[li], textX, y + 2.3 + li * LINE_H, { align: col.align === 'right' ? 'right' : 'left' });
        }
        cx += col.w;
    }
    y += HEADER_ROW_H;

    // Data row — compute wrapped lines per cell and max height
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TABLE_FONT);
    const cellLines = [];
    let maxLines = 1;
    for (let i = 0; i < conceptCols.length; i++) {
        const lines = doc.splitTextToSize(String(conceptVals[i]), conceptCols[i].w - 2);
        cellLines.push(lines);
        if (lines.length > maxLines) maxLines = lines.length;
    }
    const dataRowH = Math.max(ROW_H, maxLines * LINE_H + CELL_PAD * 2);
    cx = MARGIN;
    for (let i = 0; i < conceptCols.length; i++) {
        const col = conceptCols[i];
        doc.rect(cx, y, col.w, dataRowH);
        const textX = col.align === 'right' ? cx + col.w - 1 : cx + 1;
        for (let li = 0; li < cellLines[i].length; li++) {
            doc.text(cellLines[i][li], textX, y + CELL_PAD + LINE_H * 0.9 + li * LINE_H, { align: col.align === 'right' ? 'right' : 'left' });
        }
        cx += col.w;
    }
    y += dataRowH + SECTION_GAP;

    // ============================================================
    // 6. Percepciones (table N rows + total row)
    // ============================================================
    y = drawSectionTitle(doc, y, 'Percepciones');

    const perc = (data.nomina && data.nomina.percepciones) || { items: [] };
    const percCols = [
        { label: 'Tipo de percepción', w: 50, align: 'left' },
        { label: 'Clave', w: 20, align: 'center' },
        { label: 'Concepto', w: 50, align: 'left' },
        { label: 'Importe gravado', w: 30, align: 'right' },
        { label: 'Importe exento', w: CONTENT_W - (50 + 20 + 50 + 30), align: 'right' },
    ];

    y = drawDataTable(doc, y, percCols, perc.items.map(p => [
        p.tipoPercepcionDesc || p.tipoPercepcion || '',
        p.clave || '',
        p.concepto || '',
        fmtMoney(p.importeGravado),
        fmtMoney(p.importeExento),
    ]));

    // Total row
    const sumGravado = perc.items.reduce((s, p) => s + (parseFloat(p.importeGravado) || 0), 0);
    const sumExento = perc.items.reduce((s, p) => s + (parseFloat(p.importeExento) || 0), 0);
    y = drawTotalRow(doc, y, percCols, [
        '', '', 'Total Percepciones',
        '$ ' + fmtMoney(sumGravado),
        '$ ' + fmtMoney(sumExento),
    ]);

    y += SECTION_GAP;

    // ============================================================
    // 7. Total percepciones (summary 3 cols)
    // ============================================================
    y = drawSectionTitle(doc, y, 'Total percepciones');
    const sumCols3 = [
        { label: 'Total sueldos', w: CONTENT_W / 3, align: 'right' },
        { label: 'Total exento', w: CONTENT_W / 3, align: 'right' },
        { label: 'Total gravado', w: CONTENT_W / 3, align: 'right' },
    ];
    y = drawDataTable(doc, y, sumCols3, [[
        fmtMoney(perc.totalSueldos),
        fmtMoney(perc.totalExento),
        fmtMoney(perc.totalGravado),
    ]]);

    y += SECTION_GAP;

    return doc.output('blob');
}
