# FV+: reconstrucción del interior

## Resultado

La interfaz interior comparte los colores del login y del logotipo. Usa gris neutro `#f3f3f3`, blanco `#ffffff` y carbón `#1b1b1b`. El icono de Reporte completo es blanco. Comprar usa el amarillo `#ffb51b` del acceso y el verde del signo «+» identifica la sección activa del menú lateral.

Se mantienen Inter y los tres tamaños acordados: 12, 16 y 22 px. Los controles normales tienen altura mínima de 44 px y esquinas de 8 px; las superficies, radio de 10 px. Los campos muestran un único borde fino.

## Componentes

- Sidebar de escritorio de 310 px en grafito con navegación, trámites y administración. Cabecera blanca con saldo, Comprar, avatar y menú anclado a la cuenta. Navegación inferior y espacio propio para soporte en celular.
- Catálogo en filas con icono, nombre, dato y costo separados. Búsqueda y selector comparten barra en escritorio; se apilan en celular. El selector abre hacia el espacio disponible y permite desplazarse hasta todas las categorías. Reporte completo destacado en grafito.
- Trámites y fuentes externas agrupados. Se mantienen CITV, cinco servicios SUNARP y veinte accesos gratuitos. No reaparecen las ofertas retiradas de SOAT Electrónico y Lunas Oscurecidas.
- Resumen con cuatro cifras proporcionadas, accesos rápidos, gráfico con escala independiente y reparto por categoría. Conserva vacío, fallo de lectura y recuperación.
- Historial con filtros y búsqueda agrupados. El selector móvil de estado comparte controlador con los botones de escritorio. Vehículos con formulario compacto y acciones separadas.
- Pagos con paquetes proporcionados, Comprar amarillo y recarga personalizada independiente. Cuenta con identidad, datos editables y utilidades organizadas. Pie común con términos, cookies y navegadores compatibles conectados.
- Administración, resultados, avisos, diálogos y estados auxiliares comparten tipografía, bordes y paleta. Las tablas se desplazan dentro de sus cajas.

## Iconos y alcance del código

Los iconos propios están en `assets/icons/interior.svg`. `npm run icons:build` genera `js/shared/interior-icons.js`, con símbolos privados `fv-*` montados dentro de la aplicación. No dependen de peticiones al dibujar una consulta. Su contenedor de tamaño cero queda fuera del flujo y no altera el acceso público.

El diseño se concentra en `css/plataforma.css`. Se sustituyó su arquitectura visual, manteniendo la capa tipográfica y las protecciones de documentos. Los IDs, rutas, atributos y controladores de negocio permanecen conectados. No se modificaron precios, permisos, cobros ni plantillas de documentos.

CITV mantiene accesibles el cierre y la acción principal al desplazarse. Se corrigió su foco inicial, se añadió navegación de teclado dentro del diálogo y se devuelve el foco al origen al cerrar. Se conservan el costo de 40 créditos y la validación previa a consultar.

## Verificación local

| Comprobación | Resultado |
| --- | --- |
| Siete secciones del cliente, catorce vistas de administración, cinco estados auxiliares y regresión funcional | 613 comprobaciones aprobadas; 89 vistas |
| Clics reales, categorías, filas, iconos, fuentes, CITV, historial móvil y pie en quince tamaños de 280 a 1920 px | 221 comprobaciones aprobadas |
| Resumen con 47 consultas ficticias, saldo de cinco cifras, vacío, error y recuperación en once tamaños | 174 comprobaciones aprobadas |
| Avatar, menú, instalación simulada, navegación inferior y soporte | 46 comprobaciones aprobadas |
| Acceso y registro en escritorio, tableta, celular y horizontal | 1.195 comprobaciones aprobadas; 42 vistas |
| Pruebas automáticas del repositorio | 58 aprobadas |

Las 42 distribuciones del acceso coinciden con la referencia anterior. También coincide el marcado anterior a `#nvApp`, normalizando solo la versión del enlace CSS. Portada, login y registro conservan su diseño.

Se comprobaron sintaxis, diferencias de espacios y respuestas HTTP del servidor contra los archivos locales. Los registros y capturas están en las carpetas locales de QA ignoradas por Git. Se actualizaron las versiones de caché.

## Límite de la verificación

Las pruebas autenticadas usan datos ficticios y respuestas en memoria; las llamadas externas quedan interceptadas. No se crearon cuentas reales, enviaron mensajes, instalaron aplicaciones ni realizaron consultas pagadas o cobros. Estas pruebas verifican la interfaz y los flujos locales; no certifican la entrega real de proveedores o pagos.

Disponible en `http://localhost:5500/app`. Sin commit, push ni despliegue.
