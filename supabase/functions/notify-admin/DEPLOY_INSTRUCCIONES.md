# Notificaciones Push + Telegram (App Cerrada)

## ¿Que hace?
Cuando un usuario envia una solicitud, el admin recibe:
1. Mensaje en **Telegram** (ya funciona)
2. **Notificacion Push** en el celular/PC con sonido (incluso con la app cerrada)

## Flujo
```
Usuario envia solicitud → INSERT en Supabase
                               ↓ (Database Webhook)
                    Edge Function notify-admin
                               ↓
              Telegram ✅  +  Web Push ✅
                               ↓
              Admin recibe notificacion con sonido
              (app abierta O cerrada)
```

---

## Pasos para activar

### PASO 1: Crear tabla push_subscriptions
1. Supabase Dashboard → **SQL Editor** → **New Query**
2. Pega y ejecuta el contenido de `supabase/crear_tabla_push_subscriptions.sql`

### PASO 2: Desplegar Edge Function
1. Dashboard → **Edge Functions** → **Deploy a new function**
2. Nombre: `notify-admin`
3. Pega el contenido de `supabase/functions/notify-admin/index.ts`
4. **Deploy**

### PASO 3: Configurar Secrets
Dashboard → Edge Functions → notify-admin → **Secrets**:

| Nombre             | Valor |
|--------------------|-------|
| TELEGRAM_BOT_TOKEN | `8582237665:AAEKxiJcwCcdF3-FhDC7ngwkLflGq-_kwx8` |
| TELEGRAM_CHAT_ID   | `7556866897` |
| VAPID_PUBLIC_KEY   | `BB9RR2pu2n7t0j6cLWbN-CcdiSrKDZ0pwF--IxLjAU_IFjd6cPd6GASa8lEyya_TksACxoL_Ll8zxs9sC6sb9kQ` |
| VAPID_PRIVATE_KEY  | `K2fTXmfrSPbUzDX_ZqRzGcm6mst_FUqAarioxU3328I` |

### PASO 4: Configurar Database Webhook
1. Dashboard → **Database** → **Webhooks** → **Create**
2. Name: `notify-admin-hook`
3. Table: `solicitudes`
4. Events: **INSERT**
5. Type: **Supabase Edge Functions**
6. Function: `notify-admin`
7. **Create**

### PASO 5: Activar Push en el Admin Panel
1. Abre admin.html en tu celular/PC
2. En el sidebar, busca **Notificaciones Push**
3. Click **Activar Notificaciones**
4. Acepta el permiso del navegador
5. Listo - recibirás alertas incluso con la app cerrada

---

## Verificar
1. Registra un usuario de prueba
2. Deberias recibir: Telegram + Notificacion Push con sonido
3. Cierra la app completamente y repite - debe seguir llegando
