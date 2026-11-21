# Revisión de la plataforma FV+ — 20 de noviembre de 2026

Estado actual: [reconstrucción integral del interior](revision-interior-2026-11-20.md). Sustituye la distribución y la paleta salvia de este registro anterior.

Trabajo realizado exclusivamente en local, con el login y el registro aprobados como referencia visual. Sin commit, subida ni despliegue.

## Diagnóstico y cambios

| Área | Problema encontrado | Corrección |
| --- | --- | --- |
| Navegación | Formas y estados activos distintos al acceso | Botones redondeados, selección verde salvia con texto oscuro, cabecera blanca y fondo gris neutro |
| Catálogo | Destacados y tarjetas con criterios visuales distintos y tipo de dato oculto | Reporte en verde salvia diferenciado del blanco mediante bordes suaves, tarjetas uniformes con precio y tipo de dato visibles, categorías en cápsula |
| Servicios SUNARP | Textos largos y franjas negras que competían con los logotipos | Nombres breves, tarjetas blancas y logotipos originales conservados |
| Resumen e historial | Cifras desproporcionadas y gráficos sin una jerarquía clara | Cuatro tarjetas iguales, saldo en verde salvia, accesos rápidos compactos, actividad y categorías alineadas; en celular, cifras en dos columnas y gráficos apilados |
| Mis vehículos | Formulario y acciones con proporciones diferentes | Placa de ancho acotado, campos alineados y acciones que se apilan en pantallas pequeñas |
| Pagos | Paquetes demasiado anchos y escasa jerarquía entre opciones | Cuatro columnas en escritorio amplio, dos en pantallas intermedias y una en celular; mejor precio destacado; compra en amarillo |
| Recarga personalizada | Necesitaba conservar un campo claro y una acción diferenciada | Campo gris suave, total visible, validación existente del mínimo y múltiplos conservada |
| Cuenta | Información y acciones sin distribución clara; teléfono sin validar | Dos columnas en escritorio y una en celular; teléfono normalizado con la misma regla del registro; bloqueo de envíos duplicados |
| Resultados y avisos | Cabecera oscura con texto de poco contraste; avisos blancos con texto blanco | Cabecera clara, títulos y metadatos legibles; avisos con texto oscuro, sin duplicados y con un máximo de tres simultáneos |
| Administración | Formularios, pestañas, tablas y acciones con estilos distintos | Componentes comunes en sus 14 vistas; tablas con desplazamiento local y encabezados visibles; búsqueda sin solapamiento del icono |
| Emisor CITV | Panel fijo de 440 px que recortaba controles en celular | Edición apilada y vista previa con desplazamiento propio; medidas y estilos A4 de impresión conservados |
| Páginas auxiliares | Confirmaciones de pago y verificación con formas diferentes | Tarjetas, campos y botones coherentes con el acceso |

La hoja final `css/plataforma.css` concentra estos componentes y se carga después de los estilos anteriores. Los controles de acceso conservan su distribución. Se actualizaron las referencias de caché y las versiones de los scripts modificados.

## Verificación

- 58 pruebas automáticas existentes aprobadas.
- 529 comprobaciones actuales de navegador aprobadas, incluidas la regresión de navegación y formularios y la auditoría de tipografía, controles y tarjetas. Solo se detectaron tamaños de texto de 12, 16 y 22 px en las superficies internas revisadas.
- 228 comprobaciones adicionales de paleta y contraste en 42 vistas de escritorio y celular, aprobadas. Los textos revisados sobre salvia y sus contadores superan una relación de contraste de 4,5:1.
- Capturas de las siete secciones de cliente en seis tamaños: 1920×956, 1366×768, 1024×768, 390×844, 320×568 y 844×390.
- Las 14 vistas de administración revisadas en 1366×768, 390×844 y 320×568.
- Resumen comprobado con 47 consultas de ejemplo y ocho categorías, saldo de cinco cifras y saldo ilimitado, estado vacío y fallo de lectura. Once tamaños revisados, incluidos 1100, 1024, 901, 900, 390, 320 y 280 px de ancho. Sus 174 comprobaciones de distribución, datos y navegación fueron aprobadas.
- Cinco estados auxiliares revisados: pago exitoso, pendiente, rechazado, verificación y emisor CITV. Controles del emisor comprobados en tres tamaños y página de impresión comprobada como A4.
- 1.195 comprobaciones de distribución del login y registro, en 42 vistas de escritorio, tableta, celular y orientación horizontal, aprobadas.
- La comparación de las 42 vistas de acceso y registro con el registro anterior no encontró diferencias en geometría ni en los estilos recogidos. La portada y los formularios de acceso se mantienen fuera de la nueva capa de componentes.
- 59 comprobaciones de autenticación, recuperación y activación con respuestas simuladas, aprobadas.
- Navegación, categorías, búsqueda sin resultados, selección de consulta, validación del dato, espera y envío único, resultado simulado, filtros de historial, placas guardadas, confirmación/cancelación de borrado, edición de cuenta, saldo de cliente, recargas, recuperación del botón tras fallo de checkout, enlaces registrales y diálogo legal ejercitados en navegador.

Las pruebas autenticadas utilizaron datos ficticios en un navegador aislado. Las escrituras se resolvieron en memoria y las solicitudes a los servicios externos quedaron interceptadas. Las capturas y los registros locales están en `.qa-chrome-platform`, `.qa-chrome-mobile-sheet-scroll` y `.qa-chrome-auth-corrections`; son carpetas de trabajo ignoradas por Git.

## Ajuste de color solicitado después de la revisión

La selección final aprobada es verde salvia suave `#e7efea`, con texto principal `#24382c`, texto auxiliar `#4d6256`, distintivos `#d4e2d8` y borde `#b8c9bd`. El texto principal tiene contraste 10,69:1 sobre salvia y el auxiliar 5,61:1; los contadores tienen 9,34:1. Los bordes distinguen el destacado de las tarjetas blancas. Los paquetes mantienen su fondo blanco y el amarillo se conserva en los botones Comprar. Se retiró el rótulo «Pago con Mercado Pago» que aparecía sobre los paquetes. Los precios y la lógica de los pagos se mantienen.

El resumen reúne cuatro cifras de igual proporción, accesos rápidos y un bloque de actividad y categorías. Las categorías tienen filas y barras propias; las etiquetas del gráfico no alteran su escala. Una lectura fallida muestra datos sin actualizar, en lugar de ceros que podrían confundirse con falta de actividad. El título de la cabecera y las acciones también se ajustan a pantallas de 280 px.

El sidebar de escritorio se amplió de 248 a 310 px, exactamente un 25 %. Se retiraron SOAT Electrónico y Lunas Oscurecidas de su sección Servicios adicionales; allí quedan Duplicado CITV e Infracciones por regiones. En pantallas de 901 a 1100 px, las cifras del resumen usan dos columnas para conservar espacio de lectura. En celular se mantiene la navegación inferior. El ajuste pasó 126 comprobaciones de sidebar y 174 de resumen, incluidos los límites de 900 y 901 px.

## Tipografía y componentes internos

La interfaz interna usa Inter con tres tamaños exclusivos: 12 px para ayudas y metadatos, 16 px para contenido y controles, y 22 px para títulos principales y cifras. La regla está acotada al área autenticada, administración y sus superficies auxiliares; no cambia la portada, login, registro ni documentos A4. Una capa de CSS mantiene esta prioridad frente a las hojas heredadas.

Los controles normales usan altura base de 44 px, esquinas de 8 px y borde fino. Las tarjetas y paneles usan radio de 12 px y los distintivos 4 px. Los avatares, indicadores e interruptores conservan su forma funcional. El catálogo usa alturas naturales por fila: un nombre largo no estira toda la rejilla. En celular, los servicios forman una lista con separadores dentro de un solo panel. En las capturas del cliente se midieron 228 controles normales con 44 px de alto.

La auditoría cubrió menús, búsqueda, selección y resultados de consultas, historial, vehículos, pagos, edición de cuenta, administración, diálogos y páginas auxiliares. Los cambios se comprobaron en escritorio y celular con datos ficticios y sin ejecutar operaciones externas reales.

## Catálogo y servicios compactos

El catálogo de escritorio conserva una rejilla de tres columnas, con dos en tamaños intermedios. El nombre ocupa el ancho de la tarjeta; el tipo de dato y el costo quedan separados en la segunda línea. Se eliminó la altura global compartida. En celular, las consultas forman filas de unos 72 px cuando el nombre cabe en una línea; los nombres largos aumentan solo su propia fila. Se conservan las consultas, sus precios, categorías, búsqueda y botón para ver más.

SOAT Electrónico y Lunas Oscurecidas ya no tienen accesos en el sidebar ni en el bloque móvil. También se retiró el enlace independiente de Lunas de las consultas gratuitas. Las consultas de vigencia e historial SOAT y el contenido de los reportes se conservan. Duplicado CITV permanece en el sidebar y dispone de un acceso claro en «Trámites y servicios», disponible en ambos formatos.

Los cinco servicios registrales SUNARP se abren en un desplegable con logotipos originales pequeños y enlaces oficiales conservados. Las veinte consultas gratuitas se organizan en cuatro grupos desplegables, cada uno con su contador. Todos comienzan cerrados. Los paquetes de compra usan menos espacio y, en celular, créditos y precio comparten una fila con el botón Comprar debajo.

WhatsApp dispone de espacio propio junto a la navegación inferior del celular para no cubrir los costos. Su menú se ajusta también en horizontal. La instalación se ofrece en el menú del avatar cuando el navegador la permite, con el mismo manejador y las mismas condiciones de disponibilidad; las páginas sin este menú mantienen su acceso anterior.

Validación de esta actualización: 714 comprobaciones del navegador aprobadas, con 89 vistas de cliente, administración y estados auxiliares y pruebas adicionales del catálogo en doce tamaños, de 280 a 1920 px. Incluyen expandir/contraer, nombres largos, precios, ausencia de los servicios retirados, enlaces oficiales, abrir/cerrar CITV y teclado. Otras 46 comprobaciones aprobadas verificaron la navegación inferior, WhatsApp y la instalación con una respuesta simulada, sin instalar ni enviar mensajes. La auditoría interna mantiene Inter 12/16/22, controles y radios acordados.

Las 1.195 comprobaciones de acceso y registro volvieron a pasar: las 42 distribuciones registradas coinciden con la revisión anterior. Las 58 pruebas automáticas existentes también pasaron. Las respuestas autenticadas se simularon en memoria; no se realizaron cobros ni consultas externas pagadas. Se actualizaron las referencias de caché y se verificó el servidor local; sin commit, push ni despliegue.

## Pendientes de integración y observaciones

1. La entrega real de consultas, incluido el Reporte completo, documentos del proveedor, correos de activación y cobros no se ha certificado con estas pruebas de interfaz. No se crearon cuentas reales ni se enviaron mensajes, consultas pagadas o compras.
2. Los permisos de servidor y los servicios externos mantienen su comportamiento anterior; las respuestas simuladas de esta revisión no acreditan su funcionamiento real.
3. La siguiente revisión interna puede hacerse en `http://localhost:5500/app`, recargando con Ctrl+F5 para recibir las referencias nuevas.
