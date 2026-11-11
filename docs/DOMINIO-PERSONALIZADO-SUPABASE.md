# Dominio propio para Supabase

Estado: preparación local. El dominio todavía no está activado en Supabase ni en DNS; por eso la aplicación conserva el endpoint actual y el acceso sigue funcionando.

## Dominio previsto

`auth.filtrovehicularperu.com`

Este host reemplazará el dominio público del proyecto en las peticiones del navegador a Supabase Auth, REST, Realtime, Storage y Edge Functions.

## Activación pendiente

1. En Supabase, habilitar el dominio personalizado del proyecto y solicitar `auth.filtrovehicularperu.com`.
2. Crear en el proveedor DNS los registros exactos que entregue Supabase. No se deben adivinar los destinos ni activar el cambio antes de verificar el certificado.
3. En el cliente OAuth web de Google, añadir como URI autorizada el callback que confirme Supabase; para el dominio previsto será `https://auth.filtrovehicularperu.com/auth/v1/callback`. Mantener también el callback actual durante la migración.
4. En Supabase, conservar en la lista de retorno permitida las URLs de la aplicación, incluyendo `https://filtrovehicularperu.com/app` y `http://localhost:5500/app`.
5. Cuando Supabase confirme que el dominio está activo, asignar `https://auth.filtrovehicularperu.com` a `SUPABASE_CUSTOM_DOMAIN_URL` en `js/shared/supabase-config.js`.
6. Verificar inicio de sesión con Google y las llamadas de Auth, REST, Realtime y Edge Functions antes de publicar.

No colocar el Client Secret de Google en este repositorio ni en el frontend; permanece en la configuración del proveedor de Supabase.
