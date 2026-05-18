import { parseCFDIForPrint } from './cfdi-print-parser.js';
import {
    lookupTipoNomina,
    lookupPeriodicidadPago,
    lookupRiesgoPuesto,
    lookupTipoJornada,
    lookupTipoContrato,
    lookupTipoRegimenContratacion,
    lookupTipoPercepcion,
    lookupTipoDeduccion,
    lookupTipoOtroPago,
} from './sat-catalogs.js';

const NS_NOMINA12 = 'http://www.sat.gob.mx/nomina12';

/**
 * Parse a CFDI Nómina XML for PDF rendering.
 * Composes parseCFDIForPrint for the Comprobante header and adds the
 * nomina12 complement (emisor, receptor, percepciones, deducciones,
 * otros pagos). Returns null if the base parser fails or if there is
 * no nomina12:Nomina element.
 */
export function parseNominaCFDIForPrint(xmlString) {
    const base = parseCFDIForPrint(xmlString);
    if (!base) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    if (doc.querySelector('parsererror')) return null;

    const nomina = doc.getElementsByTagNameNS(NS_NOMINA12, 'Nomina')[0];
    if (!nomina) return null;

    const attr = (el, name) => el?.getAttribute(name) || '';
    const num = (s) => {
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    };

    const nomEmisorEl = doc.getElementsByTagNameNS(NS_NOMINA12, 'Emisor')[0];
    const nomReceptorEl = doc.getElementsByTagNameNS(NS_NOMINA12, 'Receptor')[0];
    const percepcionesEl = doc.getElementsByTagNameNS(NS_NOMINA12, 'Percepciones')[0];
    const deduccionesEl = doc.getElementsByTagNameNS(NS_NOMINA12, 'Deducciones')[0];
    const otrosPagosEl = doc.getElementsByTagNameNS(NS_NOMINA12, 'OtrosPagos')[0];

    // --- Nómina top-level ---
    const tipoNomina = attr(nomina, 'TipoNomina');
    const fechaPago = attr(nomina, 'FechaPago');
    const fechaInicialPago = attr(nomina, 'FechaInicialPago');
    const fechaFinalPago = attr(nomina, 'FechaFinalPago');
    const numDiasPagados = attr(nomina, 'NumDiasPagados');
    const totalPercepciones = attr(nomina, 'TotalPercepciones');
    const totalDeducciones = attr(nomina, 'TotalDeducciones');
    const totalOtrosPagos = attr(nomina, 'TotalOtrosPagos');

    // --- Emisor (nomina) ---
    const nomEmisor = {
        registroPatronal: attr(nomEmisorEl, 'RegistroPatronal'),
        rfcPatronOrigen: attr(nomEmisorEl, 'RfcPatronOrigen'),
    };

    // --- Receptor (nomina) ---
    const riesgoPuesto = attr(nomReceptorEl, 'RiesgoPuesto');
    const tipoJornada = attr(nomReceptorEl, 'TipoJornada');
    const tipoContrato = attr(nomReceptorEl, 'TipoContrato');
    const tipoRegimen = attr(nomReceptorEl, 'TipoRegimen');
    const periodicidadPago = attr(nomReceptorEl, 'PeriodicidadPago');
    const nomReceptor = {
        curp: attr(nomReceptorEl, 'Curp'),
        numSeguridadSocial: attr(nomReceptorEl, 'NumSeguridadSocial'),
        fechaInicioRelLaboral: attr(nomReceptorEl, 'FechaInicioRelLaboral'),
        antiguedad: attr(nomReceptorEl, 'Antigüedad'),
        tipoContrato,
        tipoContratoDesc: lookupTipoContrato(tipoContrato),
        sindicalizado: attr(nomReceptorEl, 'Sindicalizado'),
        tipoJornada,
        tipoJornadaDesc: lookupTipoJornada(tipoJornada),
        tipoRegimen,
        tipoRegimenDesc: lookupTipoRegimenContratacion(tipoRegimen),
        numEmpleado: attr(nomReceptorEl, 'NumEmpleado'),
        departamento: attr(nomReceptorEl, 'Departamento'),
        puesto: attr(nomReceptorEl, 'Puesto'),
        riesgoPuesto,
        riesgoPuestoDesc: lookupRiesgoPuesto(riesgoPuesto),
        periodicidadPago,
        periodicidadPagoDesc: lookupPeriodicidadPago(periodicidadPago),
        banco: attr(nomReceptorEl, 'Banco'),
        cuentaBancaria: attr(nomReceptorEl, 'CuentaBancaria'),
        salarioBaseCotApor: attr(nomReceptorEl, 'SalarioBaseCotApor'),
        salarioDiarioIntegrado: attr(nomReceptorEl, 'SalarioDiarioIntegrado'),
        claveEntFed: attr(nomReceptorEl, 'ClaveEntFed'),
    };

    // --- Percepciones ---
    const percItems = [];
    if (percepcionesEl) {
        const percList = percepcionesEl.getElementsByTagNameNS(NS_NOMINA12, 'Percepcion');
        for (let i = 0; i < percList.length; i++) {
            const p = percList[i];
            const tipo = attr(p, 'TipoPercepcion');
            percItems.push({
                tipoPercepcion: tipo,
                tipoPercepcionDesc: lookupTipoPercepcion(tipo),
                clave: attr(p, 'Clave'),
                concepto: attr(p, 'Concepto'),
                importeGravado: attr(p, 'ImporteGravado'),
                importeExento: attr(p, 'ImporteExento'),
            });
        }
    }
    const percepciones = {
        totalSueldos: percepcionesEl ? attr(percepcionesEl, 'TotalSueldos') : '',
        totalSeparacionIndemnizacion: percepcionesEl ? attr(percepcionesEl, 'TotalSeparacionIndemnizacion') : '',
        totalJubilacionPensionRetiro: percepcionesEl ? attr(percepcionesEl, 'TotalJubilacionPensionRetiro') : '',
        totalGravado: percepcionesEl ? attr(percepcionesEl, 'TotalGravado') : '',
        totalExento: percepcionesEl ? attr(percepcionesEl, 'TotalExento') : '',
        items: percItems,
    };

    // --- Deducciones ---
    const dedItems = [];
    if (deduccionesEl) {
        const dedList = deduccionesEl.getElementsByTagNameNS(NS_NOMINA12, 'Deduccion');
        for (let i = 0; i < dedList.length; i++) {
            const d = dedList[i];
            const tipo = attr(d, 'TipoDeduccion');
            dedItems.push({
                tipoDeduccion: tipo,
                tipoDeduccionDesc: lookupTipoDeduccion(tipo),
                clave: attr(d, 'Clave'),
                concepto: attr(d, 'Concepto'),
                importe: attr(d, 'Importe'),
            });
        }
    }
    const deducciones = {
        totalOtrasDeducciones: deduccionesEl ? attr(deduccionesEl, 'TotalOtrasDeducciones') : '',
        totalImpuestosRetenidos: deduccionesEl ? attr(deduccionesEl, 'TotalImpuestosRetenidos') : '',
        items: dedItems,
    };

    // --- Otros Pagos ---
    const otrosPagos = [];
    if (otrosPagosEl) {
        const opList = otrosPagosEl.getElementsByTagNameNS(NS_NOMINA12, 'OtroPago');
        for (let i = 0; i < opList.length; i++) {
            const op = opList[i];
            const tipo = attr(op, 'TipoOtroPago');
            const subEl = op.getElementsByTagNameNS(NS_NOMINA12, 'SubsidioAlEmpleo')[0];
            otrosPagos.push({
                tipoOtroPago: tipo,
                tipoOtroPagoDesc: lookupTipoOtroPago(tipo),
                clave: attr(op, 'Clave'),
                concepto: attr(op, 'Concepto'),
                importe: attr(op, 'Importe'),
                subsidio: subEl ? { subsidioCausado: attr(subEl, 'SubsidioCausado') } : null,
            });
        }
    }

    // --- Calculated importe neto ---
    const importeNeto = num(totalPercepciones) + num(totalOtrosPagos) - num(totalDeducciones);

    return {
        ...base,
        nomina: {
            tipoNomina,
            tipoNominaDesc: lookupTipoNomina(tipoNomina),
            fechaPago,
            fechaInicialPago,
            fechaFinalPago,
            numDiasPagados,
            totalPercepciones,
            totalDeducciones,
            totalOtrosPagos,
            nomEmisor,
            nomReceptor,
            percepciones,
            deducciones,
            otrosPagos,
            importeNeto,
        },
    };
}
