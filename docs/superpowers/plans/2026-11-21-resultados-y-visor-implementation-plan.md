# Implementación

1. En `js/modules/render-helpers.js`, ordenar copias de los campos dentro de cada registro y entre notas separadoras. Aclarar etiquetas vehiculares conocidas sin tocar los valores o el PDF. Mantener la agrupación existente de registros repetidos.
2. En `css/plataforma.css`, simplificar la ficha a tres, dos o una columnas según el espacio disponible, con títulos, etiquetas y valores legibles. Mantener las imágenes ampliables y evitar huecos grises en la última fila.
3. Separar el visor PDF de las reglas para cuadros blancos y botones de cierre de solo icono. Ajustar su encabezado, acciones y estado de respaldo en `render-helpers.js` y `plataforma.css`. Comprobar cierre, Escape, regreso, descarga original y una apertura posterior.
4. Ejecutar pruebas de conservación y orden de datos, la suite existente y QA de navegador con respuestas de prueba y PDF de varias páginas. Revisar capturas en ordenador y celular y verificar el acceso sin cambios.
5. Incrementar versiones de recursos y service worker, publicar conforme a la autorización vigente y comprobar archivos y vista publicada. No se modifican el puente, las consultas ni los cobros. Revertir el commit si falla la publicación.
