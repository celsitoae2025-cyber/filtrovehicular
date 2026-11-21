# FV+: destacados en gris oscuro

Diseño solicitado y aprobado: sustituir los cuadros y selecciones amarillos por el gris oscuro del login, conservando el amarillo de los botones Comprar y quitando el rótulo «Pago con Mercado Pago» sobre los paquetes. Mantener la geometría aprobada y trabajar exclusivamente en local.

1. Ajustar `css/plataforma.css`: separar el acento de compra de los destacados neutros. Aplicar fondo oscuro y texto claro a reporte, saldo, navegación y categorías activas, destacados de servicios y selecciones administrativas. Usar bordes y distintivos grises en paquetes. Mantener legibles los contadores, iconos, ayudas y estados hover.
2. Quitar de `app.html` el rótulo señalado sobre los paquetes; conservar precios, enlaces y lógica de pago. Actualizar la referencia de la hoja compartida en las seis páginas que la cargan y la versión de `sw.js`.
3. Comprobar en navegador aislado escritorio y celular: destacados grises, compras amarillas, contraste de textos y contadores, ausencia del rótulo, ajuste sin desbordamientos y navegación/categorías. Usar respuestas locales simuladas y conservar intacto el diseño del login.
4. Registrar la corrección en el informe de revisión y verificar que el servidor local sirve los archivos actualizados. Sin commit ni publicación.
