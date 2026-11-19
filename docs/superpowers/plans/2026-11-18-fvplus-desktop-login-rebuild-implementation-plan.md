# Reconstrucción del panel de presentación del acceso

Alcance aprobado: rehacer la columna oscura de escritorio, reorganizar su contenido y corregir los textos. Mantener la paleta carbón, blanco y gris, Poppins y los tamaños 12 / 16 / 22 px.

1. Reemplazar el contenido del `aside` en `app.html`: marca con el ícono existente en la cabecera, introducción clara y tres áreas de consulta en el centro, solicitud del filtro completo y acceso a navegadores en la zona inferior. Conservar los identificadores y atributos que abren los diálogos.
2. Sustituir los ajustes anteriores del panel en `css/puerta-entrada.css` por una composición con clases propias. Aplicarla desde 861 px, con espacios más compactos en portátiles y ventanas bajas. Conservar el formulario derecho y los controles móviles.
3. Comprobar el diseño renderizado a 1440, 1366, 1024 y 861 px; revisar alturas pequeñas, tipografía, contraste, desbordamientos y apertura/cierre de los dos diálogos. Comparar la apariencia móvil antes y después.
4. Actualizar la versión de la hoja y del service worker. Publicar en el repositorio y en el hosting ya autorizado; confirmar el SHA remoto y que el dominio sirve los archivos exactos del commit.

Si se detecta una regresión de escritorio, corregir las reglas del panel; no modificar estilos generales del formulario ni la autenticación para resolverla.
