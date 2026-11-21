# Filtro Vehicular+

Plataforma web de consultas vehiculares y trámites en Perú. El frontend usa HTML, CSS y JavaScript. Supabase gestiona el acceso, los créditos y las funciones de servidor.

## Vista previa local

```powershell
node dev-server.js
```

Abre [el acceso y la plataforma](http://localhost:5500/app) o [Administración](http://localhost:5500/admin). El servidor escucha en el puerto `5500` y sirve las páginas y recursos de FV+.

El emisor CITV se puede revisar en [`/citv-emisor.html`](http://localhost:5500/citv-emisor.html). En Cloudflare Pages, el acceso a esa página requiere Cloudflare Access. La imagen de Fly excluye el emisor.

## Estructura

| Ubicación | Contenido |
| --- | --- |
| `index.html`, `app.html`, `admin.html` | Portada pública, acceso y plataforma, panel administrativo. |
| `verificar.html`, `pago-*.html`, `citv-emisor.html` | Verificación de certificados, retorno de pagos y emisor de certificados. |
| `css/`, `js/` | Estilos y lógica del frontend. `js/nueva/` corresponde a la plataforma, `js/admin/` a Administración, `js/modules/` a consultas y trámites y `js/shared/` a utilidades compartidas. |
| `assets/`, `icons/` | Recursos visuales, iconos de marca e imágenes de la PWA. |
| `supabase/` | SQL versionado, funciones de servidor y plantillas de correo. Consulta su [guía](supabase/README.md). |
| `deploy/`, `Dockerfile`, `fly.toml` | Configuración de Nginx y del frontend en Fly. |
| `_headers`, `_redirects` | Encabezados y redirecciones para Cloudflare Pages. |
| `scripts/`, `test/`, `docs/` | Herramientas de desarrollo, pruebas y documentación. |

El bridge de Telegram tiene su propio repositorio. El frontend solicita las consultas por medio de la función `bridge-proxy` de Supabase. La vista previa usa la configuración de Supabase de la aplicación. Para pruebas internas con operaciones de escritura o cobro, usa cuentas de prueba en un entorno aislado o datos simulados.

## Comprobaciones locales

```powershell
npm test
deno test --no-lock supabase/functions/_shared/maintenance_test.ts supabase/functions/_shared/empty-response.test.ts
```

`npm run icons:build` actualiza el sprite de iconos del interior. `python scripts/generar-iconos.py` regenera los favicons y los iconos instalables desde los SVG de marca.
