# FV+: mejora del acceso y registro móviles

Diseño aprobado en la conversación del 20 de noviembre de 2026. Se conserva la tarjeta casi a pantalla completa, las pestañas en la parte superior y el pie fuera del contenido desplazable. Trabajo exclusivamente local, sin commit, push ni despliegue.

1. Capturar la versión local actual para comparar escritorio, tarjeta, posición superior de las pestañas y pie móvil. Usar el navegador de pruebas aislado, con verificación de acceso simulada únicamente durante QA.
2. Actualizar `app.html`: sustituir el avatar por el logo de FV+ y el nombre de marca; retirar subtítulos e invitaciones duplicadas; unificar la solicitud móvil con «Solicita tu reporte», «Placa del vehículo», ejemplo ABC123, «Solicitar reporte» y «Solicitud por WhatsApp». Conservar identificadores y eventos existentes.
3. Consolidar en `css/interfaz-tipografia.css` las reglas del acceso móvil. Agrupar los campos con espacios regulares, distinguir la solicitud mediante un separador, asegurar campos y botones de al menos 44 px y permitir desplazamiento interior en pantallas bajas o con teclado. Mantener el registro claro, con instrucciones de contraseña y aceptación de condiciones. Conservar la disposición táctil horizontal con controles alcanzables.
4. Actualizar la referencia de la hoja de estilos y la caché local. Comprobar que localhost sirve los archivos nuevos.
5. Validar acceso y registro en 320×568, 360×640, 375×667, 390×844, 412×915, 768×1024, tableta táctil y horizontal. Comparar geometría exterior con la referencia; comprobar que no hay desbordamiento horizontal, solapamientos o acciones inaccesibles. Revisar capturas.
6. Probar pestañas, conservación de datos, contraseña visible, errores, foco, solicitud de placa con precarga, cierre de diálogos y retorno del foco. Interceptar la salida a WhatsApp; no enviar mensajes ni crear cuentas. Simular una reducción de altura visible para comprobar los campos y el botón con teclado.
7. Comparar escritorio con las capturas y medidas anteriores; ejecutar las pruebas existentes, sintaxis de los archivos JS tocados y `git diff --check`. Mantener el servidor local disponible para revisión del usuario.

Aceptación: marca identificable y encabezados sin repetición; dos tareas claramente separadas; botones/campos cómodos; tarjeta, pestañas y pie estables al cambiar de formulario; recorrido completo accesible al desplazar el contenido; escritorio conservado. QA de interfaz no equivale a una autenticación real ni a la entrega de un reporte.

## Corrección aprobada tras la revisión móvil

El usuario solicita que la pantalla completa entre sin desplazamiento normal y que nunca se dibuje la barra interna. Compactar los espacios según el alto disponible, mantener placa y acción en la misma fila en teléfonos pequeños y redistribuir el formulario horizontal cuando sea necesario. Mantener controles principales de al menos 44 px y campos de 16 px. Conservar desplazamiento accesible sin barra para teclado, zoom o mensajes largos que reduzcan excepcionalmente el espacio.

Reservar un pie de 64 px más el área segura inferior, con WhatsApp separado 12 px del borde inferior y lateral. Los enlaces legales deben adaptarse sin quedar debajo del botón. Validar sin desplazamiento acceso y registro entre 280–1024 px de ancho móvil, desde 320 px de alto horizontal, incluyendo 337×813 como referencia de la captura; comprobar formulario rellenado, errores, teclado y conservación del escritorio. Todo continúa local, sin publicación.
