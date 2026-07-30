# Filtro Vehicular+ — Plataforma de Consultas

Plataforma web de consultas de datos peruanos (RENIEC, SUNARP, SUNAT, MTC, etc.) con autenticación, sistema de créditos, suscripciones y panel administrativo.

## Stack

- **Frontend:** HTML/CSS/JS vanilla (sin framework), modular ES con namespace `window.Consultia`.
- **Backend de datos:** Supabase (PostgreSQL + Auth + RLS + Realtime + Edge Functions).
- **Bridge de Telegram:** Node.js + Express + GramJS (repo separado: `filtro-bridge/`, deploy en Railway).
- **Pagos:** Mercado Pago (Edge Function + webhook).
- **Email transaccional:** Brevo (300 emails/día).
- **PWA:** `manifest.json` + `sw.js`.

## Estructura

```
FV+/
├── index.html                  # Landing + app (sidebar + vistas)
├── admin.html                  # Panel administrativo
├── pago-exitoso.html           # Confirmación de pago MP
├── pago-pendiente.html         # Pago MP en revisión
├── manifest.json, sw.js        # PWA
├── dev-server.js               # Servidor estático local (puerto 5500)
│
├── css/                        # 10 hojas de estilo modulares
│   ├── base.css                # Variables, reset, tipografía
│   ├── sidebar.css, topbar.css # Navegación
│   ├── components.css          # Botones, inputs, cards, badges
│   ├── views.css               # Vistas y resultados de consultas
│   ├── plans-catalog.css       # Catálogo de planes / saldo
│   ├── auth.css, overlays.css  # Auth + modales / cookies
│   ├── polish.css              # Refinamientos visuales
│   └── admin.css               # Panel admin
│
├── js/
│   ├── main.js, sidebar.js, topbar.js, views.js, overlays.js
│   ├── shared/                 # supabase-config, auth, plans-data,
│   │                           # device-fingerprint, email-validator
│   ├── modules/                # 1 archivo por categoría / feature
│   │                           # (reniec, sunat, vehiculos, mtc, vip, etc.)
│   └── admin/                  # 18 módulos del panel administrativo
│
├── supabase/                   # SQL versionado + Edge Functions
│   ├── README.md               # Índice + orden de ejecución
│   ├── schema/                 # Tablas core, RLS base, RPC (00_schema_inicial.sql, etc.)
│   ├── anti_abuse/             # Trigger handle_new_user con anti-abuso + welcome restriction
│   ├── admin/                  # Funciones / RLS / RPC del panel admin
│   ├── seeds/                  # Catálogos: consultas, fuentes, planes premium
│   ├── fixes/                  # Parches puntuales aplicados a tablas existentes
│   ├── functions/              # Edge Functions (TypeScript / Deno)
│   │   ├── bridge-proxy/       # Proxy autenticado al bridge de Telegram
│   │   ├── consultar-docs/
│   │   ├── crear-preferencia/  # Mercado Pago checkout
│   │   ├── diagnose-payment/   # Debug de pagos
│   │   └── webhook-mercadopago/
│   └── email-templates/        # Plantillas Brevo (signup, magic-link, reset)
│
├── assets/                     # Iconos, regiones, servicios
├── icons/                      # Favicons PWA
│
└── filtro-bridge/              # ⚠ REPO SEPARADO (gitignored del padre)
                                # Bridge Telegram en Railway
```

## Cómo correr en local

**1) Bridge de Telegram (puerto 3030):**

```powershell
cd filtro-bridge
npm start
```

> ⚠️ Apaga el deploy de Railway antes para no chocar con la session de Telegram (`AUTH_KEY_DUPLICATED`).

**2) Frontend (puerto 5500):**

```powershell
node dev-server.js
```

Abrir: **http://localhost:5500**

`index.html` detecta automáticamente `localhost` y apunta al bridge en `:3030`.

## Producción

- **Frontend:** hosting estático (dominio `filtrovehicularperu.com`).
- **Bridge:** Railway → `https://filtro-bridge-production-6fd9.up.railway.app`.
- **Supabase:** `https://kkqpayfyhvxatskkrqdg.supabase.co`.

## Notas

- El sidebar se despliega en accordion (solo una categoría abierta a la vez).
- Todo el código JS usa scripts clásicos con namespace `window.Consultia` (sin bundler).
- RLS activo en todas las tablas con datos sensibles; admins se identifican por `profiles.is_admin`.
- Los archivos `*.md` de credenciales y notas personales están en `.gitignore`.
