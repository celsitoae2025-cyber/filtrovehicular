# Informe: la app de celular de Filtro Vehicular+

Fecha: 2026-09-24.

**Qué se decide aquí:** una aplicación **aparte**, hecha solo para teléfono,
con la marca Filtro Vehicular+, que se instala desde la web sin pasar por
ninguna tienda. La web actual (`app.filtrovehicularperu.com` no existe todavía;
hoy todo vive en `filtrovehicularperu.com/app`) **no se toca**: sigue igual para
quien entre desde la computadora.

Este documento es el plan. No se ha tocado nada todavía.

---

## 1. Dónde vive y qué comparte

| Pieza | Decisión |
|---|---|
| Dirección | `app.filtrovehicularperu.com` — subdominio propio |
| Código | carpeta nueva `movil/` en este mismo repositorio |
| Publicación | segundo proyecto de Cloudflare Pages apuntando a `movil/` |
| Base de datos | **la misma** Supabase: mismos usuarios, mismos créditos, mismo historial |
| Motor de consultas | **el mismo**: `bridge-proxy` → `filtro-bridge.fly.dev` → bots de Telegram |
| Catálogo | **el mismo** `consultas_catalog`: un cambio de precio o de bot vale para los dos a la vez |

Se separa la **cara**, no el negocio. No hay una segunda base de datos, ni un
segundo bridge, ni precios que puedan descuadrarse.

**Tres cosas que hay que recordar por ser un dominio nuevo:**

1. En Supabase → Authentication → URL Configuration hay que añadir el
   subdominio a las *redirect URLs*, o los correos de acceso llevarán al sitio
   viejo.
2. La sesión **no se hereda**: quien ya esté dentro en la web tendrá que entrar
   una vez en la app. Es lo normal en dominios distintos.
3. Hay que repetir en el nuevo sitio las cabeceras de seguridad de `_headers`
   (CSP, HSTS) y dar de alta el dominio en Turnstile.

---

## 2. Solo teléfono, de verdad

- El diseño se hace a 360-430px de ancho y **no existe versión de escritorio**:
  nada de columnas que se estiran ni barra lateral escondida.
- Quien abra el subdominio desde una computadora ve una pantalla con el código
  QR para abrirlo en el teléfono y un enlace a la web de siempre. No se le deja
  a medias ni se le enseña una app diminuta en medio de un monitor.
- Gestos y hábitos de teléfono: barra inferior fija, deslizar para volver,
  tirar para refrescar, teclado correcto por tipo de dato, zonas de toque de 44px
  como mínimo, respeto de la muesca y de la barra de gestos
  (`env(safe-area-inset-*)`).
- Vertical siempre (`orientation: portrait`).

---

## 3. Qué se entrega

1. App instalable desde el navegador del celular, con su icono, sin barra de
   navegador, que arranca en la pantalla de consultas.
2. **Todas las consultas del catálogo en un solo buscador**: se escribe
   «boleta», «soat», «dni» y sale, sin recordar pestañas ni categorías.
3. Barra inferior de cuatro destinos: Consultas, Historial, Saldo, Cuenta.
4. Resultado con **previsualización dentro de la app**: el texto formateado y
   el PDF visible, con Descargar y Compartir por la hoja nativa del teléfono
   (WhatsApp, correo).
5. Cartel de instalación propio: en Android con el botón real del navegador; en
   iPhone con el paso a paso de Compartir → Añadir a pantalla de inicio, que es
   la única manera y hay que explicarla.
6. Vista previa de la app en el diálogo de instalación de Android (capturas
   declaradas en el manifiesto).

---

## 4. Fases

### Fase 1 — Esqueleto y publicación (1 día)
Carpeta `movil/` con su `index.html`, su `manifest.json` (nombre, iconos ya
existentes de `icons/`, color `#141d1c`, `display: standalone`, `portrait`),
su `sw.js` con versión propia y su `_headers`. Segundo proyecto de Cloudflare
Pages, DNS del subdominio, dominio en Turnstile y redirect URLs en Supabase.
Al final de la fase ya se puede instalar en el teléfono, aunque esté vacía.

### Fase 2 — Entrar (1 día)
Pantalla de acceso a sangre, pensada para pulgar: correo y contraseña,
recordar sesión, y el mismo guardián de cuenta activa. Se reaprovecha
`auth-modals.js` y `auth-gate.js` quitándoles lo que es de escritorio.

### Fase 3 — El armazón (2 días)
Barra inferior fija, encabezado compacto con saldo, navegación entre las cuatro
vistas sin recargar, pantalla de sin conexión honesta. Reglas de la casa:
sin sombras, sin franjas de color, cuerpo 17-19px, espaciado fijo de 4px,
superficies oscuras `--c-surface-dark`, pesos 400 y 700, iconos SVG de trazo.

### Fase 4 — Consultas y buscador (2 días)
Carga del catálogo completo de una sola llamada, agrupado por categoría, con
buscador que ignora acentos y mayúsculas. Favoritos y recientes arriba. Cada
consulta enseña precio en créditos y qué dato pide. El motor de ejecución y de
cobro es el mismo `consulta-runner.js` de hoy, movido a `shared/` para que lo
usen los dos sitios y no se dupliquen los cobros ni las validaciones.

### Fase 5 — Resultado y previsualización (2 días)
Ficha a pantalla completa con todo lo que devuelve el bot (no se descarta ni se
reordena nada; solo se oculta el saldo del proveedor). PDF incrustado en
Android; en iPhone se pinta la primera página con `pdf.js` —ya está en el
proyecto— porque el visor embebido no se porta bien. Botones Descargar y
Compartir con `navigator.share`. Espera sin tope, con Cancelar siempre visible.

### Fase 6 — Saldo, historial y cuenta (1 día)
Saldo con recarga por los medios que ya existen, historial de consultas con
acceso al PDF anterior, y datos de la cuenta con cerrar sesión.

### Fase 7 — Instalación y pulido (1 día)
Cartel de instalación para Android y para iPhone, capturas en el manifiesto,
accesos directos al mantener pulsado el icono, y el repaso de las trampas de
caché (`CACHE_VERSION` del nuevo `sw.js` y los `?v=` de la app nueva).

---

## 5. Pruebas antes de darlo por bueno

- Android real: instalar, abrir desde el icono, consultar con PDF y compartirlo
  por WhatsApp.
- iPhone real por Safari: el mismo recorrido, incluida la instalación guiada.
- Pantalla de 360px: ninguna vista con desplazamiento horizontal.
- Modo avión: la app abre y avisa, no queda en blanco.
- Un cobro real de cada tipo: placa, DNI, teléfono, y una consulta con PDF.
- Abrirla en computadora: tiene que salir el QR, no la app encogida.

---

## 6. Lo que hace falta de tu parte

1. Confirmar el subdominio (`app.filtrovehicularperu.com` u otro).
2. Las capturas para el diálogo de instalación, cuando la Fase 5 esté en pie.
3. Un Android y un iPhone para las pruebas finales.
4. Decidir si la barra inferior lleva cuatro destinos o cinco (entraría
   Soporte).

---

## 7. Lo que NO incluye

- No hay Play Store ni App Store: se instala desde la web. Si algún día se
  quiere en Play Store, esta misma app se empaqueta con Trusted Web Activity
  sin rehacer nada, pero eso es otro trabajo, con cuenta de desarrollador y
  revisión de Google.
- No se toca la web actual, ni los precios, ni el cobro, ni el bridge, ni los
  bots.
- No se duplica el catálogo: sigue mandando Supabase.

---

## 8. Tiempo

Diez días de trabajo en siete fases. Desde la Fase 1 la app ya se instala en tu
teléfono y cada fase se puede ver terminada sin esperar al final.
