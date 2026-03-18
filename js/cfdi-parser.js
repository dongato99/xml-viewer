import { lookupFormaPago, lookupTipoComprobante, lookupRegimenFiscal } from './sat-catalogs.js';

const NS_CFDI_40 = 'http://www.sat.gob.mx/cfd/4';
const NS_CFDI_33 = 'http://www.sat.gob.mx/cfd/3';
const NS_TFD = 'http://www.sat.gob.mx/TimbreFiscalDigital';

/**
 * Parse a CFDI XML string into a flat row object.
 * Returns null for parse errors, or { error, version, filename } for unsupported versions.
 */
export function parseCFDI(xmlString, filename) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    if (doc.querySelector('parsererror')) {
        return null;
    }

    // Detect namespace — try 4.0 first, then 3.3
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

    // Traslados & Retenciones — read from Comprobante-level Impuestos summary (pre-summed by SAT)
    const impuestos = doc.getElementsByTagNameNS(ns, 'Impuestos');
    let baseTraslado = null;
    let importeTraslado = null;
    let baseRetencion = null;
    let importeRetencion = null;
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
        const retenciones = imp.getElementsByTagNameNS(ns, 'Retencion');
        for (let j = 0; j < retenciones.length; j++) {
            const r = retenciones[j];
            const b = parseFloat(r.getAttribute('Base'));
            const importe = parseFloat(r.getAttribute('Importe'));
            if (!isNaN(b)) baseRetencion = (baseRetencion || 0) + b;
            if (!isNaN(importe)) importeRetencion = (importeRetencion || 0) + importe;
        }
        break;
    }

    const sign = isEgreso ? -1 : 1;
    const total = parseFloat(attr(comprobante, 'Total')) * sign;
    if (baseTraslado !== null) baseTraslado *= sign;
    if (importeTraslado !== null) importeTraslado *= sign;
    if (baseRetencion !== null) baseRetencion *= sign;
    if (importeRetencion !== null) importeRetencion *= sign;

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
        baseRetencion,
        importeRetencion,
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
