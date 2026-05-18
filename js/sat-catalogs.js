export const FORMA_PAGO = {
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

export const TIPO_COMPROBANTE = {
    'I': 'Ingreso',
    'E': 'Egreso',
    'T': 'Traslado',
    'N': 'Nómina',
    'P': 'Pago',
};

export const USO_CFDI = {
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

export const REGIMEN_FISCAL = {
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

// Helper to look up any code, returns code itself if not found
export function lookupFormaPago(code) {
    return FORMA_PAGO[code] || code || '';
}

export function lookupTipoComprobante(code) {
    return TIPO_COMPROBANTE[code] || code || '';
}

export function lookupUsoCFDI(code) {
    return USO_CFDI[code] || code || '';
}

export function lookupRegimenFiscal(code) {
    return REGIMEN_FISCAL[code] || code || '';
}

export const EXPORTACION = {
    '01': 'No aplica',
    '02': 'Definitiva',
    '03': 'Temporal',
    '04': 'Definitiva con clave A1',
};

export const OBJETO_IMP = {
    '01': 'No objeto de impuesto',
    '02': 'Sí objeto de impuesto.',
    '03': 'Sí objeto del impuesto y no obligado al desglose',
    '04': 'Sí objeto del impuesto y no causa impuesto',
};

export const METODO_PAGO = {
    'PUE': 'Pago en una sola exhibición',
    'PPD': 'Pago en parcialidades o diferido',
};

export function lookupExportacion(code) {
    return EXPORTACION[code] || code || '';
}

export function lookupObjetoImp(code) {
    return OBJETO_IMP[code] || code || '';
}

export function lookupMetodoPago(code) {
    return METODO_PAGO[code] || code || '';
}

export const MONEDA = {
    'MXN': 'Peso Mexicano',
    'USD': 'Dólar americano',
    'EUR': 'Euro',
    'GBP': 'Libra Esterlina',
    'JPY': 'Yen',
    'CAD': 'Dólar canadiense',
    'XXX': 'Los códigos asignados para las transacciones en que intervenga ninguna moneda',
};

export function lookupMoneda(code) {
    return MONEDA[code] || code || '';
}

// ============================================================
// Catálogos Nómina (complemento nomina12)
// ============================================================

export const TIPO_NOMINA = {
    'O': 'Nómina ordinaria',
    'E': 'Nómina extraordinaria',
};

export const PERIODICIDAD_PAGO = {
    '01': 'Diario',
    '02': 'Semanal',
    '03': 'Catorcenal',
    '04': 'Quincenal',
    '05': 'Mensual',
    '06': 'Bimestral',
    '07': 'Unidad obra',
    '08': 'Comisión',
    '09': 'Precio alzado',
    '10': 'Decenal',
    '99': 'Otra Periodicidad',
};

export const RIESGO_PUESTO = {
    '1': 'Clase I',
    '2': 'Clase II',
    '3': 'Clase III',
    '4': 'Clase IV',
    '5': 'Clase V',
};

export const TIPO_JORNADA = {
    '01': 'Diurna',
    '02': 'Nocturna',
    '03': 'Mixta',
    '04': 'Por hora',
    '05': 'Reducida',
    '06': 'Continuada',
    '07': 'Partida',
    '08': 'Por turnos',
    '99': 'Otra Jornada',
};

export const TIPO_CONTRATO = {
    '01': 'Contrato de trabajo por tiempo indeterminado',
    '02': 'Contrato de trabajo para obra determinada',
    '03': 'Contrato de trabajo por tiempo determinado',
    '04': 'Contrato de trabajo por temporada',
    '05': 'Contrato de trabajo sujeto a prueba',
    '06': 'Contrato de trabajo con capacitación inicial',
    '07': 'Modalidad de contratación por pago de hora laborada',
    '08': 'Modalidad de trabajo por comisión laboral',
    '09': 'Modalidades de contratación donde no existe relación de trabajo',
    '10': 'Jubilación, pensión, retiro',
    '99': 'Otro contrato',
};

export const TIPO_REGIMEN_CONTRATACION = {
    '02': 'Sueldos (Incluye ingresos señalados en la fracción I del artículo 94 de LISR)',
    '03': 'Jubilados',
    '04': 'Pensionados',
    '05': 'Asimilados Miembros Sociedades Cooperativas Producción',
    '06': 'Asimilados Integrantes Sociedades Asociaciones Civiles',
    '07': 'Asimilados Miembros consejos',
    '08': 'Asimilados comisionistas',
    '09': 'Asimilados Honorarios',
    '10': 'Asimilados acciones',
    '11': 'Asimilados otros',
    '12': 'Jubilados o Pensionados',
    '13': 'Indemnización o Separación',
    '99': 'Otro Régimen',
};

export const TIPO_PERCEPCION = {
    '001': 'Sueldos, Salarios Rayas y Jornales',
    '002': 'Gratificación Anual (Aguinaldo)',
    '003': 'Participación de los Trabajadores en las Utilidades PTU',
    '004': 'Reembolso de Gastos Médicos Dentales y Hospitalarios',
    '005': 'Fondo de Ahorro',
    '006': 'Caja de ahorro',
    '009': 'Contribuciones a Cargo del Trabajador Pagadas por el Patrón',
    '010': 'Premios por puntualidad',
    '011': 'Prima de Seguro de vida',
    '012': 'Seguro de Gastos Médicos Mayores',
    '013': 'Cuotas Sindicales Pagadas por el Patrón',
    '014': 'Subsidios por incapacidad',
    '015': 'Becas para trabajadores y/o hijos',
    '019': 'Horas extra',
    '020': 'Prima dominical',
    '021': 'Prima vacacional',
    '022': 'Prima por antigüedad',
    '023': 'Pagos por separación',
    '024': 'Seguro de retiro',
    '025': 'Indemnizaciones',
    '026': 'Reembolso por funeral',
    '027': 'Cuotas de seguridad social pagadas por el patrón',
    '028': 'Comisiones',
    '029': 'Vales de despensa',
    '030': 'Vales de restaurante',
    '031': 'Vales de gasolina',
    '032': 'Vales de ropa',
    '033': 'Ayuda para renta',
    '034': 'Ayuda para artículos escolares',
    '035': 'Ayuda para anteojos',
    '036': 'Ayuda para transporte',
    '037': 'Ayuda para gastos de funeral',
    '038': 'Otros ingresos por salarios',
    '039': 'Jubilaciones, pensiones o haberes de retiro',
    '044': 'Jubilaciones, pensiones o haberes de retiro en parcialidades',
    '045': 'Ingresos en acciones o títulos valor que representan bienes',
    '046': 'Ingresos asimilados a salarios',
    '047': 'Alimentación',
    '048': 'Habitación',
    '049': 'Premios por asistencia',
    '050': 'Viáticos',
    '051': 'Pagos por gratificaciones, primas, compensaciones, recompensas u otros',
};

export const TIPO_DEDUCCION = {
    '001': 'Seguridad social',
    '002': 'ISR',
    '003': 'Aportaciones a retiro, cesantía en edad avanzada y vejez.',
    '004': 'Otros',
    '005': 'Aportaciones a Fondo de vivienda',
    '006': 'Descuento por incapacidad',
    '007': 'Pensión alimenticia',
    '008': 'Renta',
    '009': 'Préstamos provenientes del Fondo Nacional de la Vivienda para los Trabajadores',
    '010': 'Pago por crédito de vivienda',
    '011': 'Pago de abonos INFONACOT',
    '012': 'Anticipo de salarios',
    '013': 'Pagos hechos con exceso al trabajador',
    '014': 'Errores',
    '015': 'Pérdidas',
    '016': 'Averías',
    '017': 'Adquisición de artículos producidos por la empresa o establecimiento',
    '018': 'Cuotas para la constitución y fomento de sociedades cooperativas y de cajas de ahorro',
    '019': 'Cuotas sindicales',
    '020': 'Ausencia (Ausentismo)',
    '021': 'Cuotas obrero patronales',
    '022': 'Impuestos Locales',
    '023': 'Aportaciones voluntarias',
    '024': 'Ajuste en Gratificación Anual (Aguinaldo) Exento',
    '025': 'Ajuste en Gratificación Anual (Aguinaldo) Gravado',
    '045': 'I.S.R.',
    '052': 'I.M.S.S.',
    '101': 'ISR Retenido de ejercicio anterior',
    '107': 'Ajuste al Subsidio Causado',
};

export const TIPO_OTRO_PAGO = {
    '001': 'Reintegro de ISR pagado en exceso (siempre que no haya sido enterado al SAT)',
    '002': 'Subsidio para el empleo (efectivamente entregado al trabajador)',
    '003': 'Viáticos (entregados al trabajador)',
    '004': 'Aplicación de saldo a favor por compensación anual',
    '005': 'Reintegro de ISR retenido en exceso de ejercicio anterior',
    '099': 'Pagos distintos a los listados y que no deben considerarse como ingreso por sueldos, salarios o ingresos asimilados.',
};

export function lookupTipoNomina(code) {
    return TIPO_NOMINA[code] || code || '';
}

export function lookupPeriodicidadPago(code) {
    return PERIODICIDAD_PAGO[code] || code || '';
}

export function lookupRiesgoPuesto(code) {
    return RIESGO_PUESTO[code] || code || '';
}

export function lookupTipoJornada(code) {
    return TIPO_JORNADA[code] || code || '';
}

export function lookupTipoContrato(code) {
    return TIPO_CONTRATO[code] || code || '';
}

export function lookupTipoRegimenContratacion(code) {
    return TIPO_REGIMEN_CONTRATACION[code] || code || '';
}

export function lookupTipoPercepcion(code) {
    return TIPO_PERCEPCION[code] || code || '';
}

export function lookupTipoDeduccion(code) {
    return TIPO_DEDUCCION[code] || code || '';
}

export function lookupTipoOtroPago(code) {
    return TIPO_OTRO_PAGO[code] || code || '';
}
