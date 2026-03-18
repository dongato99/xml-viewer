/**
 * Pago CFDI PDF Generator — renders a payment complement as PDF using jsPDF.
 * Faithfully replicates the SAT Complemento de Pago format.
 */

const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_ZONE = 25;
const GRAY_BG = [220, 220, 220];
const LIGHT_GRAY_BG = [235, 235, 235];
const TABLE_FONT = 6;
const SMALL_FONT = 5.5;
const NORMAL_FONT = 7;
const HEADER_FONT = 7;
const SECTION_GAP = 6;
const ROW_H = 5;
const HEADER_ROW_H = 6;

const IMPUESTO_NAMES = { '001': 'ISR', '002': 'IVA', '003': 'IEPS' };

function fmtMoney(val) {
    if (!val && val !== 0) return '';
    const n = parseFloat(val);
    if (isNaN(n)) return String(val);
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRate(val) {
    if (!val) return '';
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    return n.toFixed(6);
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

function drawSimpleTable(doc, y, columns, rows) {
    const totalW = columns.reduce((s, c) => s + c.w, 0);
    y = ensureSpace(doc, y, HEADER_ROW_H + rows.length * ROW_H);

    // Header
    doc.setFillColor(...GRAY_BG);
    doc.rect(MARGIN, y - 3.5, totalW, HEADER_ROW_H, 'F');
    doc.setDrawColor(100, 100, 100);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TABLE_FONT);
    let cx = MARGIN;
    for (const col of columns) {
        doc.rect(cx, y - 3.5, col.w, HEADER_ROW_H);
        const textX = col.align === 'right' ? cx + col.w - 1 : cx + 1;
        doc.text(col.label, textX, y, { align: col.align === 'right' ? 'right' : 'left' });
        cx += col.w;
    }
    y += HEADER_ROW_H - 3.5;

    // Rows
    doc.setFont('helvetica', 'normal');
    for (const row of rows) {
        y = ensureSpace(doc, y, ROW_H);
        cx = MARGIN;
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            doc.rect(cx, y, col.w, ROW_H);
            const textX = col.align === 'right' ? cx + col.w - 1 : cx + 1;
            doc.text(String(row[i] ?? ''), textX, y + 3.2, { align: col.align === 'right' ? 'right' : 'left' });
            cx += col.w;
        }
        y += ROW_H;
    }

    return y;
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
 * Generate a Pago CFDI PDF.
 * @param {object} data - Parsed data from parsePagoCFDIForPrint
 * @returns {Blob}
 */
export function generatePagoPdf(data) {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    let y = MARGIN;

    // ================================================================
    // SECTION 1: Header
    // ================================================================
    const colW = CONTENT_W / 2 - 2;
    const leftX = MARGIN;
    const rightX = MARGIN + colW + 4;

    let leftY = y;
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'RFC emisor: ', data.emisor?.rfc);
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Nombre emisor: ', data.emisor?.nombre);
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Folio: ', data.folio);
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'RFC receptor: ', data.receptor?.rfc);
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Nombre receptor: ', data.receptor?.nombre);
    if (data.receptor?.domicilioFiscalReceptor) {
        leftY = drawLabelValue(doc, leftX, leftY, colW, 'Código postal del receptor: ', data.receptor.domicilioFiscalReceptor);
    }
    if (data.receptor?.regimenFiscalReceptorDesc) {
        leftY = drawLabelValue(doc, leftX, leftY, colW, 'Régimen fiscal receptor: ', data.receptor.regimenFiscalReceptorDesc);
    }
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Uso CFDI: ', data.receptor?.usoCFDIDesc);

    let rightY = y;
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Folio fiscal: ', data.tfd?.uuid);
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'No. de serie del CSD: ', data.noCertificado);
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Serie: ', data.serie);
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Código postal, fecha y hora de emisión: ', (data.lugarExpedicion || '') + ' ' + (data.fecha || ''));
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Efecto de comprobante: ', data.tipoDeComprobanteDesc);
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Régimen fiscal: ', data.emisor?.regimenFiscalDesc);
    if (data.exportacionDesc) {
        rightY = drawLabelValue(doc, rightX, rightY, colW, 'Exportación: ', data.exportacionDesc);
    }

    y = Math.max(leftY, rightY) + SECTION_GAP;

    // ================================================================
    // SECTION 2: Conceptos Table
    // ================================================================
    const conceptCols = [
        { label: 'Clave del producto\ny/o servicio', w: 20, align: 'left' },
        { label: 'No. identificación', w: 18, align: 'left' },
        { label: 'Cantidad', w: 14, align: 'right' },
        { label: 'Clave de unidad', w: 18, align: 'left' },
        { label: 'Unidad', w: 22, align: 'left' },
        { label: 'Valor unitario', w: 20, align: 'right' },
        { label: 'Importe', w: 20, align: 'right' },
        { label: 'Descuento', w: 18, align: 'right' },
        { label: 'Objeto impuesto', w: CONTENT_W - (20 + 18 + 14 + 18 + 22 + 20 + 20 + 18), align: 'left' },
    ];

    y = drawSectionTitle(doc, y, 'Conceptos');

    for (const c of (data.conceptos || [])) {
        const vals = [c.claveProdServ, c.noIdentificacion, c.cantidad, c.claveUnidad, c.unidad, c.valorUnitario, c.importe, c.descuento, c.objetoImpDesc || c.objetoImp];
        y = drawSimpleTable(doc, y, conceptCols, [vals]);

        // Description row
        const descText = 'Descripción    ' + (c.descripcion || '');
        doc.setFontSize(SMALL_FONT);
        doc.setFont('helvetica', 'italic');
        const wrappedDesc = doc.splitTextToSize(descText, CONTENT_W - 4);
        const descRowH = wrappedDesc.length * 2.5 + 2;
        doc.rect(MARGIN, y, CONTENT_W, descRowH);
        doc.text(wrappedDesc, MARGIN + 2, y + 2.8);
        doc.setFont('helvetica', 'normal');
        y += descRowH;

        // Número de pedimento / Cuenta predial row
        doc.setFontSize(SMALL_FONT);
        const pedRowH = 4;
        doc.rect(MARGIN, y, CONTENT_W / 2, pedRowH);
        doc.rect(MARGIN + CONTENT_W / 2, y, CONTENT_W / 2, pedRowH);
        doc.setFont('helvetica', 'bold');
        doc.text('Número de pedimento', MARGIN + 2, y + 2.8);
        doc.text('Número de cuenta predial', MARGIN + CONTENT_W / 2 + 2, y + 2.8);
        doc.setFont('helvetica', 'normal');
        y += pedRowH;
    }

    // Moneda + Subtotal/Total
    y += 2;
    doc.setFontSize(NORMAL_FONT);
    let monedaY = y;
    monedaY = drawLabelValue(doc, MARGIN, monedaY, CONTENT_W / 2, 'Moneda: ', data.monedaDesc || data.moneda || '');

    const totX = MARGIN + CONTENT_W / 2 + 10;
    const totValX = MARGIN + CONTENT_W - 1;
    let totY = y;
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal', totX, totY);
    doc.setFont('helvetica', 'normal');
    doc.text('$ ' + (data.subTotal || '0'), totValX, totY, { align: 'right' });
    totY += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Total', totX, totY);
    doc.setFont('helvetica', 'normal');
    doc.text('$ ' + (data.total || '0'), totValX, totY, { align: 'right' });
    totY += 4;

    y = Math.max(monedaY, totY) + SECTION_GAP;

    // ================================================================
    // SECTION 3: Montos Totales de los Pagos
    // ================================================================
    if (data.pagosTotales) {
        y = drawSectionTitle(doc, y, 'Montos Totales de los Pagos');
        const t = data.pagosTotales;

        let mtLeft = y;
        mtLeft = drawLabelValue(doc, MARGIN, mtLeft, CONTENT_W / 2, 'Monto Total Pagos: ', fmtMoney(t.montoTotalPagos));

        let mtRight = y;
        mtRight = drawLabelValue(doc, MARGIN + CONTENT_W / 2, mtRight, CONTENT_W / 2, 'Total Traslados Base IVA 16: ', fmtMoney(t.totalTrasladosBaseIVA16));
        mtRight = drawLabelValue(doc, MARGIN + CONTENT_W / 2, mtRight, CONTENT_W / 2, 'Total Traslados Impuesto IVA 16: ', fmtMoney(t.totalTrasladosImpuestoIVA16));

        y = Math.max(mtLeft, mtRight) + SECTION_GAP;
    }

    // ================================================================
    // SECTIONS 4-7: Per-Pago + Per-DoctoRelacionado
    // ================================================================
    for (const pago of (data.pagos || [])) {
        // SECTION 4: Información del Pago
        y = drawSectionTitle(doc, y, 'Información del pago');

        const piLeft = MARGIN;
        const piRight = MARGIN + CONTENT_W / 2;
        let piLeftY = y;
        let piRightY = y;

        piLeftY = drawLabelValue(doc, piLeft, piLeftY, CONTENT_W / 2, 'Forma de pago: ', pago.formaPagoDesc || pago.formaPagoP);
        piLeftY = drawLabelValue(doc, piLeft, piLeftY, CONTENT_W / 2, 'Número operación: ', pago.numOperacion);

        piRightY = drawLabelValue(doc, piRight, piRightY, CONTENT_W / 2, 'Fecha de pago: ', pago.fechaPago);
        piRightY = drawLabelValue(doc, piRight, piRightY, CONTENT_W / 2, 'Moneda de pago: ', pago.monedaDesc || pago.monedaP);
        piRightY = drawLabelValue(doc, piRight, piRightY, CONTENT_W / 2, 'Tipo de cambio del pago: ', pago.tipoCambioP || '1');
        piRightY = drawLabelValue(doc, piRight, piRightY, CONTENT_W / 2, 'Monto: ', fmtMoney(pago.monto));

        y = Math.max(piLeftY, piRightY) + SECTION_GAP;

        // SECTION 5: Impuestos del Pago
        if (pago.trasladosP && pago.trasladosP.length > 0) {
            y = drawSectionTitle(doc, y, 'Impuestos del Pago');
            y = drawSectionTitle(doc, y - 4, 'Traslados del Pago');

            const taxCols = [
                { label: 'Base', w: 35, align: 'right' },
                { label: 'Impuesto', w: 35, align: 'left' },
                { label: 'Tipo Factor', w: 35, align: 'left' },
                { label: 'Tasa o Cuota', w: 40, align: 'right' },
                { label: 'Importe', w: CONTENT_W - (35 + 35 + 35 + 40), align: 'right' },
            ];

            const taxRows = pago.trasladosP.map(t => [
                fmtMoney(t.baseP),
                IMPUESTO_NAMES[t.impuestoP] || t.impuestoP || '',
                t.tipoFactorP || '',
                fmtRate(t.tasaOCuotaP),
                fmtMoney(t.importeP),
            ]);

            y = drawSimpleTable(doc, y, taxCols, taxRows);
            y += SECTION_GAP;
        }

        // Per-DoctoRelacionado
        for (const dr of (pago.doctosRelacionados || [])) {
            // SECTION 6: Documento Relacionado
            y = drawSectionTitle(doc, y, 'Documento relacionado');

            let drLeftY = y;
            let drRightY = y;

            drLeftY = drawLabelValue(doc, MARGIN, drLeftY, CONTENT_W / 2, 'Id documento: ', dr.idDocumento);
            drLeftY = drawLabelValue(doc, MARGIN, drLeftY, CONTENT_W / 2, 'Folio: ', dr.folio);
            drLeftY = drawLabelValue(doc, MARGIN, drLeftY, CONTENT_W / 2, 'Serie: ', dr.serie);
            drLeftY = drawLabelValue(doc, MARGIN, drLeftY, CONTENT_W / 2, 'Número parcialidad: ', dr.numParcialidad);

            drRightY = drawLabelValue(doc, piRight, drRightY, CONTENT_W / 2, 'Equivalencia del documento relacionado: ', dr.equivalenciaDR);
            drRightY = drawLabelValue(doc, piRight, drRightY, CONTENT_W / 2, 'Moneda del documento relacionado: ', dr.monedaDRDesc || dr.monedaDR);
            drRightY = drawLabelValue(doc, piRight, drRightY, CONTENT_W / 2, 'Importe de saldo anterior: ', fmtMoney(dr.impSaldoAnt));
            drRightY = drawLabelValue(doc, piRight, drRightY, CONTENT_W / 2, 'Importe pagado: ', fmtMoney(dr.impPagado));
            drRightY = drawLabelValue(doc, piRight, drRightY, CONTENT_W / 2, 'Importe de saldo insoluto: ', fmtMoney(dr.impSaldoInsoluto));
            drRightY = drawLabelValue(doc, piRight, drRightY, CONTENT_W / 2, 'Objeto Impuesto del documento relacionado: ', dr.objetoImpDRDesc || dr.objetoImpDR);

            y = Math.max(drLeftY, drRightY) + SECTION_GAP;

            // SECTION 7: Impuestos del Documento Relacionado
            if (dr.trasladosDR && dr.trasladosDR.length > 0) {
                y = drawSectionTitle(doc, y, 'Impuestos del Documento Relacionado');
                y = drawSectionTitle(doc, y - 4, 'Traslados del Documento Relacionado');

                const drTaxCols = [
                    { label: 'Base', w: 35, align: 'right' },
                    { label: 'Impuesto', w: 35, align: 'left' },
                    { label: 'Tipo Factor', w: 35, align: 'left' },
                    { label: 'Tasa o Cuota', w: 40, align: 'right' },
                    { label: 'Importe', w: CONTENT_W - (35 + 35 + 35 + 40), align: 'right' },
                ];

                const drTaxRows = dr.trasladosDR.map(t => [
                    fmtMoney(t.baseDR),
                    IMPUESTO_NAMES[t.impuestoDR] || t.impuestoDR || '',
                    t.tipoFactorDR || '',
                    fmtRate(t.tasaOCuotaDR),
                    fmtMoney(t.importeDR),
                ]);

                y = drawSimpleTable(doc, y, drTaxCols, drTaxRows);
                y += SECTION_GAP;
            }
        }
    }

    // ================================================================
    // SECTION 8: Digital Seals
    // ================================================================
    const sealFontSize = 5.5;
    doc.setFontSize(sealFontSize);
    const selloLines = doc.splitTextToSize(data.sello || '', CONTENT_W - 2);
    const selloSATLines = doc.splitTextToSize(data.tfd?.selloSAT || '', CONTENT_W - 2);
    const sealHeight = 8 + selloLines.length * 2 + 8 + selloSATLines.length * 2;

    y = ensureSpace(doc, y, sealHeight);

    doc.setFontSize(NORMAL_FONT);
    doc.setFont('helvetica', 'bold');
    doc.text('Sello digital del CFDI:', MARGIN, y);
    y += 3;
    doc.setFontSize(sealFontSize);
    doc.setFont('helvetica', 'normal');
    doc.text(selloLines, MARGIN, y);
    y += selloLines.length * 2 + 3;

    doc.setFontSize(NORMAL_FONT);
    doc.setFont('helvetica', 'bold');
    doc.text('Sello digital del SAT:', MARGIN, y);
    y += 3;
    doc.setFontSize(sealFontSize);
    doc.setFont('helvetica', 'normal');
    doc.text(selloSATLines, MARGIN, y);
    y += selloSATLines.length * 2 + SECTION_GAP;

    // ================================================================
    // SECTION 9: QR Code + Certification
    // ================================================================
    const qrSize = 38;
    y = ensureSpace(doc, y, qrSize + 4);

    try {
        const qrUrl = buildQRUrl(data);
        const qr = qrcode(0, 'M');
        qr.addData(qrUrl);
        qr.make();
        const dataUrl = qr.createDataURL(4);
        doc.addImage(dataUrl, 'PNG', MARGIN, y, qrSize, qrSize);
    } catch (e) {
        doc.setDrawColor(180, 180, 180);
        doc.rect(MARGIN, y, qrSize, qrSize);
        doc.setFontSize(6);
        doc.text('QR no disponible', MARGIN + 2, y + qrSize / 2);
    }

    const certX = MARGIN + qrSize + 5;
    const certW = CONTENT_W - qrSize - 5;
    let certY = y;

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
    certY = drawLabelValue(doc, certX, certY, certW, 'RFC del proveedor de certificación: ', data.tfd?.rfcProvCertif, SMALL_FONT);
    certY = drawLabelValue(doc, certX, certY, certW, 'No. de serie del certificado SAT: ', data.tfd?.noCertificadoSAT, SMALL_FONT);
    certY = drawLabelValue(doc, certX, certY, certW, 'Fecha y hora de certificación: ', data.tfd?.fechaTimbrado, SMALL_FONT);

    y = Math.max(y + qrSize, certY) + SECTION_GAP;

    // ================================================================
    // SECTION 10: Footer on every page
    // ================================================================
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setDrawColor(180, 180, 180);
        doc.line(MARGIN, PAGE_H - 12, MARGIN + CONTENT_W, PAGE_H - 12);
        doc.text('Este documento es una representación impresa de un CFDI', MARGIN, PAGE_H - 8);
        doc.text(`Página ${p} de ${totalPages}`, MARGIN + CONTENT_W, PAGE_H - 8, { align: 'right' });

        // RFC emisor + Folio fiscal on every page header
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        if (p > 1) {
            doc.text('RFC emisor:', MARGIN, MARGIN - 3);
            doc.setFont('helvetica', 'normal');
            doc.text(data.emisor?.rfc || '', MARGIN + doc.getTextWidth('RFC emisor: '), MARGIN - 3);
            doc.setFont('helvetica', 'bold');
            doc.text('Folio fiscal:', MARGIN + CONTENT_W / 2, MARGIN - 3);
            doc.setFont('helvetica', 'normal');
            doc.text(data.tfd?.uuid || '', MARGIN + CONTENT_W / 2 + doc.getTextWidth('Folio fiscal: '), MARGIN - 3);
        }
    }

    return doc.output('blob');
}
