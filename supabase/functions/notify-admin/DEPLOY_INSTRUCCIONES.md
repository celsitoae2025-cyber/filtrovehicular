# 🚀 GUÍA DE DESPLIEGUE: Edge Function notify-admin

## ¿Qué hace esta función?
Cuando ocurre un evento (nuevo usuario, pago, solicitud), automáticamente:
1. ✅ Envía mensaje a **Telegram**
2. ✅ Envía **push notification** a tu celular (app instalada)

Funciona **24/7 sin necesidad de tener nada abierto**.

---

## PASO 1: Obtener Firebase Server Key

1. Ve a: https://console.firebase.google.com/
2. Selecciona tu proyecto **filtro2026**
3. Click en ⚙️ **Project Settings**
4. Pestaña **"Cloud Messaging"**
5. Sección **"API de Firebase Cloud Messaging (V1)"**
6. Click en **"Administrar cuentas de servicio"**
7. Se abrirá Google Cloud Console
8. Click en tu cuenta de servicio (la que termina en `@filtro2026...`)
9. Pestaña **"Claves"** → **"Agregar clave"** → **"Crear clave nueva"** → **JSON**
10. Se descargará un archivo `.json` — **GUÁRDALO BIEN**

---

## PASO 2: Desplegar la Edge Function en Supabase

### Opción A: Desde Supabase Dashboard (Sin CLI) ⭐ RECOMENDADO

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto **filtrovehicular**
3. En el menú lateral, click en **"Edge Functions"**
4. Click en **"Deploy a new function"**
5. Nombre de la función: `notify-admin`
6. Copia y pega el contenido del archivo `index.ts`
7. Click en **"Deploy"**

---

## PASO 3: Configurar Variables de Entorno (Secrets)

En Supabase Dashboard → **Edge Functions** → **notify-admin** → **Secrets**:

Agrega estos secrets:

| Nombre | Valor |
|--------|-------|
| `TELEGRAM_BOT_TOKEN` | `8582237665:AAEKxiJcwCcdF3-FhDC7ngwkLflGq-_kwx8` |
| `TELEGRAM_CHAT_ID` | `7556866897` |
| `FIREBASE_SERVER_KEY` | `(el Server Key del PASO 1)` |

---

## PASO 4: Configurar Database Webhook

1. En Supabase Dashboard, ve a **Database** → **Webhooks**
2. Click en **"Create a new hook"**
3. Configura:
   - **Name:** `notify-admin-hook`
   - **Table:** `solicitudes`
   - **Events:** ✅ INSERT
   - **Type:** Supabase Edge Functions
   - **Edge Function:** `notify-admin`
4. Click en **"Create webhook"**

---

## PASO 5: Activar notificaciones en tu celular

1. Abre el Panel Admin en tu celular (desde la URL del servidor)
2. En el sidebar, click en **"🔔 Activar Notificaciones en Tiempo Real"**
3. Acepta los permisos
4. El token se guardará automáticamente en Supabase

---

## FLUJO COMPLETO (automático, 24/7):

```
Usuario se registra / sube comprobante
         ↓
Supabase detecta el INSERT en tabla 'solicitudes'
         ↓
Webhook dispara la Edge Function 'notify-admin'
         ↓
Edge Function envía en PARALELO:
  ├── 📨 Mensaje a Telegram (con nombre, email, placa)
  └── 📱 Push Notification a tu celular (vibración triple)
         ↓
Tu celular suena y vibra ✅ (app abierta o cerrada)
```

---

## 🔑 NOTA SOBRE LA SERVER KEY DE FIREBASE

Si no quieres usar el archivo JSON de cuenta de servicio, puedes usar la **Legacy Server Key**:
1. Firebase Console → Project Settings → Cloud Messaging
2. Sección **"API de Cloud Messaging (heredada)"**
3. Si está inhabilitada, habilítala temporalmente para copiar la Server Key
4. Copia la **"Clave del servidor"** (empieza con `AAAA...`)
5. Úsala como `FIREBASE_SERVER_KEY`

---

## ✅ VERIFICAR QUE TODO FUNCIONA

1. Registra un usuario de prueba en la app principal
2. En 2-3 segundos deberías recibir:
   - Mensaje en Telegram
   - Notificación en tu celular (con vibración)
