import { lookupFormaPago } from './sat-catalogs.js';

const NS_CFDI_40 = 'http://www.sat.gob.mx/cfd/4';
const NS_CFDI_33 = 'http://www.sat.gob.mx/cfd/3';
const NS_TFD = 'http://www.sat.gob.mx/TimbreFiscalDigital';
const NS_PAGOS20 = 'http://www.sat.gob.mx/Pagos20';
const NS_PAGOS10 = 'http://www.sat.gob.mx/Pagos';

/**
 * Parse a Pago CFDI XML into flat row objects (one per DoctoRelacionado).
 * Returns { rows: [...], uuid: string } or { error: string, ... }.
 */
export function parsePagoCFDI(xmlString, filename) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    if (doc.querySelector('parsererror')) return null;

    let ns = NS_CFDI_40;
    let comprobante = doc.getElementsByTagNameNS(ns, 'Comprobante')[0];
    if (!comprobante) {
        ns = NS_CFDI_33;
        comprobante = doc.getElementsByTagNameNS(ns, 'Comprobante')[0];
    }
    if (!comprobante) return null;

    const attr = (el, name) => el?.getAttribute(name) || '';

    const pagos = doc.getElementsByTagNameNS(NS_PAGOS20, 'Pagos')[0];
    if (!pagos) {
        const pagos10 = doc.getElementsByTagNameNS(NS_PAGOS10, 'Pagos')[0];
        if (pagos10) {
            return { error: 'pagos10_unsupported', filename };
        }
        return { error: 'no_pagos_complement', filename };
    }

    const emisor = doc.getElementsByTagNameNS(ns, 'Emisor')[0];
    const receptor = doc.getElementsByTagNameNS(ns, 'Receptor')[0];
    const tfd = doc.getElementsByTagNameNS(NS_TFD, 'TimbreFiscalDigital')[0];
    const uuid = attr(tfd, 'UUID');

    const fechaComprobanteRaw = attr(comprobante, 'Fecha');
    const fechaComprobante = formatFecha(fechaComprobanteRaw);

    const rfcEmisor = attr(emisor, 'Rfc');
    const nombreEmisor = attr(emisor, 'Nombre');
    const rfcReceptor = attr(receptor, 'Rfc');
    const nombreReceptor = attr(receptor, 'Nombre');
    const serie = attr(comprobante, 'Serie');
    const folio = attr(comprobante, 'Folio');

    const rows = [];
    const pagoEls = doc.getElementsByTagNameNS(NS_PAGOS20, 'Pago');

    for (let i = 0; i < pagoEls.length; i++) {
        const pago = pagoEls[i];
        const fechaPagoRaw = attr(pago, 'FechaPago');
        const fechaPago = formatFecha(fechaPagoRaw);
        const formaPagoP = attr(pago, 'FormaDePagoP');
        const monedaP = attr(pago, 'MonedaP');
        const montoPago = parseFloat(attr(pago, 'Monto')) || 0;
        const numOperacion = attr(pago, 'NumOperacion');

        const doctoEls = pago.getElementsByTagNameNS(NS_PAGOS20, 'DoctoRelacionado');

        for (let j = 0; j < doctoEls.length; j++) {
            const dr = doctoEls[j];

            let baseDR = null;
            let importeDR = null;
            const trasladosDR = dr.getElementsByTagNameNS(NS_PAGOS20, 'TrasladoDR');
            for (let k = 0; k < trasladosDR.length; k++) {
                const t = trasladosDR[k];
                if (attr(t, 'ImpuestoDR') === '002' && attr(t, 'TasaOCuotaDR') === '0.160000') {
                    baseDR = parseFloat(attr(t, 'BaseDR')) || null;
                    importeDR = parseFloat(attr(t, 'ImporteDR')) || null;
                    break;
                }
            }

            rows.push({
                fechaPago,
                _fechaPagoRaw: fechaPagoRaw,
                formaPagoP,
                formaPagoPagoDesc: lookupFormaPago(formaPagoP),
                monedaP,
                montoPago,
                numOperacion,
                rfcEmisor,
                nombreEmisor,
                rfcReceptor,
                nombreReceptor,
                uuidDocRel: attr(dr, 'IdDocumento'),
                folioDocRel: attr(dr, 'Folio'),
                serieDocRel: attr(dr, 'Serie'),
                numParcialidad: parseInt(attr(dr, 'NumParcialidad')) || null,
                monedaDR: attr(dr, 'MonedaDR'),
                impSaldoAnt: parseFloat(attr(dr, 'ImpSaldoAnt')) || 0,
                impPagado: parseFloat(attr(dr, 'ImpPagado')) || 0,
                impSaldoInsoluto: parseFloat(attr(dr, 'ImpSaldoInsoluto')) || 0,
                baseDR,
                importeDR,
                uuid,
                serie,
                folio,
                fechaComprobante,
                _fechaComprobanteRaw: fechaComprobanteRaw,
                tipoComprobanteDesc: 'Pago',
                _filename: filename,
            });
        }
    }

    return { rows, uuid };
}

function formatFecha(isoDate) {
    if (!isoDate) return '';
    const [datePart] = isoDate.split('T');
    const [yyyy, mm, dd] = datePart.split('-');
    if (!yyyy || !mm || !dd) return isoDate;
    return `${dd}/${mm}/${yyyy}`;
}
