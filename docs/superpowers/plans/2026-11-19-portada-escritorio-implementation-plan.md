# Portada de acceso para escritorio

Solicitud aprobada: reconstruir el panel oscuro del login y publicarlo junto con la migración local a Inter y las correcciones de interfaz ya realizadas.

1. Sustituir el contenido de `.nv-portada` en `app.html` por marca, propuesta de valor, tres áreas de consulta, acceso a planes y alternativa de reporte por WhatsApp. Usar Inter, tres tamaños y la paleta neutra, sin sombras ni cifras comerciales inventadas.
2. Reemplazar las reglas de escritorio de `css/puerta-entrada.css`, con distribución vertical equilibrada desde 861 px y ajustes para portátiles. Mantener el formulario y la presentación móvil.
3. Compartir los cuatro paquetes existentes entre la página de pagos y un diálogo público de planes. Seleccionar continuar lleva al registro o acceso y conserva `#pagos` como destino posterior a la autenticación. No iniciar cobros desde la portada.
4. Revisar capturas y controles en 861, 1024, 1366 y 1920 px; comprobar la versión móvil en 390 px. Revisar abrir/cerrar planes, retorno del foco, precios y registro/acceso. Ejecutar comprobaciones de sintaxis y diferencias.
5. Actualizar versiones, confirmar los cambios, publicar en origin/main y desplegar el frontend Fly configurado. Confirmar igualdad del SHA remoto y comprobar los archivos servidos tanto por Fly como por el dominio principal. Si el dominio usa otro origen, comprobar la publicación automática o su proveedor existente.

Recuperación: ante un fallo de publicación, conservar el commit y su evidencia; volver a desplegar la imagen anterior si el nuevo frontend no pasa la comprobación HTTP. No cambiar backend, credenciales, bridge ni contratos de pagos.
