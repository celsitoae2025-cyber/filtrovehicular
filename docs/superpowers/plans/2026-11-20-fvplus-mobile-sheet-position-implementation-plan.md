# FV+: posición del panel móvil y desplazamiento estable

Alcance solicitado: subir el panel blanco móvil hasta la referencia de la flecha y corregir el movimiento del registro al deslizar. Conservar estilos y comportamiento de escritorio. Trabajo únicamente local.

1. En el bloque móvil de `css/interfaz-tipografia.css`, reducir la cabecera normal al 26.5% de la altura pequeña del dispositivo, con máximo de 220 px. El panel sube unos 60 px en el tamaño de la captura. Mantener la misma posición para acceso y registro.
2. Usar `svh` para que las barras del navegador no desplacen la cabecera al cambiar la altura visible. Limitarla a la mitad del espacio visible cuando aparece el teclado para que los campos sigan siendo alcanzables.
3. Evitar el rebote y la propagación del desplazamiento en el marco y en el contenido; desactivar el anclaje automático del contenido. Conservar el desplazamiento interno cuando el teclado, el zoom o los mensajes requieren más espacio.
4. Actualizar referencia CSS y versión de caché. Comparar escritorio con la referencia sin cambios; revisar acceso y registro móviles, gestos verticales, variaciones de altura visible, teclado, errores y navegación. Comprobar capturas y assets servidos por localhost. Sin publicación.

Resultado: 1195 comprobaciones correctas, sin errores de ejecución del navegador. En las capturas normales el panel sube unos 60 px; en 364 × 806 queda a la altura de la flecha. Gestos verticales en acceso/registro comprobados a 364 × 806, 337 × 813, 390 × 844 y 320 × 568: sin desplazamiento del texto ni de la página. Al variar 50 px la altura visible, la posición del encabezado y del texto permanece estable. Campos y botones alcanzables con alturas visibles de teclado de 350 y 250 px. Medidas de escritorio conservadas. Capturas y resultados en `.qa-chrome-mobile-sheet-scroll/`. Servidor local verificado con `interfaz-tipografia.css?v=21` y caché `v2.282.0-20261120`; sintaxis y revisión de diferencias correctas. Sin publicación.
