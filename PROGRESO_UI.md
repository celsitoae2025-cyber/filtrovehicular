# PROGRESO DE TRABAJO - Filtro Vehicular UI/UX
**Última actualización:** 25 de Marzo, 2026

---

## OBJETIVO
Refinar la interfaz de usuario de la pasarela de pago y el sistema de notificaciones con colores institucionales, diseño limpio y profesional.

---

## COLORES INSTITUCIONALES
| Color | Código | Uso |
|-------|--------|-----|
| Azul oscuro | `#0d2536` | Principal, botones, textos |
| Verde | `#8bc34a` | Acentos, acciones secundarias |
| Naranja | `#f59e0b` | Estados pendientes |
| Blanco | `#ffffff` | Fondos |
| Gris borde | `#e2e8f0` | Bordes de elementos |
| Gris texto | `#64748b`, `#94a3b8` | Textos secundarios |

---

## ARCHIVOS MODIFICADOS
- `index.html` — Archivo principal (la mayoría de cambios)
- `assets/js/auth.js` — Menú hamburguesa y notificaciones

---

## CAMBIOS REALIZADOS

### 1. PASARELA DE PAGO (`#modalSale`)
**Diseño final aprobado:**
- Fondo overlay: `rgba(13, 37, 54, 0.75)` — semitransparente (se ve header/footer detrás)
- Tarjeta: fondo blanco, borde `2px solid #e2e8f0`, max-width 360px, padding 22px
- Botón cerrar (X): **fuera** del cuadro, `top: -40px`, blanco semitransparente sobre el overlay

**Estructura interna:**
```
[X] ← Fuera del cuadro, arriba a la derecha
┌──────────────────────────────┐
│ 🚗 PLACA        TOTAL        │
│    ABC-123      S/ 20        │
│──────────────────────────────│
│ [ Yape ]    [ Plin ]        │
│        ┌──────────┐          │
│        │  QR Code │          │
│        └──────────┘          │
│ ① Escanea el QR             │
│ ② Sube la captura           │
│ ┌──────────────────────────┐ │
│ │   SUBIR COMPROBANTE      │ │  ← Azul oscuro #0d2536
│ └──────────────────────────┘ │
│        VOLVER ATRÁS          │
└──────────────────────────────┘
```

**Regla importante:** La placa se obtiene de `localStorage.getItem('temp_informe_placa')` cuando `type='filtro'` en la función `openSale()`.

---

### 2. MODAL DE CONFIRMACIÓN (después de subir comprobante)
- **Título:** "Comprobante en validación" ← (NO "Pago recibido correctamente", eso era incorrecto)
- **Ícono:** Reloj naranja `fa-clock` (indica pendiente, no confirmado)
- **Mensaje:** "Tu comprobante está en proceso de validación"
- **Flujo:** Pasarela se cierra primero (`closeSale()`), luego 800ms después aparece este modal

---

### 3. MODAL DE SERVICIOS INDIVIDUALES (`#infoModal`)
Al dar clic en cualquiera de los 22 cuadros de servicios:
- Sin sombras (`box-shadow` eliminado)
- Borde `2px solid #e2e8f0`
- Botón **"CONSULTAR AHORA"**: Azul oscuro `#0d2536` (antes verde)

---

### 4. SISTEMA DE NOTIFICACIONES
**Comportamiento esperado:**
- NO aparece nada en la pantalla principal
- Solo aparece en el menú hamburguesa:
  - Badge rojo `!` sobre el ícono de hamburguesa
  - "Mis Consultas" parpadea con fondo azul claro

**Implementación:**
- `showPendingNotificationBadge()` guarda `has_pending_notification = 'true'` en localStorage
- Al cargar la página, si hay notificación pendiente → aplica badge y parpadeo (500ms delay)
- Al ir a "Mis Consultas" → `panel_cliente.html`
- Elemento `id="misConsultasLink"` en `assets/js/auth.js` (línea ~296)

**Para limpiar la notificación** (cuando el usuario ya vio sus consultas):
```javascript
localStorage.removeItem('has_pending_notification');
```

---

### 5. BOTÓN PRINCIPAL "FILTRO COMPLETO"
- Texto: "FILTRO COMPLETO" + ícono `fa-plus`
- Color: Verde institucional `#8bc34a`

---

### 6. ELIMINACIÓN DE EMOJIS
**Regla:** No usar emojis en ningún lugar del código. Solo íconos de Font Awesome.
- ✅ → eliminado o reemplazado por `fa-circle-check`
- 🎉 → eliminado
- ✓ → `<i class="fa-solid fa-check"></i>`

---

### 7. PRINCIPIOS DE DISEÑO APLICADOS
1. **Sin sombras** — `box-shadow: none` en toda la UI de pago
2. **Fondo claro** — Usar `#ffffff` o `#f8fafc` para fondos de modales
3. **Sin gradientes** en botones principales
4. **Sin emojis** — Solo Font Awesome icons
5. **Colores institucionales** consistentes en toda la UI
6. **Overlay semitransparente** — Se debe ver el header/footer detrás

---

## FUNCIONES CLAVE EN index.html

| Función | Descripción |
|---------|-------------|
| `openSale(amount, concept, credits, type)` | Abre la pasarela de pago |
| `closeSale()` | Cierra la pasarela |
| `showPendingNotificationBadge()` | Muestra badge rojo + parpadeo en menú |
| `handleVoucherUpload(event)` | Procesa la subida del comprobante |
| `submitInformeRequest()` | Inicia el flujo de consulta de filtro completo |
| `startSmartScan(placa)` | Valida créditos y abre pasarela si es necesario |
| `checkPendingFlow()` | Verifica si hay solicitudes pendientes |

---

## NOTAS IMPORTANTES
- El botón "ENVIADO CON ÉXITO" fue **eliminado** (causaba confusión visual como estado intermedio)
- El div `#pendingStatus` ("PLACA PENDIENTE") fue **eliminado** de la pantalla principal
- El fondo del modal **DEBE** ser semitransparente para que se vea el header y footer
- El botón X de cerrar **DEBE** estar fuera del cuadro blanco (`top: -40px`)
- La placa en la pasarela se toma de `localStorage` → `temp_informe_placa`
