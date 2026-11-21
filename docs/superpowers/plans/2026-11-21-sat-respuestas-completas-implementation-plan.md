# Corrección de SAT Papeletas

Solicitud: recibir todas las papeletas y sus imágenes de `/sat A7W118`, ordenadas en bloques individuales.

1. Comprobar la respuesta real del bridge existente y guardar evidencia local sin publicar los datos.
2. Corregir `filtro-bridge/response-completion.js`, `response-inbox.js` y el recolector de Telegram para esperar la ráfaga completa. Mantener el orden de mensajes y asociar imágenes con cada papeleta en `parsed.bloques`, conservando campos y adjuntos globales compatibles.
3. Adaptar `renderDataWithMedia` para presentar cada bloque con su imagen correspondiente, contador y disposición móvil. No descartar registros por compartir campos o valores.
4. Verificar recepción con pruebas de ráfagas, mensajes fuera de orden y recuperación de historial, y presentación con diez papeletas y diez imágenes. Ejecutar una consulta real de A7W118 y comprobar el resultado en navegador con datos reales.
5. Aplicar el backend corregido al servicio que utiliza la vista local, manteniendo una sola instancia Telegram. Verificar salud y repetir la consulta controlada. Los cambios del frontend se revisan en el puerto 5500.

Si el proveedor devuelve menos registros o imágenes, conservar todo lo recibido e informar cantidades reales; no completar con datos inventados. La sesión Telegram existente se mantiene exclusivamente en su servicio remoto.
