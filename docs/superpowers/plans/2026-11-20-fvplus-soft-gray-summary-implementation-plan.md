# FV+: gris suave y resumen ordenado

Corrección aprobada: el destacado anterior quedó demasiado oscuro. Usar un gris intermedio visible sobre blanco y sobre el fondo, con textos oscuros. Mantener Comprar amarillo y conservar el login aprobado. Reorganizar Resumen en escritorio y celular, sin publicar.

Selección posterior aprobada: usar verde salvia suave `#e7efea` en lugar del gris. Texto principal `#24382c`, texto auxiliar `#4d6256` y borde `#b8c9bd` para distinguir las superficies blancas. Comprobar contraste de textos, contadores e iconos en navegador y mantener el resumen ordenado.

1. Cambiar los tokens de destacados de `css/plataforma.css` a gris suave y adaptar contadores, iconos, bordes y hover. Mantener el amarillo únicamente en Comprar y el campo de créditos claro.
2. Reordenar el resumen de `app.html`: cuatro cifras con igual proporción; accesos rápidos compactos; actividad y categorías en un bloque de dos columnas. En celular: cifras en dos columnas y actividad/categorías apiladas.
3. Ajustar el renderizado de `js/nueva/pantallas.js`: etiquetas claras, columnas del gráfico con un área de escala independiente de las etiquetas y categorías presentadas como filas con porcentajes y barras. Conservar cálculos, datos y destinos de navegación. Distinguir ausencia de datos de un fallo de carga.
4. Actualizar las referencias de caché y comprobar en navegador aislado datos variados, estado vacío, fallo de lectura, saldo numérico y saldo ilimitado; escritorio, tableta y celular, incluidos 320 px y orientación horizontal. Revisar contraste, alineación, ausencia de recortes y funcionamiento de atajos. Ejecutar las pruebas existentes y registrar el resultado local.
