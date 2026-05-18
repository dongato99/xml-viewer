# XML Viewer CFDI

Visor web de comprobantes fiscales digitales (CFDI) en formato XML. Permite cargar, visualizar, filtrar y exportar facturas electrónicas mexicanas directamente desde el navegador, sin necesidad de servidor.

## Características

### Carga de archivos

- **Drag & Drop** — Arrastra uno o varios archivos `.xml` sobre la zona de carga
- **Selector de archivos** — Clic en "Seleccionar archivos" para elegir desde el explorador
- **Pegar XML** — Área de texto para pegar contenido XML directamente
- **Carga múltiple** — Soporta varios archivos a la vez
- **Detección de duplicados** — Evita cargar el mismo CFDI dos veces (por UUID)

### Compatibilidad CFDI

- CFDI versión **4.0** y **3.3**
- Tipos de comprobante: Ingreso, Egreso, Traslado, Nómina, Pago
- Extracción de Timbre Fiscal Digital (TFD) con UUID
- Manejo de namespaces con detección automática y fallback
- Errores descriptivos para XML malformado o versiones no soportadas
- **Soporte específico Nómina** — Para CFDI tipo "N" se extraen campos del complemento `nomina12` (v1.2): Registro Patronal, Periodicidad de Pago, Departamento, Núm. Empleado, NSS, Fecha de Pago, Total Percepciones, Total Otras Deducciones, Total Impuestos Retenidos

### Tabla de datos

- **47 columnas** — Fecha, serie, folio, RFC emisor, nombre emisor, moneda, tipo de cambio, base traslado, importe traslado, total, forma de pago, uso CFDI, régimen fiscal, clave producto/servicio, UUID, estatus, validez, tipo documento, versión, tipo comprobante, y más
- **Encabezados fijos** — Los headers permanecen visibles al hacer scroll vertical
- **Scroll horizontal** — Todas las columnas accesibles en cualquier pantalla
- **Filas alternadas** — Colores alternos para facilitar la lectura
- **Filas de egreso en rojo** — Los comprobantes de tipo Egreso se resaltan visualmente
- **Filas de nómina en verde** — Los comprobantes de tipo Nómina se resaltan visualmente

### Ordenamiento

- Clic en cualquier encabezado para ordenar ascendente/descendente
- Indicadores visuales (▲ / ▼) en la columna activa
- Ordenamiento inteligente: numérico para cantidades, cronológico para fechas, alfabético para texto

### Filtrado

- **Filtro por columna** — Campo de texto debajo de cada encabezado
- **Búsqueda de texto** — Coincidencia parcial, sin distinción de mayúsculas
- **Operadores numéricos** — `>`, `>=`, `<`, `<=`, `=` (ej. `>1000`, `<=5000.50`)
- **Filtrado en tiempo real** — Se aplica mientras escribes
- **Filtros combinados** — Múltiples columnas con lógica AND

### Gestión de columnas

- Botón **"Filtrar Columnas"** con menú desplegable de checkboxes
- Mostrar/ocultar columnas individualmente
- Todas las columnas visibles por defecto

### Selección de filas

- **Checkbox por fila** — Selección individual
- **Seleccionar todo** — Checkbox maestro en el encabezado (con estado indeterminado)
- **Contador de selección** — Muestra cuántas filas están seleccionadas

### Acciones masivas

- **Quitar Seleccionados** — Elimina las filas seleccionadas (con diálogo de confirmación)
- **Quitar Todo** — Limpia toda la tabla (con diálogo de confirmación)
- **Exportar Seleccionados** — Exporta solo las filas marcadas
- **Exportar Todo** — Exporta el dataset completo
- **Exportar Filtrado** — Exporta solo las filas visibles tras aplicar filtros

### Exportación a Excel

- Formato **XLSX** con dos hojas:
  - **Sheet0** — Detalle completo con todas las columnas
  - **Hoja1** — Resumen con 11 columnas clave (fecha, serie, folio, RFC, nombre, moneda, total, estatus, UUID, validez, tipo)
- Nombre de archivo automático basado en la fecha más reciente (ej. `Gastos Enero 2026.xlsx`)
- Preserva el estado de ordenamiento en los encabezados

### Temas

- **Modo claro** y **modo oscuro**
- Toggle con icono de luna/sol en el header
- Preferencia guardada en `localStorage`
- Transiciones suaves al cambiar de tema

### Transformación de datos

- Fechas ISO → formato `DD/MM/YYYY`
- Totales negativos para comprobantes de Egreso
- **Catálogos del SAT** integrados:
  - Forma de pago (01–31, 99)
  - Tipo de comprobante (I/E/T/N/P)
  - Régimen fiscal (601–626)
  - Uso de CFDI (50+ claves)

### Barra de estado

- Contador de filas cargadas
- Contador de filas visibles al filtrar
- Barra fija en la parte inferior

### Avisos y confirmaciones

- Mensajes de advertencia con auto-cierre (8 segundos)
- Diálogo modal de confirmación para acciones destructivas

### Responsive

- Layout de dos columnas en escritorio (zona de carga + área de pegado)
- Una columna en pantallas pequeñas (< 768px)

## Uso

Abrir `index.html` directamente en el navegador — no requiere servidor web.

## Tecnologías

- HTML, CSS, JavaScript vanilla
- [SheetJS (xlsx)](https://sheetjs.com/) para exportación a Excel
