import { lookupFormaPago, lookupTipoComprobante, lookupRegimenFiscal, lookupUsoCFDI, lookupExportacion, lookupObjetoImp, lookupMoneda } from './sat-catalogs.js';

const NS_CFDI_40 = 'http://www.sat.gob.mx/cfd/4';
const NS_CFDI_33 = 'http://www.sat.gob.mx/cfd/3';
const NS_TFD = 'http://www.sat.gob.mx/TimbreFiscalDigital';
const NS_PAGOS20 = 'http://www.sat.gob.mx/Pagos20';

export function parsePagoCFDIForPrint(xmlString) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');

        if (doc.querySelector('parsererror')) return null;

        let ns = NS_CFDI_40;
        let comprobante = doc.getElementsByTagNameNS(ns, 'Comprobante')[0];
        let is40 = true;
        if (!comprobante) {
            ns = NS_CFDI_33;
            comprobante = doc.getElementsByTagNameNS(ns, 'Comprobante')[0];
            is40 = false;
        }
        if (!comprobante) return null;

        const attr = (el, name) => el?.getAttribute(name) || '';

        const tipoDeComprobante = attr(comprobante, 'TipoDeComprobante');

        const result = {
            version: attr(comprobante, 'Version'),
            serie: attr(comprobante, 'Serie'),
            folio: attr(comprobante, 'Folio'),
            fecha: attr(comprobante, 'Fecha'),
            sello: attr(comprobante, 'Sello'),
            noCertificado: attr(comprobante, 'NoCertificado'),
            subTotal: attr(comprobante, 'SubTotal'),
            moneda: attr(comprobante, 'Moneda'),
            monedaDesc: lookupMoneda(attr(comprobante, 'Moneda')),
            total: attr(comprobante, 'Total'),
            tipoDeComprobante,
            tipoDeComprobanteDesc: lookupTipoComprobante(tipoDeComprobante),
            lugarExpedicion: attr(comprobante, 'LugarExpedicion'),
            exportacion: attr(comprobante, 'Exportacion'),
            exportacionDesc: lookupExportacion(attr(comprobante, 'Exportacion')),
        };

        const emisorEl = doc.getElementsByTagNameNS(ns, 'Emisor')[0];
        result.emisor = {
            rfc: attr(emisorEl, 'Rfc'),
            nombre: attr(emisorEl, 'Nombre'),
            regimenFiscal: attr(emisorEl, 'RegimenFiscal'),
            regimenFiscalDesc: lookupRegimenFiscal(attr(emisorEl, 'RegimenFiscal')),
        };

        const receptorEl = doc.getElementsByTagNameNS(ns, 'Receptor')[0];
        const usoCFDI = attr(receptorEl, 'UsoCFDI');
        const regimenFiscalReceptor = is40 ? attr(receptorEl, 'RegimenFiscalReceptor') : '';
        result.receptor = {
            rfc: attr(receptorEl, 'Rfc'),
            nombre: attr(receptorEl, 'Nombre'),
            usoCFDI,
            usoCFDIDesc: lookupUsoCFDI(usoCFDI),
            regimenFiscalReceptor,
            regimenFiscalReceptorDesc: regimenFiscalReceptor ? lookupRegimenFiscal(regimenFiscalReceptor) : '',
            domicilioFiscalReceptor: is40 ? attr(receptorEl, 'DomicilioFiscalReceptor') : '',
        };

        const conceptoEls = doc.getElementsByTagNameNS(ns, 'Concepto');
        result.conceptos = [];
        for (let i = 0; i < conceptoEls.length; i++) {
            const c = conceptoEls[i];
            const objetoImp = attr(c, 'ObjetoImp');
            result.conceptos.push({
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
            });
        }

        const pagosEl = doc.getElementsByTagNameNS(NS_PAGOS20, 'Pagos')[0];
        if (!pagosEl) return null;

        const totalesEl = doc.getElementsByTagNameNS(NS_PAGOS20, 'Totales')[0];
        result.pagosTotales = {
            montoTotalPagos: attr(totalesEl, 'MontoTotalPagos'),
            totalTrasladosBaseIVA16: attr(totalesEl, 'TotalTrasladosBaseIVA16'),
            totalTrasladosImpuestoIVA16: attr(totalesEl, 'TotalTrasladosImpuestoIVA16'),
            totalRetencionesISR: attr(totalesEl, 'TotalRetencionesISR'),
            totalRetencionesIVA: attr(totalesEl, 'TotalRetencionesIVA'),
            totalRetencionesIEPS: attr(totalesEl, 'TotalRetencionesIEPS'),
        };

        const pagoEls = doc.getElementsByTagNameNS(NS_PAGOS20, 'Pago');
        result.pagos = [];

        for (let i = 0; i < pagoEls.length; i++) {
            const pagoEl = pagoEls[i];
            const formaPagoP = attr(pagoEl, 'FormaDePagoP');
            const monedaP = attr(pagoEl, 'MonedaP');

            const pago = {
                fechaPago: attr(pagoEl, 'FechaPago'),
                formaPagoP,
                formaPagoDesc: lookupFormaPago(formaPagoP),
                monedaP,
                monedaDesc: lookupMoneda(monedaP),
                tipoCambioP: attr(pagoEl, 'TipoCambioP'),
                monto: attr(pagoEl, 'Monto'),
                numOperacion: attr(pagoEl, 'NumOperacion'),
                trasladosP: [],
                retencionesP: [],
                doctosRelacionados: [],
            };

            const trasladosPEls = pagoEl.getElementsByTagNameNS(NS_PAGOS20, 'TrasladoP');
            for (let j = 0; j < trasladosPEls.length; j++) {
                const t = trasladosPEls[j];
                pago.trasladosP.push({
                    baseP: attr(t, 'BaseP'),
                    impuestoP: attr(t, 'ImpuestoP'),
                    tipoFactorP: attr(t, 'TipoFactorP'),
                    tasaOCuotaP: attr(t, 'TasaOCuotaP'),
                    importeP: attr(t, 'ImporteP'),
                });
            }

            const retencionesPEls = pagoEl.getElementsByTagNameNS(NS_PAGOS20, 'RetencionP');
            for (let j = 0; j < retencionesPEls.length; j++) {
                const r = retencionesPEls[j];
                pago.retencionesP.push({
                    impuestoP: attr(r, 'ImpuestoP'),
                    importeP: attr(r, 'ImporteP'),
                });
            }

            const doctoEls = pagoEl.getElementsByTagNameNS(NS_PAGOS20, 'DoctoRelacionado');
            for (let j = 0; j < doctoEls.length; j++) {
                const dr = doctoEls[j];
                const objetoImpDR = attr(dr, 'ObjetoImpDR');
                const monedaDR = attr(dr, 'MonedaDR');

                const docto = {
                    idDocumento: attr(dr, 'IdDocumento'),
                    serie: attr(dr, 'Serie'),
                    folio: attr(dr, 'Folio'),
                    monedaDR,
                    monedaDRDesc: lookupMoneda(monedaDR),
                    equivalenciaDR: attr(dr, 'EquivalenciaDR'),
                    numParcialidad: attr(dr, 'NumParcialidad'),
                    impSaldoAnt: attr(dr, 'ImpSaldoAnt'),
                    impPagado: attr(dr, 'ImpPagado'),
                    impSaldoInsoluto: attr(dr, 'ImpSaldoInsoluto'),
                    objetoImpDR,
                    objetoImpDRDesc: lookupObjetoImp(objetoImpDR),
                    trasladosDR: [],
                    retencionesDR: [],
                };

                const trasladoDREls = dr.getElementsByTagNameNS(NS_PAGOS20, 'TrasladoDR');
                for (let k = 0; k < trasladoDREls.length; k++) {
                    const t = trasladoDREls[k];
                    docto.trasladosDR.push({
                        baseDR: attr(t, 'BaseDR'),
                        impuestoDR: attr(t, 'ImpuestoDR'),
                        tipoFactorDR: attr(t, 'TipoFactorDR'),
                        tasaOCuotaDR: attr(t, 'TasaOCuotaDR'),
                        importeDR: attr(t, 'ImporteDR'),
                    });
                }

                const retencionDREls = dr.getElementsByTagNameNS(NS_PAGOS20, 'RetencionDR');
                for (let k = 0; k < retencionDREls.length; k++) {
                    const r = retencionDREls[k];
                    docto.retencionesDR.push({
                        baseDR: attr(r, 'BaseDR'),
                        impuestoDR: attr(r, 'ImpuestoDR'),
                        tipoFactorDR: attr(r, 'TipoFactorDR'),
                        tasaOCuotaDR: attr(r, 'TasaOCuotaDR'),
                        importeDR: attr(r, 'ImporteDR'),
                    });
                }

                pago.doctosRelacionados.push(docto);
            }

            result.pagos.push(pago);
        }

        const tfdEl = doc.getElementsByTagNameNS(NS_TFD, 'TimbreFiscalDigital')[0];
        result.tfd = {
            version: attr(tfdEl, 'Version'),
            uuid: attr(tfdEl, 'UUID'),
            fechaTimbrado: attr(tfdEl, 'FechaTimbrado'),
            rfcProvCertif: attr(tfdEl, 'RfcProvCertif'),
            selloCFD: attr(tfdEl, 'SelloCFD'),
            noCertificadoSAT: attr(tfdEl, 'NoCertificadoSAT'),
            selloSAT: attr(tfdEl, 'SelloSAT'),
        };

        result.cadenaOriginal = `||${result.tfd.version}|${result.tfd.uuid}|${result.tfd.fechaTimbrado}|${result.tfd.rfcProvCertif}|${result.tfd.selloCFD}|${result.tfd.noCertificadoSAT}||`;

        return result;
    } catch (e) {
        return null;
    }
}
