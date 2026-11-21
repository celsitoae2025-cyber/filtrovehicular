# FV+: depuración del acceso de escritorio

Diseño aprobado el 20 de noviembre de 2026 en la conversación. Alcance: presentación oscura, acceso y registro blancos de escritorio. Trabajo y pruebas locales; no hacer push, publicar ni desplegar.

1. Capturar una referencia local del acceso y registro en escritorio y móvil. Usar un navegador de prueba con perfil independiente; habilitar el estado visual tras Turnstile únicamente dentro de ese navegador, sin modificar la autenticación de la aplicación.
2. Simplificar `app.html`: marca, título y descripción breves; solicitud de reporte con placa y aclaración de WhatsApp; tres beneficios concisos; fila de paquetes con precio del catálogo. Conservar identificadores, validaciones y aperturas de diálogos. Corregir la identificación por correo y los encabezados del acceso/registro.
3. Consolidar las reglas de escritorio en `css/puerta-entrada.css`: columna oscura con contenido de 600–640 px, formulario blanco de unos 400 px sin borde exterior ni avatar, jerarquía tipográfica, espacios regulares, foco visible y pies alineados. Conservar la distribución móvil y las pantallas de verificación/recuperación. Retirar los desplazamientos artificiales del encabezado en `css/interfaz-tipografia.css`; mantener allí los estilos móviles específicos.
4. Actualizar las referencias de las hojas en `app.html` y la versión local del service worker para que la vista previa sirva el cambio. No realizar cambios en servicios externos.
5. Revisar acceso y registro a 1280×720, 1366×768, 1440×900 y 1920×1080, además de 861/1024 px, ventanas bajas y zoom 200%. Validar que no haya desbordamiento horizontal, recorte de controles ni saltos horizontales entre pestañas. Revisar capturas reales.
6. Probar localmente cambio de pestañas y teclado, conservación de campos, mostrar contraseña, errores de formularios, recuperación, planes, navegadores, términos/cookies y solicitud por placa. Interceptar cualquier entrega a WhatsApp y simular las respuestas de autenticación para evitar crear cuentas o enviar mensajes durante las pruebas internas.
7. Comparar la geometría móvil con la referencia en 320×568, 375×667, 390×844, 768×1024 y tableta táctil; comprobar formulario y pies en horizontal. Ejecutar las pruebas existentes y `git diff --check`. Dejar disponibles el servidor, las capturas y el resultado de la revisión, sin commit, push ni despliegue.

Aceptación: textos aprobados visibles en escritorio; precio procedente del catálogo; ambas tareas distinguibles; acceso y registro operables; recuperación y verificación conservadas; controles alcanzables con teclado y zoom; distribución móvil estable. Las pruebas simuladas de interfaz no prueban un inicio de sesión real, una consulta pagada ni la entrega de un reporte.

## Ajuste solicitado: coherencia con el móvil y mayor área oscura

1. Guardar como referencia las capturas y medidas locales del diseño móvil ya aprobado.
2. En el bloque de escritorio de `css/puerta-entrada.css`, ampliar la columna oscura del 54% al 60% y su contenido máximo de 640 a 740 px. Mantener el formulario centrado, con un máximo de 400 px y espacio para los controles en ventanas estrechas.
3. Aplicar al acceso y registro de escritorio los campos gris suave de 48 px con esquinas de 14 px, títulos centrados y botones negros en cápsula del móvil. Redondear también el selector de acceso/registro y el encuentro del panel blanco con el fondo oscuro. Conservar colores, tipografía, navegación y lógica existentes.
4. Actualizar la referencia de la hoja y la caché local. Revisar capturas reales de ambas pestañas en escritorio y comprobar que las medidas y el aspecto móvil coinciden con la referencia. Probar navegación, validaciones, diálogos, zoom y teclado con respuestas simuladas en el navegador de prueba. Revisar `git diff --check`.

Alcance de este ajuste: estilos de escritorio y actualización de caché; sin publicación ni cambios en servicios externos.

Resultado local: acceso y registro revisados en 21 tamaños de pantalla (42 vistas), con 946 comprobaciones de interfaz correctas y ningún error de ejecución del navegador. La geometría móvil coincide con la referencia. En escritorio de 861 px se compactaron el selector, los espacios de la portada y los enlaces legales para que la pantalla de 768 px de alto no necesite desplazamiento. Capturas y resultados en `.qa-chrome-desktop-mobile-style/`. El servidor de `http://localhost:5500/app` sirve la hoja actualizada; `git diff --check` y la comprobación de sintaxis del service worker correctos.

## Corrección posterior: panel recto y cuenta contenida en una tarjeta

El usuario rechazó las esquinas del panel blanco grande y la distribución del formulario sin contenedor. También pidió mejorar el fondo negro. Esta corrección sustituye el redondeado exterior de la propuesta anterior.

1. En `app.html`, agrupar los formularios y el pie legal dentro de `.nv-puerta-cuenta`. En móvil y en estados especiales, este contenedor usa `display: contents` para mantener la distribución existente.
2. En escritorio, dejar el panel blanco sin borde, redondeado ni sombra. Centrar dentro una tarjeta de hasta 420 px que incluya pestañas, formulario y enlaces legales. Usar espacios regulares y altura ajustada al contenido, sin el mínimo artificial del formulario anterior. Mantener los campos y los botones aprobados.
3. Sustituir la fotografía oscurecida por una superficie gris verdosa clara, con texto verde oscuro y separadores discretos; conservar el amarillo y el verde de la marca. El usuario delegó la elección del tono en la conversación.
4. Actualizar la referencia CSS y la versión de caché. Capturar ambas pestañas, comprobar que todos los controles pertenecen visualmente a la tarjeta, revisar el contraste y comparar la geometría móvil con la referencia. Probar navegación, teclado, validaciones y diálogos en el navegador de prueba, sin cuentas ni mensajes reales. Dejar los cambios únicamente en local.

Resultado de la corrección: 42 vistas revisadas, 1007 comprobaciones de interfaz correctas y ningún error de ejecución del navegador. Panel exterior recto, controles y enlaces legales dentro de la tarjeta; distribución móvil conservada. Contraste sobre el extremo más oscuro del fondo nuevo: 10.19:1 en el título y 5.15:1 en el texto secundario. Capturas y resultados en `.qa-chrome-desktop-compact-card/`. Vista previa local verificada con `puerta-entrada.css?v=26` y caché `v2.278.0-20261120`. Comprobación de sintaxis del service worker y `git diff --check` correctos. Sin publicación.

## Ajuste solicitado: gris neutro, altura y un único borde de foco

1. Sustituir el tinte verdoso de escritorio por un gris cálido muy claro en `css/puerta-entrada.css`, con texto y separadores neutros. Aumentar ligeramente la altura del selector de acceso/registro y el espacio vertical de la tarjeta en ventanas normales; conservar el ajuste compacto en ventanas bajas.
2. Retirar los contornos de foco duplicados de escritorio y móvil. Consolidar en `css/interfaz-tipografia.css` un foco de un solo borde de 1 px gris suave, sin contorno ni sombra adicional, para los campos de acceso, registro, recuperación y restablecimiento, además de las placas de portada y del diálogo de reporte. Mantener las señales de teclado de botones y enlaces.
3. Actualizar las dos referencias CSS de `app.html` y la versión de caché. Revisar capturas reales, clic/tacto y navegación con Tab en campos vacíos y con texto; comprobar que el borde sigue siendo único y no varían medidas ni posiciones al enfocar. Comparar la distribución móvil con la referencia y probar los flujos de interfaz con respuestas simuladas. Todo continúa en local.

Resultado: 42 vistas y 1255 comprobaciones de interfaz correctas, sin errores de ejecución del navegador. Clic, tacto y Tab/Mayús+Tab comprobados en 1366, 861, 390 y 320 px: un borde de 1 px, sin contorno ni sombra adicional ni cambios de tamaño o de relleno, en acceso, registro, recuperación, restablecimiento y placas. Tarjeta y selector de escritorio ligeramente más altos; geometría móvil conservada. Contraste del fondo gris: 11.81:1 en títulos y 5.42:1 en texto secundario. Evidencias en `.qa-chrome-auth-single-border/`. Servidor local verificado con las hojas `puerta-entrada.css?v=27`, `interfaz-tipografia.css?v=19` y caché `v2.279.0-20261120`; sintaxis y revisión de diferencias correctas. Sin publicación.

## Ajuste solicitado: título con carácter de marca y placa proporcionada

1. En el bloque de escritorio de `css/puerta-entrada.css`, dar al título la fuente Inter y el peso 800 del logotipo, con el texto en su capitalización natural, dos líneas y tamaño adaptable de 36 a 46 px.
2. Limitar el bloque de solicitud a 420 px: campo de unos 220 px y botón contiguo, ambos de 52 px de alto y con esquinas de 12 px. Mantener esta fila también en escritorios estrechos de 861 a 1100 px, donde cabe sin apilar controles. Conservar identificadores, texto, validación y el borde único de foco.
3. Actualizar la referencia de la hoja y la versión de caché. Revisar capturas de escritorio, comprobar la coincidencia tipográfica con el logotipo y el ancho real del campo; probar escritura, normalización y apertura del reporte. Comparar acceso, registro y geometría móvil con la referencia. Sin publicación.

Resultado: 42 vistas y 1055 comprobaciones de interfaz correctas, sin errores de ejecución del navegador. Título con la misma fuente y peso 800 de la marca, en dos líneas; campo de placa de aproximadamente 220 px y botón alineado, incluso en escritorio de 861 px. Solicitud, normalización de placa y diálogos comprobados con respuestas simuladas e interceptación de WhatsApp. Geometría móvil conservada. Capturas en `.qa-chrome-brand-heading-plate/`. Servidor local comprobado con `puerta-entrada.css?v=28` y caché `v2.280.0-20261120`; sintaxis del service worker y revisión de diferencias correctas. Sin publicación.

## Ajuste solicitado: gris móvil, pie legal inferior y mayor altura de tarjeta

1. En `css/interfaz-tipografia.css`, aplicar al encabezado móvil el gris claro del escritorio y el nombre de marca oscuro, conservando el signo verde, las dimensiones y las esquinas de la hoja blanca. Cambiar también los fondos oscuros que quedan detrás del encabezado.
2. En `app.html`, dejar el pie legal como hermano de `.nv-puerta-cuenta`. El contenedor mantiene `display: contents` en móvil, por lo que este cambio no altera su orden visual.
3. En escritorio, situar el pie al fondo de la columna blanca, aproximadamente a la altura central de WhatsApp. Centrar la tarjeta en el espacio restante y aumentar su espacio vertical en pantallas normales; reducirlo de forma adaptable en ventanas bajas para conservar el acceso a los controles. Reservar espacio lateral para WhatsApp en escritorios estrechos.
4. Actualizar referencias de hojas y caché. Comparar medidas móviles con la referencia, comprobar logo oscuro y fondo gris en acceso/registro, revisar capturas de escritorio y ausencia de solapamiento entre tarjeta, enlaces y WhatsApp. Probar navegación, validaciones y diálogos con respuestas simuladas. Sin publicación.

Resultado: 42 vistas y 1091 comprobaciones de interfaz correctas, sin errores de ejecución del navegador. Fondo móvil gris claro y marca oscura con el signo verde, conservando la geometría del formulario. En escritorio, pie legal separado de la tarjeta y alineado aproximadamente con el centro de WhatsApp; tarjeta unos 21 px más alta en pantallas amplias y ajustada a la altura disponible en ventanas bajas. Sin solapamiento entre enlaces y controles. Evidencias en `.qa-chrome-mobile-gray-desktop-footer/`. Servidor local comprobado con `puerta-entrada.css?v=29`, `interfaz-tipografia.css?v=20` y caché `v2.281.0-20261120`; sintaxis y revisión de diferencias correctas. Sin publicación.
