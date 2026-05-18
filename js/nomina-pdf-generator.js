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

    // (Rest of sections — added in subsequent tasks.)

    return doc.output('blob');
}
