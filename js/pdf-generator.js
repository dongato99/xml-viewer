/**
 * CFDI PDF Generator — renders a Mexican tax invoice (CFDI) as a PDF using jsPDF.
 * Depends on globals: jspdf (jsPDF UMD), qrcode (qrcode-generator).
 */

// --- Constants ---
const PAGE_W = 215.9;   // Letter width mm
const PAGE_H = 279.4;   // Letter height mm
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_ZONE = 25; // reserved at bottom for footer
const GRAY_BG = [220, 220, 220];
const TABLE_FONT = 6;
const SMALL_FONT = 5.5;
const NORMAL_FONT = 7;
const HEADER_FONT = 7;
const SECTION_GAP = 6;

// Impuesto code to name
const IMPUESTO_NAMES = { '001': 'ISR', '002': 'IVA', '003': 'IEPS' };

/**
 * Format a number string with $ prefix and thousands separators.
 */
function fmtMoney(val) {
    if (!val && val !== 0) return '';
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format tasaOCuota as percentage string, e.g. 0.160000 → "16.00%"
 */
function fmtRate(val) {
    if (!val) return '';
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    return (n * 100).toFixed(2) + '%';
}

/**
 * Build the SAT verification QR URL.
 */
function buildQRUrl(data) {
    const uuid = data.tfd?.uuid || '';
    const reEmisor = data.emisor?.rfc || '';
    const rrReceptor = data.receptor?.rfc || '';
    // tt: total padded to 18 chars with 6 decimals
    const totalNum = parseFloat(data.total || '0');
    const totalFixed = totalNum.toFixed(6);
    const tt = totalFixed.padStart(18, '0');
    // fe: last 8 chars of sello
    const fe = (data.sello || '').slice(-8);
    return `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${reEmisor}&rr=${rrReceptor}&tt=${tt}&fe=${fe}`;
}

/**
 * Check if we need a page break and add one if so.
 * Returns the (possibly reset) y position.
 */
function ensureSpace(doc, y, needed) {
    if (y + needed > PAGE_H - FOOTER_ZONE) {
        doc.addPage();
        return MARGIN;
    }
    return y;
}

/**
 * Draw a single row of label: value with bold label.
 * Returns the new y after drawing.
 */
function drawLabelValue(doc, x, y, maxWidth, label, value, fontSize) {
    if (!value && value !== 0) return y;
    const fs = fontSize || HEADER_FONT;
    doc.setFontSize(fs);

    // Measure label width
    doc.setFont('helvetica', 'bold');
    const labelW = doc.getTextWidth(label);
    doc.text(label, x, y);

    doc.setFont('helvetica', 'normal');
    const valueX = x + labelW + 1;
    const availW = maxWidth - labelW - 1;
    if (availW <= 0) {
        // Wrap on next line
        const lines = doc.splitTextToSize(String(value), maxWidth);
        doc.text(lines, x, y + fs * 0.4);
        return y + lines.length * fs * 0.4 + fs * 0.35;
    }
    const lines = doc.splitTextToSize(String(value), availW);
    doc.text(lines, valueX, y);
    return y + lines.length * fs * 0.4 + fs * 0.35;
}

/**
 * Generate a complete CFDI PDF.
 * @param {object} data  The parsed print data from parseCFDIForPrint.
 * @returns {Blob}  The PDF as a Blob.
 */
export function generateCFDIPdf(data) {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    let y = MARGIN;

    // ========================================================================
    // SECTION 1: Header — two columns
    // ========================================================================
    const colW = CONTENT_W / 2 - 2;
    const leftX = MARGIN;
    const rightX = MARGIN + colW + 4;

    const headerStartY = y;

    // Left column
    let leftY = y;
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'RFC emisor: ', data.emisor?.rfc || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Nombre emisor: ', data.emisor?.nombre || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Folio: ', data.folio || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'RFC receptor: ', data.receptor?.rfc || '');
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Nombre receptor: ', data.receptor?.nombre || '');
    if (data.receptor?.domicilioFiscalReceptor) {
        leftY = drawLabelValue(doc, leftX, leftY, colW, 'Código postal del receptor: ', data.receptor.domicilioFiscalReceptor);
    }
    if (data.receptor?.regimenFiscalReceptorDesc) {
        leftY = drawLabelValue(doc, leftX, leftY, colW, 'Régimen fiscal receptor: ', data.receptor.regimenFiscalReceptorDesc);
    }
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Uso CFDI: ', data.receptor?.usoCFDIDesc || '');

    // Right column
    let rightY = y;
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Folio fiscal: ', data.tfd?.uuid || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'No. de serie del CSD: ', data.noCertificado || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Serie: ', data.serie || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Código postal, fecha y hora de emisión: ', (data.lugarExpedicion || '') + ' ' + (data.fecha || ''));
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Efecto de comprobante: ', data.tipoDeComprobanteDesc || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Régimen fiscal: ', data.emisor?.regimenFiscalDesc || '');
    if (data.exportacionDesc) {
        rightY = drawLabelValue(doc, rightX, rightY, colW, 'Exportación: ', data.exportacionDesc);
    }

    y = Math.max(leftY, rightY) + SECTION_GAP;

    // ========================================================================
    // SECTION 2: Conceptos Table
    // ========================================================================
    // Column definitions: [label, width, align]
    const conceptCols = [
        { label: 'Clave prod/serv', w: 18, align: 'left' },
        { label: 'No. ident.', w: 14, align: 'left' },
        { label: 'Cantidad', w: 14, align: 'right' },
        { label: 'Clave unidad', w: 16, align: 'left' },
        { label: 'Unidad', w: 24, align: 'left' },
        { label: 'Valor unitario', w: 22, align: 'right' },
        { label: 'Importe', w: 22, align: 'right' },
        { label: 'Descuento', w: 18, align: 'right' },
        { label: 'Objeto imp.', w: CONTENT_W - (18 + 14 + 14 + 16 + 24 + 22 + 22 + 18), align: 'left' },
    ];

    const ROW_H = 5;
    const HEADER_ROW_H = 6;

    // Section title
    y = ensureSpace(doc, y, HEADER_ROW_H + ROW_H * 2 + 4);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Conceptos', MARGIN, y);
    y += 4;

    // Table header
    y = ensureSpace(doc, y, HEADER_ROW_H);
    doc.setFillColor(...GRAY_BG);
    doc.rect(MARGIN, y - 3.5, CONTENT_W, HEADER_ROW_H, 'F');
    doc.setDrawColor(100, 100, 100);
    doc.rect(MARGIN, y - 3.5, CONTENT_W, HEADER_ROW_H);

    doc.setFontSize(TABLE_FONT);
    doc.setFont('helvetica', 'bold');
    let cx = MARGIN;
    for (const col of conceptCols) {
        // Draw cell border
        doc.rect(cx, y - 3.5, col.w, HEADER_ROW_H);
        const textX = col.align === 'right' ? cx + col.w - 1 : cx + 1;
        doc.text(col.label, textX, y, { align: col.align === 'right' ? 'right' : 'left' });
        cx += col.w;
    }
    y += HEADER_ROW_H - 3.5;

    // Draw each concepto
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TABLE_FONT);

    for (const c of (data.conceptos || [])) {
        const vals = [
            c.claveProdServ || '',
            c.noIdentificacion || '',
            c.cantidad || '',
            c.claveUnidad || '',
            c.unidad || '',
            fmtMoney(c.valorUnitario),
            fmtMoney(c.importe),
            c.descuento ? fmtMoney(c.descuento) : '',
            c.objetoImpDesc || c.objetoImp || '',
        ];

        // Estimate rows needed for this concepto
        const descLines = doc.splitTextToSize('Descripción: ' + (c.descripcion || ''), CONTENT_W - 2);
        // Estimate data row height by checking wrapped text in each column
        let estMaxLines = 1;
        for (let i = 0; i < conceptCols.length; i++) {
            const lines = doc.splitTextToSize(String(vals[i]), conceptCols[i].w - 2);
            if (lines.length > estMaxLines) estMaxLines = lines.length;
        }
        const estDataRowH = Math.max(ROW_H, estMaxLines * 2.5 + 2.4);
        let conceptoHeight = estDataRowH + descLines.length * 2.5 + 2;
        if (c.impuestos && c.impuestos.length > 0) {
            conceptoHeight += 5 + c.impuestos.length * ROW_H;
        }
        if (c.numeroPedimento) conceptoHeight += 4;
        if (c.cuentaPredial) conceptoHeight += 4;

        y = ensureSpace(doc, y, conceptoHeight);

        // Data row — compute wrapped text per cell and row height
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(TABLE_FONT);
        const LINE_H = 2.5;
        const CELL_PAD = 1.2;
        const cellLines = [];
        let maxLines = 1;
        for (let i = 0; i < conceptCols.length; i++) {
            const lines = doc.splitTextToSize(String(vals[i]), conceptCols[i].w - 2);
            cellLines.push(lines);
            if (lines.length > maxLines) maxLines = lines.length;
        }
        const dataRowH = Math.max(ROW_H, maxLines * LINE_H + CELL_PAD * 2);
        cx = MARGIN;
        for (let i = 0; i < conceptCols.length; i++) {
            const col = conceptCols[i];
            doc.rect(cx, y, col.w, dataRowH);
            const textX = col.align === 'right' ? cx + col.w - 1 : cx + 1;
            doc.text(cellLines[i], textX, y + CELL_PAD + LINE_H * 0.8, { align: col.align === 'right' ? 'right' : 'left' });
            cx += col.w;
        }
        y += dataRowH;

        // Description row (full width)
        const descText = 'Descripción: ' + (c.descripcion || '');
        const wrappedDesc = doc.splitTextToSize(descText, CONTENT_W - 4);
        const descRowH = wrappedDesc.length * 2.5 + 2;
        doc.rect(MARGIN, y, CONTENT_W, descRowH);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(SMALL_FONT);
        doc.text(wrappedDesc, MARGIN + 2, y + 2.8);
        doc.setFont('helvetica', 'normal');
        y += descRowH;

        // Tax sub-table for this concepto
        if (c.impuestos && c.impuestos.length > 0) {
            const taxCols = [
                { label: 'Impuesto', w: 25, align: 'left' },
                { label: 'Tipo', w: 25, align: 'left' },
                { label: 'Base', w: 30, align: 'right' },
                { label: 'Tipo Factor', w: 25, align: 'left' },
                { label: 'Tasa o Cuota', w: 30, align: 'right' },
                { label: 'Importe', w: CONTENT_W - 10 - (25 + 25 + 30 + 25 + 30), align: 'right' },
            ];
            const taxTableW = taxCols.reduce((s, c2) => s + c2.w, 0);
            const taxStartX = MARGIN + 5;

            // Tax header
            doc.setFillColor(235, 235, 235);
            doc.rect(taxStartX, y, taxTableW, ROW_H, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(SMALL_FONT);
            let tx = taxStartX;
            for (const tc of taxCols) {
                doc.rect(tx, y, tc.w, ROW_H);
                const ttx = tc.align === 'right' ? tx + tc.w - 1 : tx + 1;
                doc.text(tc.label, ttx, y + 3.2, { align: tc.align === 'right' ? 'right' : 'left' });
                tx += tc.w;
            }
            y += ROW_H;

            // Tax rows
            doc.setFont('helvetica', 'normal');
            for (const imp of c.impuestos) {
                const taxVals = [
                    IMPUESTO_NAMES[imp.impuesto] || imp.impuesto || '',
                    imp.tipo || '',
                    fmtMoney(imp.base),
                    imp.tipoFactor || '',
                    fmtRate(imp.tasaOCuota),
                    fmtMoney(imp.importe),
                ];
                tx = taxStartX;
                for (let i = 0; i < taxCols.length; i++) {
                    const tc = taxCols[i];
                    doc.rect(tx, y, tc.w, ROW_H);
                    const ttx = tc.align === 'right' ? tx + tc.w - 1 : tx + 1;
                    doc.text(String(taxVals[i]), ttx, y + 3.2, { align: tc.align === 'right' ? 'right' : 'left' });
                    tx += tc.w;
                }
                y += ROW_H;
            }
        }

        // Numero de pedimento / cuenta predial
        if (c.numeroPedimento) {
            doc.setFontSize(SMALL_FONT);
            doc.setFont('helvetica', 'bold');
            doc.text('Número de pedimento: ', MARGIN + 5, y + 2.5);
            doc.setFont('helvetica', 'normal');
            doc.text(c.numeroPedimento, MARGIN + 5 + doc.getTextWidth('Número de pedimento: ') + 1, y + 2.5);
            y += 4;
        }
        if (c.cuentaPredial) {
            doc.setFontSize(SMALL_FONT);
            doc.setFont('helvetica', 'bold');
            doc.text('Cuenta predial: ', MARGIN + 5, y + 2.5);
            doc.setFont('helvetica', 'normal');
            doc.text(c.cuentaPredial, MARGIN + 5 + doc.getTextWidth('Cuenta predial: ') + 1, y + 2.5);
            y += 4;
        }

        y += 1; // spacing between conceptos
    }

    y += SECTION_GAP;

    // ========================================================================
    // SECTION 3: Payment info + Totals
    // ========================================================================
    y = ensureSpace(doc, y, 35);

    const payLeftX = MARGIN;
    const payRightX = MARGIN + CONTENT_W / 2 + 10;
    const totalsLabelX = payRightX;
    const totalsValueX = MARGIN + CONTENT_W - 1;
    let payY = y;

    // Left side: payment info
    doc.setFontSize(NORMAL_FONT);
    payY = drawLabelValue(doc, payLeftX, payY, CONTENT_W / 2, 'Moneda: ', data.moneda || '');
    if (data.tipoCambio && data.tipoCambio !== '1') {
        payY = drawLabelValue(doc, payLeftX, payY, CONTENT_W / 2, 'Tipo de cambio: ', data.tipoCambio);
    }
    payY = drawLabelValue(doc, payLeftX, payY, CONTENT_W / 2, 'Forma de pago: ', data.formaPagoDesc || data.formaPago || '');
    payY = drawLabelValue(doc, payLeftX, payY, CONTENT_W / 2, 'Método de pago: ', data.metodoPagoDesc || data.metodoPago || '');

    // Right side: totals
    let totY = y;
    const drawTotalLine = (label, amount) => {
        doc.setFontSize(NORMAL_FONT);
        doc.setFont('helvetica', 'bold');
        doc.text(label, totalsLabelX, totY);
        doc.setFont('helvetica', 'normal');
        doc.text(fmtMoney(amount), totalsValueX, totY, { align: 'right' });
        totY += 4;
    };

    drawTotalLine('Subtotal:', data.subTotal);
    if (data.descuento) {
        drawTotalLine('Descuento:', data.descuento);
    }
    // Traslados summary
    if (data.trasladosSummary && data.trasladosSummary.length > 0) {
        for (const t of data.trasladosSummary) {
            const impName = IMPUESTO_NAMES[t.impuesto] || t.impuesto || '';
            const rate = fmtRate(t.tasaOCuota);
            drawTotalLine(`Impuestos trasladados ${impName} ${rate}:`, t.importe);
        }
    }
    // Retenciones summary
    if (data.retencionesSummary && data.retencionesSummary.length > 0) {
        let retTotal = 0;
        for (const r of data.retencionesSummary) {
            retTotal += parseFloat(r.importe || 0);
        }
        drawTotalLine('Impuestos retenidos:', retTotal);
    }

    // Separator line before total
    doc.setDrawColor(0, 0, 0);
    doc.line(totalsLabelX, totY - 1, totalsValueX, totY - 1);
    totY += 1;

    doc.setFontSize(8);
    drawTotalLine('Total:', data.total);

    y = Math.max(payY, totY) + SECTION_GAP;

    // ========================================================================
    // SECTION 4: Digital Seals
    // ========================================================================
    const sealFontSize = 5.5;
    const selloLines = doc.setFontSize(sealFontSize) && doc.splitTextToSize(data.sello || '', CONTENT_W - 2);
    const selloSATLines = doc.splitTextToSize(data.tfd?.selloSAT || '', CONTENT_W - 2);
    const sealHeight = 8 + selloLines.length * 2 + 8 + selloSATLines.length * 2;

    y = ensureSpace(doc, y, sealHeight);

    // Sello digital del CFDI
    doc.setFontSize(NORMAL_FONT);
    doc.setFont('helvetica', 'bold');
    doc.text('Sello digital del CFDI:', MARGIN, y);
    y += 3;
    doc.setFontSize(sealFontSize);
    doc.setFont('helvetica', 'normal');
    doc.text(selloLines, MARGIN, y);
    y += selloLines.length * 2 + 3;

    // Sello digital del SAT
    doc.setFontSize(NORMAL_FONT);
    doc.setFont('helvetica', 'bold');
    doc.text('Sello digital del SAT:', MARGIN, y);
    y += 3;
    doc.setFontSize(sealFontSize);
    doc.setFont('helvetica', 'normal');
    doc.text(selloSATLines, MARGIN, y);
    y += selloSATLines.length * 2 + SECTION_GAP;

    // ========================================================================
    // SECTION 5: QR Code + Certification Details
    // ========================================================================
    const qrSize = 38;
    const certBlockH = qrSize + 4;

    y = ensureSpace(doc, y, certBlockH);

    // QR Code (left side)
    try {
        const qrUrl = buildQRUrl(data);
        const qr = qrcode(0, 'M');
        qr.addData(qrUrl);
        qr.make();
        const dataUrl = qr.createDataURL(4);
        doc.addImage(dataUrl, 'PNG', MARGIN, y, qrSize, qrSize);
    } catch (e) {
        // If QR generation fails, draw placeholder
        doc.setDrawColor(180, 180, 180);
        doc.rect(MARGIN, y, qrSize, qrSize);
        doc.setFontSize(6);
        doc.text('QR no disponible', MARGIN + 2, y + qrSize / 2);
    }

    // Right side: certification details
    const certX = MARGIN + qrSize + 5;
    const certW = CONTENT_W - qrSize - 5;
    let certY = y;

    // Cadena original
    doc.setFontSize(SMALL_FONT);
    doc.setFont('helvetica', 'bold');
    doc.text('Cadena Original del complemento de certificación digital del SAT:', certX, certY);
    certY += 2.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    const cadenaLines = doc.splitTextToSize(data.cadenaOriginal || '', certW);
    doc.text(cadenaLines, certX, certY);
    certY += cadenaLines.length * 1.8 + 2;

    doc.setFontSize(SMALL_FONT);
    certY = drawLabelValue(doc, certX, certY, certW, 'RFC del proveedor de certificación: ', data.tfd?.rfcProvCertif || '', SMALL_FONT);
    certY = drawLabelValue(doc, certX, certY, certW, 'No. de serie del certificado SAT: ', data.tfd?.noCertificadoSAT || '', SMALL_FONT);
    certY = drawLabelValue(doc, certX, certY, certW, 'Fecha y hora de certificación: ', data.tfd?.fechaTimbrado || '', SMALL_FONT);

    y = Math.max(y + qrSize, certY) + SECTION_GAP;

    // ========================================================================
    // SECTION 6: Footer on every page
    // ========================================================================
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setDrawColor(180, 180, 180);
        doc.line(MARGIN, PAGE_H - 12, MARGIN + CONTENT_W, PAGE_H - 12);
        doc.text('Este documento es una representación impresa de un CFDI', MARGIN, PAGE_H - 8);
        doc.text(`Página ${p} de ${totalPages}`, MARGIN + CONTENT_W, PAGE_H - 8, { align: 'right' });
    }

    return doc.output('blob');
}
