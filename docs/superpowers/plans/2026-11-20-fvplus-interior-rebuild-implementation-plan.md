# Reconstrucción del interior: implementación

1. Guardar una referencia local de los archivos interiores y las distribuciones del acceso. Conservar el trabajo previo sin revertir ni publicar.
2. Crear `assets/icons/interior.svg` y aplicarlo a navegación, servicios, registros y acciones internas. Comprobar cada referencia y su representación en el navegador.
3. Reorganizar exclusivamente `#nvApp` en `app.html`: sidebar, saldo en cabecera, barra de filtros, listado, recursos y pie. Mantener todos los IDs y atributos utilizados por los controladores.
4. Sustituir el diseño interior en `css/plataforma.css`, con un sistema coherente de superficies, botones, campos, rejillas, filas y puntos de adaptación. Conservar las reglas tipográficas y de impresión acotadas; reconstruir los componentes, sin añadir otra hoja de parches al diseño anterior.
5. Ajustar los fragmentos visuales de `js/nueva/pantallas.js`, los iconos internos de `servicios.js`, la instalación en el menú y los iconos de administración. No cambiar precios, permisos ni operaciones remotas.
6. Validar los flujos completos con datos simulados en navegador, las siete secciones del cliente, las catorce vistas de administración y páginas auxiliares. Usar el selector de categoría que realmente ve el usuario. Revisar capturas y corregir defectos.
7. Ejecutar pruebas existentes, auditoría de componentes y regresión del acceso. Comprobar las respuestas del servidor contra los archivos y actualizar cachés e informe local. Sin commit, push o despliegue.

Recuperación: las referencias anteriores están en la carpeta local de QA ignorada. La reconstrucción no realiza migraciones ni altera datos persistidos, credenciales o servicios externos.

Completado en local. Ver resultados y límites en `docs/revision-interior-2026-11-20.md`. El generador de iconos está en `scripts/build-interior-icons.mjs` y se ejecuta con `npm run icons:build`.
