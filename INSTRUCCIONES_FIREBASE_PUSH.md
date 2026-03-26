# 🔔 GUÍA DE CONFIGURACIÓN: Notificaciones Push en Tiempo Real

## ✅ IMPLEMENTACIÓN COMPLETADA

Se han realizado los siguientes cambios en tu proyecto:

### 📁 Archivos Modificados/Creados:

1. **`sw.js`** ✏️ Modificado
   - Agregado soporte para notificaciones push
   - Listener `keepAlive` para evitar cierre automático
   - Manejo de clicks en notificaciones
   - Cache actualizado a v4

2. **`manifest.json`** ✏️ Modificado
   - `orientation: "any"` para evitar recargas
   - Agregado shortcut al Panel Admin
   - Mejoras de estabilidad PWA

3. **`firebase-messaging-sw.js`** ➕ Creado
   - Service Worker específico para Firebase
   - Maneja notificaciones en segundo plano

4. **`admin.html`** ✏️ Modificado
   - Integración completa de Firebase SDK
   - Función `subscribeToPushNotifications()`
   - Wake Lock API para mantener app activa
   - Botón "Activar Notificaciones en Tiempo Real"

---

## 🚀 PASOS PARA ACTIVAR LAS NOTIFICACIONES

### PASO 1: Crear Proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Click en **"Agregar proyecto"**
3. Nombre del proyecto: `filtro-vehicular` (o el que prefieras)
4. Deshabilita Google Analytics (opcional)
5. Click en **"Crear proyecto"**

---

### PASO 2: Configurar Cloud Messaging

1. En el panel de Firebase, ve a **"Project Settings"** (⚙️ arriba a la izquierda)
2. En la pestaña **"General"**, baja hasta **"Tus apps"**
3. Click en el ícono **Web** (`</>`)
4. Nombre de la app: `Filtro Vehicular Admin`
5. **NO** marcar "Firebase Hosting"
6. Click en **"Registrar app"**
7. **COPIA** el objeto `firebaseConfig` que aparece:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "filtro-vehicular.firebaseapp.com",
  projectId: "filtro-vehicular",
  storageBucket: "filtro-vehicular.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

8. Ve a la pestaña **"Cloud Messaging"**
9. En **"Web Push certificates"**, click en **"Generate key pair"**
10. **COPIA** la clave VAPID generada (ejemplo: `BNdXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`)

---

### PASO 3: Actualizar Archivos con las Credenciales de Firebase

#### A) Editar `firebase-messaging-sw.js`

Abre el archivo y reemplaza:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",           // ← Pega tu apiKey
    authDomain: "TU_PROJECT_ID.firebaseapp.com",  // ← Pega tu authDomain
    projectId: "TU_PROJECT_ID",          // ← Pega tu projectId
    storageBucket: "TU_PROJECT_ID.appspot.com",   // ← Pega tu storageBucket
    messagingSenderId: "TU_SENDER_ID",   // ← Pega tu messagingSenderId
    appId: "TU_APP_ID"                   // ← Pega tu appId
};
```

#### B) Editar `admin.html`

Busca la línea **2978** (sección Firebase Cloud Messaging) y reemplaza:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",           // ← Pega tu apiKey
    authDomain: "TU_PROJECT_ID.firebaseapp.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_PROJECT_ID.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
};
```

Busca la línea **3013** y reemplaza:

```javascript
vapidKey: 'TU_VAPID_KEY_AQUI',  // ← Pega tu clave VAPID (Web Push certificate)
```

---

### PASO 4: Crear Tabla en Supabase

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **SQL Editor**
4. Ejecuta este SQL:

```sql
-- Tabla para almacenar tokens de notificaciones push
CREATE TABLE IF NOT EXISTS admin_push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  device_type TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas rápidas
CREATE INDEX idx_admin_push_tokens_token ON admin_push_tokens(token);
```

---

### PASO 5: Probar las Notificaciones

1. **Sube los archivos** a tu servidor web
2. Abre el **Panel Admin** en tu celular
3. Click en el botón **"🔔 Activar Notificaciones en Tiempo Real"**
4. Acepta los permisos cuando el navegador lo solicite
5. Deberías ver: **"✅ Notificaciones push activadas correctamente"**

---

## 📱 CÓMO FUNCIONA

### Cuando la app está ABIERTA:
- Las notificaciones se muestran directamente en pantalla
- Se ejecuta el código en `admin.html` (línea 3058)

### Cuando la app está CERRADA:
- Firebase envía la notificación al dispositivo
- El Service Worker (`firebase-messaging-sw.js`) la recibe
- Se muestra como notificación del sistema operativo
- Al hacer click, abre el Panel Admin

---

## 🔧 ENVIAR NOTIFICACIONES DESDE EL BACKEND

### Opción 1: Desde Supabase Edge Function (Recomendado)

Crea una Edge Function que se dispare automáticamente cuando hay eventos:

```typescript
// supabase/functions/send-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { type, data } = await req.json()
  
  // Obtener tokens de la base de datos
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const response = await fetch(`${supabaseUrl}/rest/v1/admin_push_tokens?select=token`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  })
  
  const tokens = await response.json()
  
  // Enviar notificación a Firebase
  const firebaseServerKey = Deno.env.get('FIREBASE_SERVER_KEY')!
  
  for (const { token } of tokens) {
    await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${firebaseServerKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title: type === 'new_user' ? '🎉 Nuevo Usuario' : '💰 Nuevo Pago',
          body: `${data.nombre || data.email} - ${data.placa || ''}`,
          icon: '/assets/media/logopwa.png',
          click_action: 'https://tudominio.com/admin.html'
        },
        data: {
          type,
          url: '/admin.html'
        }
      })
    })
  }
  
  return new Response(JSON.stringify({ success: true }))
})
```

### Opción 2: Desde un Script PHP/Node.js

```javascript
// Ejemplo en Node.js
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert('path/to/serviceAccountKey.json')
});

async function sendNotification(token, title, body) {
  const message = {
    notification: { title, body },
    token: token
  };
  
  await admin.messaging().send(message);
}
```

---

## 🔑 OBTENER SERVER KEY DE FIREBASE

1. En Firebase Console, ve a **Project Settings** → **Cloud Messaging**
2. Copia el **"Server key"** (empieza con `AAAA...`)
3. Guárdalo como variable de entorno en Supabase:
   - Ve a **Project Settings** → **Edge Functions**
   - Agrega: `FIREBASE_SERVER_KEY = tu_server_key_aqui`

---

## ✅ SOLUCIÓN AL PROBLEMA DE CIERRE AUTOMÁTICO

La app ya NO se cerrará automáticamente gracias a:

1. **Wake Lock API** - Mantiene la pantalla activa
2. **Keep Alive Ping** - Envía señal cada 30 segundos al Service Worker
3. **Prevent Suspend** - Operación mínima cada 60 segundos
4. **Service Worker persistente** - Escucha eventos en segundo plano

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### "No se pueden registrar notificaciones"
- Verifica que estés usando **HTTPS** (no HTTP)
- En localhost, usa `http://localhost` (permitido para desarrollo)

### "Token no se guarda en Supabase"
- Verifica que la tabla `admin_push_tokens` exista
- Revisa la consola del navegador (F12) para errores

### "Notificaciones no llegan cuando la app está cerrada"
- Verifica que `firebase-messaging-sw.js` esté en la raíz del proyecto
- Asegúrate de que las credenciales de Firebase sean correctas

### "La app sigue cerrándose en el celular"
- Algunos navegadores móviles tienen restricciones agresivas
- Usa Chrome o Edge en Android para mejores resultados
- En iOS, agrega la app a la pantalla de inicio (PWA)

---

## 📞 PRÓXIMOS PASOS

1. ✅ Configura Firebase (Pasos 1-3)
2. ✅ Crea la tabla en Supabase (Paso 4)
3. ✅ Prueba las notificaciones (Paso 5)
4. ⚠️ Configura el backend para enviar notificaciones automáticas
5. ⚠️ Opcional: Configura Database Webhooks en Supabase

---

## 📝 NOTAS IMPORTANTES

- Las notificaciones push **requieren HTTPS** en producción
- El usuario debe **aceptar permisos** la primera vez
- Los tokens pueden expirar, se renuevan automáticamente
- Firebase tiene un límite gratuito de **10 millones de mensajes/mes**

---

**¿Necesitas ayuda?** Revisa la consola del navegador (F12) para ver logs detallados.
