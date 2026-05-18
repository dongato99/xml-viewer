import { parseCFDI } from './cfdi-parser.js';

const NS_NOMINA12 = 'http://www.sat.gob.mx/nomina12';

/**
 * Parse a CFDI Nómina XML into a flat row object.
 * Composes with parseCFDI for header fields, then adds nomina12-specific fields.
 * Returns the row, or null on parse error, or { error, version, filename } from parseCFDI for unsupported CFDI versions.
 */
export function parseNominaCFDI(xmlString, filename) {
    const base = parseCFDI(xmlString, filename);
    if (!base || base.error) return base;

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    if (doc.querySelector('parsererror')) return null;

    const attr = (el, name) => el?.getAttribute(name) || '';

    const nomina = doc.getElementsByTagNameNS(NS_NOMINA12, 'Nomina')[0];
    if (!nomina) {
        // CFDI with TipoDeComprobante='N' but no nomina12 complement.
        // Return base row with empty nómina fields rather than an error.
        return base;
    }

    const nomEmisor = doc.getElementsByTagNameNS(NS_NOMINA12, 'Emisor')[0];
    const nomReceptor = doc.getElementsByTagNameNS(NS_NOMINA12, 'Receptor')[0];
    const deducciones = doc.getElementsByTagNameNS(NS_NOMINA12, 'Deducciones')[0];

    const fechaPagoRaw = attr(nomina, 'FechaPago');
    const fechaPago = formatFecha(fechaPagoRaw);

    const parseNum = (s) => {
        const n = parseFloat(s);
        return isNaN(n) ? null : n;
    };

    return {
        ...base,
        registroPatronal: attr(nomEmisor, 'RegistroPatronal'),
        periodicidadPago: attr(nomReceptor, 'PeriodicidadPago'),
        departamento: attr(nomReceptor, 'Departamento'),
        numEmpleado: attr(nomReceptor, 'NumEmpleado'),
        numSeguridadSocial: attr(nomReceptor, 'NumSeguridadSocial'),
        fechaPago,
        _fechaPagoRaw: fechaPagoRaw,
        totalPercepciones: parseNum(attr(nomina, 'TotalPercepciones')),
        totalOtrasDeducciones: parseNum(attr(deducciones, 'TotalOtrasDeducciones')),
        totalImpuestosRetenidos: parseNum(attr(deducciones, 'TotalImpuestosRetenidos')),
    };
}

function formatFecha(isoDate) {
    if (!isoDate) return '';
    const [datePart] = isoDate.split('T');
    const [yyyy, mm, dd] = datePart.split('-');
    if (!yyyy || !mm || !dd) return isoDate;
    return `${dd}/${mm}/${yyyy}`;
}
