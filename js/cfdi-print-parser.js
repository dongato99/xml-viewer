import { lookupFormaPago, lookupTipoComprobante, lookupRegimenFiscal, lookupUsoCFDI, lookupExportacion, lookupObjetoImp, lookupMetodoPago } from './sat-catalogs.js';

const NS_CFDI_40 = 'http://www.sat.gob.mx/cfd/4';
const NS_CFDI_33 = 'http://www.sat.gob.mx/cfd/3';
const NS_TFD = 'http://www.sat.gob.mx/TimbreFiscalDigital';

/**
 * Parse a CFDI XML string into a full object for PDF rendering.
 * Returns null on parse errors or if no Comprobante element is found.
 */
export function parseCFDIForPrint(xmlString) {
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
