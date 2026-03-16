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

// === cfdi-print-parser.js ===

/**
 * Parse a CFDI XML string into a full object for PDF rendering.
 * Returns null on parse errors or if no Comprobante element is found.
 */
function parseCFDIForPrint(xmlString) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');

        if (doc.querySelector('parsererror')) {
            return null;
        }

        // Detect namespace — try 4.0 first, then 3.3
        let ns = NS_CFDI_40;
        let comprobante = doc.getElementsByTagNameNS(ns, 'Comprobante')[0];
        let is40 = true;
        if (!comprobante) {
            ns = NS_CFDI_33;
            comprobante = doc.getElementsByTagNameNS(ns, 'Comprobante')[0];
            is40 = false;
        }
        if (!comprobante) {
            return null;
        }

        const attr = (el, name) => el?.getAttribute(name) || '';

        // --- Comprobante attributes ---
        const version = attr(comprobante, 'Version');
        const serie = attr(comprobante, 'Serie');
        const folio = attr(comprobante, 'Folio');
        const fecha = attr(comprobante, 'Fecha');
        const sello = attr(comprobante, 'Sello');
        const formaPago = attr(comprobante, 'FormaPago');
        const noCertificado = attr(comprobante, 'NoCertificado');
        const subTotal = attr(comprobante, 'SubTotal');
        const descuento = attr(comprobante, 'Descuento');
        const moneda = attr(comprobante, 'Moneda');
        const tipoCambio = attr(comprobante, 'TipoCambio');
        const total = attr(comprobante, 'Total');
        const tipoDeComprobante = attr(comprobante, 'TipoDeComprobante');
        const metodoPago = attr(comprobante, 'MetodoPago');
        const lugarExpedicion = attr(comprobante, 'LugarExpedicion');
        const exportacion = attr(comprobante, 'Exportacion');

        // --- Emisor ---
        const emisorEl = doc.getElementsByTagNameNS(ns, 'Emisor')[0];
        const emisor = {
            rfc: attr(emisorEl, 'Rfc'),
            nombre: attr(emisorEl, 'Nombre'),
            regimenFiscal: attr(emisorEl, 'RegimenFiscal'),
            regimenFiscalDesc: lookupRegimenFiscal(attr(emisorEl, 'RegimenFiscal')),
        };

        // --- Receptor ---
        const receptorEl = doc.getElementsByTagNameNS(ns, 'Receptor')[0];
        const usoCFDI = attr(receptorEl, 'UsoCFDI');
        const regimenFiscalReceptor = is40 ? attr(receptorEl, 'RegimenFiscalReceptor') : '';
        const domicilioFiscalReceptor = is40 ? attr(receptorEl, 'DomicilioFiscalReceptor') : '';
        const receptor = {
            rfc: attr(receptorEl, 'Rfc'),
            nombre: attr(receptorEl, 'Nombre'),
            usoCFDI,
            usoCFDIDesc: lookupUsoCFDI(usoCFDI),
            regimenFiscalReceptor,
            regimenFiscalReceptorDesc: regimenFiscalReceptor ? lookupRegimenFiscal(regimenFiscalReceptor) : '',
            domicilioFiscalReceptor,
        };

        // --- Conceptos ---
        const conceptoEls = doc.getElementsByTagNameNS(ns, 'Concepto');
        const conceptos = [];
        for (let i = 0; i < conceptoEls.length; i++) {
            const c = conceptoEls[i];
            const objetoImp = attr(c, 'ObjetoImp');

            // Concept-level impuestos (traslados + retenciones)
            const impuestos = [];
            const conceptoTraslados = c.getElementsByTagNameNS(ns, 'Traslado');
            for (let j = 0; j < conceptoTraslados.length; j++) {
                const t = conceptoTraslados[j];
                impuestos.push({
                    tipo: 'Traslado',
                    impuesto: attr(t, 'Impuesto'),
                    base: attr(t, 'Base'),
                    tipoFactor: attr(t, 'TipoFactor'),
                    tasaOCuota: attr(t, 'TasaOCuota'),
                    importe: attr(t, 'Importe'),
                });
            }
            const conceptoRetenciones = c.getElementsByTagNameNS(ns, 'Retencion');
            for (let j = 0; j < conceptoRetenciones.length; j++) {
                const r = conceptoRetenciones[j];
                impuestos.push({
                    tipo: 'Retención',
                    impuesto: attr(r, 'Impuesto'),
                    base: attr(r, 'Base'),
                    tipoFactor: attr(r, 'TipoFactor'),
                    tasaOCuota: attr(r, 'TasaOCuota'),
                    importe: attr(r, 'Importe'),
                });
            }

            // InformacionAduanera — NumeroPedimento
            const aduanaEl = c.getElementsByTagNameNS(ns, 'InformacionAduanera')[0];
            const numeroPedimento = attr(aduanaEl, 'NumeroPedimento');

            // CuentaPredial
            const predialEl = c.getElementsByTagNameNS(ns, 'CuentaPredial')[0];
            const cuentaPredial = attr(predialEl, 'Numero');

            conceptos.push({
                claveProdServ: attr(c, 'ClaveProdServ'),
                noIdentificacion: attr(c, 'NoIdentificacion'),
                cantidad: attr(c, 'Cantidad'),
                claveUnidad: attr(c, 'ClaveUnidad'),
                unidad: attr(c, 'Unidad'),
                descripcion: attr(c, 'Descripcion'),
                valorUnitario: attr(c, 'ValorUnitario'),
                importe: attr(c, 'Importe'),
                descuento: attr(c, 'Descuento'),
                objetoImp,
                objetoImpDesc: lookupObjetoImp(objetoImp),
                impuestos,
                numeroPedimento,
                cuentaPredial,
            });
        }

        // --- Comprobante-level Impuestos ---
        let totalImpuestosTrasladados = '';
        let totalImpuestosRetenidos = '';
        const trasladosSummary = [];
        const retencionesSummary = [];

        const impuestosEls = doc.getElementsByTagNameNS(ns, 'Impuestos');
        for (let i = 0; i < impuestosEls.length; i++) {
            const imp = impuestosEls[i];
            if (imp.parentElement !== comprobante) continue;

            totalImpuestosTrasladados = attr(imp, 'TotalImpuestosTrasladados');
            totalImpuestosRetenidos = attr(imp, 'TotalImpuestosRetenidos');

            const traslados = imp.getElementsByTagNameNS(ns, 'Traslado');
            for (let j = 0; j < traslados.length; j++) {
                const t = traslados[j];
                trasladosSummary.push({
                    base: attr(t, 'Base'),
                    impuesto: attr(t, 'Impuesto'),
                    tipoFactor: attr(t, 'TipoFactor'),
                    tasaOCuota: attr(t, 'TasaOCuota'),
                    importe: attr(t, 'Importe'),
                });
            }

            const retenciones = imp.getElementsByTagNameNS(ns, 'Retencion');
            for (let j = 0; j < retenciones.length; j++) {
                const r = retenciones[j];
                retencionesSummary.push({
                    impuesto: attr(r, 'Impuesto'),
                    importe: attr(r, 'Importe'),
                });
            }
            break;
        }

        // --- TimbreFiscalDigital ---
        const tfdEl = doc.getElementsByTagNameNS(NS_TFD, 'TimbreFiscalDigital')[0];
        const tfd = {
            version: attr(tfdEl, 'Version'),
            uuid: attr(tfdEl, 'UUID'),
            fechaTimbrado: attr(tfdEl, 'FechaTimbrado'),
            rfcProvCertif: attr(tfdEl, 'RfcProvCertif'),
            selloCFD: attr(tfdEl, 'SelloCFD'),
            noCertificadoSAT: attr(tfdEl, 'NoCertificadoSAT'),
            selloSAT: attr(tfdEl, 'SelloSAT'),
        };

        // --- Cadena original del timbre ---
        const cadenaOriginal = `||${tfd.version}|${tfd.uuid}|${tfd.fechaTimbrado}|${tfd.rfcProvCertif}|${tfd.selloCFD}|${tfd.noCertificadoSAT}||`;

        return {
            // Comprobante
            version,
            serie,
            folio,
            fecha,
            sello,
            formaPago,
            formaPagoDesc: lookupFormaPago(formaPago),
            noCertificado,
            subTotal,
            descuento,
            moneda,
            tipoCambio,
            total,
            tipoDeComprobante,
            tipoDeComprobanteDesc: lookupTipoComprobante(tipoDeComprobante),
            metodoPago,
            metodoPagoDesc: lookupMetodoPago(metodoPago),
            lugarExpedicion,
            exportacion,
            exportacionDesc: lookupExportacion(exportacion),

            // Parties
            emisor,
            receptor,

            // Line items
            conceptos,

            // Comprobante-level taxes
            totalImpuestosTrasladados,
            totalImpuestosRetenidos,
            trasladosSummary,
            retencionesSummary,

            // Timbre
            tfd,
            cadenaOriginal,
        };
    } catch (e) {
        return null;
    }
}

// === pdf-generator.js ===

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
 * Format tasaOCuota as percentage string, e.g. 0.160000 -> "16.00%"
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
function generateCFDIPdf(data) {
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
        leftY = drawLabelValue(doc, leftX, leftY, colW, 'Codigo postal del receptor: ', data.receptor.domicilioFiscalReceptor);
    }
    if (data.receptor?.regimenFiscalReceptorDesc) {
        leftY = drawLabelValue(doc, leftX, leftY, colW, 'Regimen fiscal receptor: ', data.receptor.regimenFiscalReceptorDesc);
    }
    leftY = drawLabelValue(doc, leftX, leftY, colW, 'Uso CFDI: ', data.receptor?.usoCFDIDesc || '');

    // Right column
    let rightY = y;
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Folio fiscal: ', data.tfd?.uuid || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'No. de serie del CSD: ', data.noCertificado || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Serie: ', data.serie || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Codigo postal, fecha y hora de emision: ', (data.lugarExpedicion || '') + ' ' + (data.fecha || ''));
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Efecto de comprobante: ', data.tipoDeComprobanteDesc || '');
    rightY = drawLabelValue(doc, rightX, rightY, colW, 'Regimen fiscal: ', data.emisor?.regimenFiscalDesc || '');
    if (data.exportacionDesc) {
        rightY = drawLabelValue(doc, rightX, rightY, colW, 'Exportacion: ', data.exportacionDesc);
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
        const descLines = doc.splitTextToSize('Descripcion: ' + (c.descripcion || ''), CONTENT_W - 2);
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
        const descText = 'Descripcion: ' + (c.descripcion || '');
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
            doc.text('Numero de pedimento: ', MARGIN + 5, y + 2.5);
            doc.setFont('helvetica', 'normal');
            doc.text(c.numeroPedimento, MARGIN + 5 + doc.getTextWidth('Numero de pedimento: ') + 1, y + 2.5);
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
    payY = drawLabelValue(doc, payLeftX, payY, CONTENT_W / 2, 'Metodo de pago: ', data.metodoPagoDesc || data.metodoPago || '');

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
    doc.text('Cadena Original del complemento de certificacion digital del SAT:', certX, certY);
    certY += 2.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    const cadenaLines = doc.splitTextToSize(data.cadenaOriginal || '', certW);
    doc.text(cadenaLines, certX, certY);
    certY += cadenaLines.length * 1.8 + 2;

    doc.setFontSize(SMALL_FONT);
    certY = drawLabelValue(doc, certX, certY, certW, 'RFC del proveedor de certificacion: ', data.tfd?.rfcProvCertif || '', SMALL_FONT);
    certY = drawLabelValue(doc, certX, certY, certW, 'No. de serie del certificado SAT: ', data.tfd?.noCertificadoSAT || '', SMALL_FONT);
    certY = drawLabelValue(doc, certX, certY, certW, 'Fecha y hora de certificacion: ', data.tfd?.fechaTimbrado || '', SMALL_FONT);

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
        doc.text('Este documento es una representacion impresa de un CFDI', MARGIN, PAGE_H - 8);
        doc.text(`Pagina ${p} de ${totalPages}`, MARGIN + CONTENT_W, PAGE_H - 8, { align: 'right' });
    }

    return doc.output('blob');
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
const xmlStore = new Map();

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
    xmlStore.clear();
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
    const removedUuids = [...selectedRows].map(row => row.uuid);
    allRows = allRows.filter(row => !selectedRows.has(row));
    selectedRows.clear();
    removedUuids.forEach(uuid => xmlStore.delete(uuid));
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

    const pdfTh = document.createElement('th');
    pdfTh.className = 'pdf-col';
    pdfTh.style.cursor = 'default';
    headerRow.appendChild(pdfTh);

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

    const filterPdfTh = document.createElement('th');
    filterPdfTh.className = 'pdf-col';
    filterRow.appendChild(filterPdfTh);

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

        const pdfTd = document.createElement('td');
        pdfTd.className = 'pdf-col';
        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'pdf-btn';
        pdfBtn.textContent = 'PDF';
        pdfBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            generateAndDownloadPDF(row.uuid);
        });
        pdfTd.appendChild(pdfBtn);
        tr.appendChild(pdfTd);

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
    printSelectedBtn.disabled = count === 0;
    clearSelectedBtn.textContent = count > 0 ? `Quitar Seleccionados (${count})` : 'Quitar Seleccionados';
    exportSelectedBtn.textContent = count > 0 ? `Exportar Seleccionados (${count})` : 'Exportar Seleccionados';
    printSelectedBtn.textContent = count > 0 ? 'Imprimir Seleccionados (' + count + ')' : 'Imprimir Seleccionados';
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
        xmlStore.set(result.uuid, xml);
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

const printSelectedBtn = document.getElementById('print-selected');

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function generateAndDownloadPDF(uuid) {
    const xml = xmlStore.get(uuid);
    if (!xml) return;
    const data = parseCFDIForPrint(xml);
    if (!data) return;
    const blob = generateCFDIPdf(data);
    downloadBlob(blob, uuid + '.pdf');
}

function generateAndDownloadSelectedPDFs() {
    const selected = getSelectedRows();
    if (selected.length === 0) return;
    for (const row of selected) {
        generateAndDownloadPDF(row.uuid);
    }
}

printSelectedBtn.addEventListener('click', () => {
    generateAndDownloadSelectedPDFs();
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
            xmlStore.set(result.uuid, text);
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
