# Plan de implementación: interfaz completa de FV+

## Objetivo

Reconstruir y unificar la interfaz de todo FV+ para que sea clara, profesional, adaptable y coherente desde el acceso hasta las consultas, los pagos, la administración y las páginas auxiliares. El trabajo debe conservar el comportamiento existente de autenticación, consultas, créditos, pagos, documentos, enlaces externos y permisos.

## Dirección visual acordada

- **Tipografía:** Inter, con una pila de respaldo sans-serif legible si no carga la fuente.
- **Tres tamaños para la interfaz:** 12 px para metadatos y ayudas; 16 px para lectura, controles y contenido; 22 px para títulos y cifras principales. La escala debe vivir en tokens y no multiplicarse con tamaños ad hoc.
- **Colores:** blanco, grises neutros y carbón/gris oscuro para estructura, texto y acciones principales. Verde real de WhatsApp solamente en sus acciones y su acceso flotante.
- **Componentes:** tarjetas y botones sencillos, alineados, con bordes discretos cuando aporten estructura y sin sombras decorativas. Estados de foco, carga, selección, error y deshabilitado deben seguir siendo visibles.
- **Iconos:** sistema SVG consistente, de trazo y peso visual uniforme; sin emojis ni iconos genéricos mezclados. Conservar imágenes de servicios SUNARP como PNG originales, sin convertirlas a SVG.
- **Nombre del servicio:** mostrar “Tarjeta de Propiedad (TIVE)” en todas las etiquetas visibles correspondientes.
- **Móvil:** navegación inferior con cuatro destinos principales: Consultar, Resumen, Vehículos y Pagos. Cuenta queda accesible desde el avatar/encabezado. Los controles deben conservar objetivos táctiles cómodos y no quedar detrás de la navegación fija.

## Alcance

1. Acceso, inicio de sesión, registro, recuperación y validación de cuenta.
2. Aplicación autenticada: catálogo/consulta, resumen, historial, vehículos, pagos, cuenta, regiones, servicios gratuitos, resultados, diálogos y soporte.
3. Administración: panel, usuarios, pagos/ingresos, actividad, publicidad, sistema y vistas emergentes.
4. Páginas auxiliares: emisión CITV, verificación, pago exitoso y pago pendiente.
5. Diseño adaptable, accesibilidad visual básica y revisión de todos los flujos visibles.

## Límites que se deben preservar

- No cambiar contratos de API, consultas a proveedores, autenticación, reglas de créditos, permisos ni lógica de pagos salvo que una corrección visual requiera reparar un control roto.
- Mantener intacto el contenido y la composición de certificados, reportes y otros documentos generados/impresos. La escala de tres tamaños rige la interfaz del producto; las medidas tipográficas propias de documentos oficiales se revisan de forma aislada.
- Mantener los destinos externos entregados para los servicios SUNARP y presentar sus imágenes PNG con su texto debajo.
- No publicar ni desplegar como parte de esta implementación sin una solicitud separada.

## Fases de implementación

### Fase 1: inventario y línea base

1. Recorrer `app.html`, `admin.html`, `citv-emisor.html`, `verificar.html`, `pago-exitoso.html`, `pago-pendiente.html` e `index.html`; registrar cada vista, estado, modal, formulario y acción visible.
2. Trazar cada acción a sus controladores en `js/nueva/`, `js/modules/`, `js/admin/` y `js/shared/`; marcar cuáles cambian de ruta, abren una capa, consultan datos o inician un pago.
3. Registrar los estilos que actualmente compiten entre `css/base.css`, `css/estructura.css`, `css/components.css`, `css/botones.css`, `css/nueva.css`, `css/sistema-visual.css`, `css/interfaz-tipografia.css`, `css/puerta-entrada.css` y `css/admin.css`.
4. Levantar capturas de referencia de las vistas existentes en móvil y escritorio para detectar regresiones durante la reconstrucción.

**Salida:** mapa de pantallas y flujos, inventario de componentes reutilizables y línea base visual.

### Fase 2: sistema visual compartido

1. Consolidar en `css/interfaz-tipografia.css` los tokens únicos de tipografía, color, espaciado, radio, borde, foco y movimiento; hacer que las demás hojas los consuman sin redefinir la paleta.
2. Normalizar Inter y limitar los textos de interfaz a los tokens de 12, 16 y 22 px; eliminar diferencias de tamaño arbitrarias gradualmente en hojas compartidas y estilos en línea de controles visibles.
3. Unificar botones, campos, tarjetas, pestañas, etiquetas, tablas, estados vacíos, avisos y diálogos desde `css/base.css`, `css/components.css`, `css/botones.css` y `css/overlays.css`.
4. Reemplazar o normalizar iconos visibles con el conjunto SVG existente en `app.html` y los módulos; estandarizar dimensiones, grosor, alineación y nombres accesibles.
5. Retirar sombras de la interfaz y documentar sus únicos colores de acento permitidos; aislar el verde de WhatsApp para que no se propague a controles generales.
6. Consolidar reglas responsivas duplicadas, en especial las sobreescrituras tardías de `css/nueva.css`; evitar que `css/interfaz-tipografia.css` y `css/sistema-visual.css` definan valores incompatibles.

**Criterio de salida:** los componentes compartidos usan los mismos tokens y los estados de interacción siguen siendo perceptibles sin depender de sombras o color únicamente.

### Fase 3: acceso y entrada al producto

1. Reconstruir el panel de acceso de `app.html` y `css/puerta-entrada.css` para escritorio, tablet y teléfono: jerarquía clara, formulario compacto, campos legibles y botones con una acción principal inequívoca.
2. Revisar las vistas de iniciar sesión, registro, recuperación, verificación/Turnstile y estado de sesión en `js/nueva/acceso.js` y `js/nueva/nucleo.js`.
3. Conservar los textos y acciones aprobados para autenticación, el inicio con Google y los enlaces legales; verificar que los estados de error, carga y éxito no deformen el formulario.
4. Revisar el acceso a WhatsApp en la entrada sin alterar su destino o lógica.

**Criterio de salida:** cada estado de acceso es usable con teclado y táctil, no produce desbordamiento en 320 px y mantiene sus integraciones actuales.

### Fase 4: aplicación principal y navegación

1. Reorganizar el marco de `app.html` con encabezado, navegación de escritorio, área de contenido y controles de cuenta; reducir ruido visual y dejar explícita la ubicación actual.
2. Implementar la navegación inferior móvil de cuatro elementos (Consultar, Resumen, Vehículos, Pagos) y acceso a Cuenta desde el avatar; contemplar área segura del dispositivo y reservar espacio bajo el contenido.
3. Revisar rutas/estado activo en `js/nueva/nucleo.js` y presentación de vistas en `js/nueva/pantallas.js`.
4. Ajustar distribución, encabezados, filtros, listas, indicadores y estados vacíos para cada ancho sin ocultar contenido o controles necesarios.

**Criterio de salida:** todas las rutas principales son alcanzables y la navegación indica correctamente la vista activa en escritorio y móvil.

### Fase 5: consultas, servicios y resultados

1. Ordenar el catálogo de `Consultar`: búsqueda, categoría, cantidad de resultados y lista de consultas, con tarjetas compactas y botones cuya etiqueta describa la acción/costo.
2. Presentar las cinco tarjetas de servicios SUNARP encima de “Consultas vehiculares gratuitas”, con cada PNG original, texto debajo y su enlace correspondiente; adaptar columnas a una o varias tarjetas por fila según el ancho.
3. Ordenar regiones e infracciones desde `js/nueva/servicios.js`; utilizar el recurso PNG del pin de mapa ya incorporado donde corresponda.
4. Revisar los flujos y estados de consulta en `js/modules/consulta-runner.js`, `js/modules/category-view.js`, `js/modules/filter.js` y `js/modules/render-helpers.js`.
5. Aplicar el nombre “Tarjeta de Propiedad (TIVE)” en catálogo, resultados y etiquetas visibles, preservando identificadores y valores internos requeridos por el sistema.
6. Normalizar resultados, avisos, confirmaciones, carga, error, falta de créditos y reintento. Mantener descargas completas y el diseño propio de documentos/PDF.

**Criterio de salida:** el catálogo se puede buscar, filtrar y recorrer; las cinco tarjetas muestran texto debajo de la imagen; un usuario puede iniciar una consulta y entender su estado y resultado.

### Fase 6: resumen, historial, vehículos, pagos y cuenta

1. En `js/nueva/pantallas.js`, reconstruir Resumen e Historial con datos destacados, fechas, estado vacío y acceso a detalle sin tarjetas redundantes.
2. Ordenar Vehículos con identificación, filtros/acciones existentes y presentación móvil legible; aplicar la etiqueta TIVE acordada en el contenido que corresponda.
3. Simplificar Pagos y créditos: saldo, paquetes/opciones, botón de compra y estados de pago; mantener intacta la configuración de proveedor y las rutas de retorno.
4. Reordenar Cuenta para perfil, plan, preferencias, seguridad y salida, según las funciones que ya expone el producto.
5. Revisar diálogos de compra, confirmación, créditos insuficientes y resultado de pago; mantener los campos editables con contraste y fondo adecuados.

**Criterio de salida:** cada una de estas cuatro áreas muestra su acción principal y conserva las transiciones y operaciones actuales.

### Fase 7: administración y páginas auxiliares

1. Reconstruir la estructura de `admin.html` y `css/admin.css`; ordenar las secciones Usuarios, Pagos, Actividad, Publicidad y Sistema, incluidos formularios, métricas, tablas y modales de `js/admin/`.
2. En móvil, permitir recorrer tablas y pestañas sin provocar desbordamiento de toda la página; mantener visibles las acciones administrativas importantes y sus confirmaciones.
3. Aplicar el sistema visual a `verificar.html`, `pago-exitoso.html` y `pago-pendiente.html`, respetando sus mensajes, estados y enlaces de continuación.
4. Revisar la pantalla de emisión de `citv-emisor.html`; separar sus controles de aplicación del certificado generado y de sus estilos de impresión.
5. Revisar `index.html` únicamente como punto de entrada y conservar su redirección vigente.

**Criterio de salida:** cada página auxiliar y cada sección administrativa tiene jerarquía consistente y funciona en pantallas estrechas sin perder acciones o datos.

### Fase 8: acabado, accesibilidad y aceptación

1. Comprobar visualmente 320, 390, 768, 1024, 1366 y 1920 px: alineación, lectura, cortes, scroll horizontal intencional, botones, diálogos, navegación fija y uso de imágenes.
2. Recorrer todos los flujos interactivos registrados en la fase 1: autenticación, navegación, búsqueda, consulta, resultados, descarga, compra y retornos, soporte, administración y verificación.
3. Revisar navegación por teclado, foco visible, etiquetas accesibles, contraste, área táctil y comportamiento con movimiento reducido.
4. Comparar contra la línea base y resolver regresiones antes de cerrar la implementación; registrar por separado cualquier límite que dependa de servicios externos.
5. Verificar que la previsualización local sirva los archivos actualizados. La publicación queda fuera de este plan.

**Criterio de aceptación global:** todas las pantallas incluidas comparten Inter y la escala 12/16/22 px para la interfaz; la paleta es neutral con verde exclusivo para WhatsApp; no hay sombras decorativas; la navegación y los controles se adaptan a móvil y escritorio; y los flujos existentes siguen funcionando.

## Orden y dependencias

Fase 1 establece el mapa y las referencias. La fase 2 define las bases compartidas antes de rediseñar las pantallas. Las fases 3 a 7 pueden avanzar por área una vez que los tokens y componentes comunes estén listos. La fase 8 recorre el sistema completo y cierra los defectos encontrados.

## Fuera del alcance

- Publicar o desplegar cambios.
- Cambiar lógica de negocio, contratos de servicios o composición de documentos oficiales.
