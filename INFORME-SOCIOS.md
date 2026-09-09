# Informe — Sistema de socios (distribuidores)

Revisión del 2026-09-09. Se leyó el código real y se comprobó la base de
producción, no el papel.

---

## 1. Qué ya está construido y funcionando

El sistema de socios **existe y está desplegado**. No hay que implementarlo.

**Base de datos** — `supabase/migrations/20260817190000_socios.sql`, aplicada
en producción (comprobado con `supabase migration list`: la marca
`20260817190000` figura tanto en local como en remoto).

Trae dos campos nuevos en `profiles`:

- `is_socio` — marca de distribuidor.
- `socio_id` — a qué socio pertenece cada cliente. Vacío = cliente directo tuyo.

Y siete funciones de servidor. Lo importante es que **todo el permiso lo decide
la base de datos, no la página**: aunque alguien abriera el panel con la sesión
de otro, no vería un solo dato ajeno.

**Pantalla del socio** — `socio.html` + `js/socio/`. Página aparte del panel de
administrador a propósito: aquí no existen ni ingresos, ni costos, ni usuarios
de otros. Tiene tres vistas: Resumen (saldo, número de clientes, entregado del
mes y total), Mis clientes (buscar por correo y entregar) y Entregas (historial).

**Pantalla del administrador** — sección Socios en `admin.html` +
`js/admin/socios.js`. Nombra socio a una cuenta ya registrada, le carga créditos
al por mayor y muestra cómo va cada uno.

**Protecciones que ya están puestas:**

- El socio solo puede mover créditos de su propio saldo. Si intenta entregar más
  de lo que tiene, la base lo rechaza con su saldo real en el mensaje.
- El descuento al socio y el abono al cliente ocurren en una sola operación: o
  pasan las dos cosas o ninguna. No existe el caso de "se descontó pero no llegó".
- Dos entregas simultáneas no pueden trabarse entre sí (se bloquean los saldos
  siempre en el mismo orden).
- Nadie se hace socio a sí mismo ni se cambia de socio: hay un guardia en la base
  que lo impide incluso llamando a la API a mano.
- Un socio no puede robarle un cliente a otro socio, ni tocar cuentas de
  administrador o de otros socios.
- Cada entrega deja dos apuntes en el historial: el que le suma al cliente y el
  que le resta al socio.

---

## 2. Los tres agujeros reales

### 2.1 Un socio puede quedarse con tus clientes directos

**Gravedad: alta.** Es lo más urgente del informe.

La función que busca clientes (`socio_buscar_usuario`) marca como *disponible* a
cualquier cuenta que no sea de administrador, ni de otro socio, ni de él mismo.
Ahí entran **todos tus clientes directos**, los que tú conseguiste y que te pagan
a ti por Mercado Pago.

En la práctica: si el socio conoce el correo de un cliente tuyo, le transfiere
1 crédito y ese cliente queda marcado como suyo **para siempre**. A partir de ahí
figura en su cartera y cuenta como venta suya.

**Corrección:** que el socio solo pueda tomar cuentas sin dueño **y sin
historial de compra** — es decir, recién registradas o que nunca te hayan pagado.
Un cliente que ya te compró a ti no puede ser reclamado por nadie.

### 2.2 No se puede deshacer un socio

**Gravedad: media.** Es un callejón sin salida.

Para quitarle el cargo a un socio, la base exige que antes reasignes a sus
clientes. Pero **no existe ninguna función para reasignar clientes**, ni en el
panel ni en la base. Resultado: en cuanto un socio entregue su primer crédito, ya
no podrás quitarle el cargo nunca, por más que se pelee contigo o desaparezca.

**Corrección:** una función de administrador que libere o reasigne los clientes
de un socio, y un botón en la sección Socios.

### 2.3 El socio se come su propia mercadería

**Gravedad: media.** Es exactamente lo que tú querías evitar.

Tú pediste que el socio tenga consultas ilimitadas para su uso personal, pero que
eso no toque la bolsa que revende. Hoy **no es así**: el acceso ilimitado está
atado únicamente a `is_admin`. El socio consume de la misma bolsa de 5000, así
que cada consulta que hace para sí mismo es un crédito que deja de vender.

**Corrección:** una bandera aparte en su perfil que la función de cobro revise
antes de descontar. No es un saldo, es un permiso: no hay nada que pueda
transferir.

---

## 3. Lo que hablamos y todavía no existe

| Lo que pediste | Estado |
|---|---|
| Panel propio del socio | **Hecho** |
| Bolsa de créditos que solo él transfiere | **Hecho** |
| Registro de a qué cliente le vendió y cuánto | **Hecho** |
| Ilimitado personal para el socio | Falta (punto 2.3) |
| Aviso a tu Telegram en cada venta | Falta — no hay nada de Telegram en la app |
| Link de referido (`?ref=CODIGO`) | Falta — hoy el cliente se ata al socio recién cuando recibe su primer crédito |
| Solicitar planes por días (90 días / S/250) | Falta — el socio tendría que avisarte por fuera |
| Comisión automática por pagos de Mercado Pago | Falta, y quedó decidido que no hace falta: el socio compra por adelantado y cobra por su cuenta |

---

## 4. Sobre el dinero

Con el modelo que quedó, **Mercado Pago no interviene** en las ventas del socio:
él te paga a ti por adelantado los 5000 créditos y les cobra a sus clientes por
su cuenta. No hay comisión de pasarela que repartir ni liquidaciones pendientes.

Si algún cliente suyo igual recarga por la web, ese dinero es tuyo y su bolsa no
se toca. Si algún día quieres darle comisión por esos casos, la regla justa es
repartir **el neto**: primero se descuenta lo que cobra Mercado Pago y el 50%
sale de lo que quedó. Nunca sobre el bruto, porque en esa venta ganarías menos
que él.

---

## 5. Cómo probarlo hoy mismo

1. Registra dos cuentas nuevas en la app: una será el socio, otra el cliente.
2. Entra a `admin.html` → Socios, busca el correo del socio, nómbralo y cárgale
   100 créditos.
3. Entra a `socio.html` con la cuenta del socio, busca el correo del cliente y
   entrégale 20.
4. Entra con el cliente y haz una consulta: debe descontar de esos 20.

---

## 6. Orden recomendado de trabajo

1. Cerrar el agujero de los clientes directos (2.1).
2. Poder deshacer un socio (2.2).
3. Ilimitado personal del socio (2.3).
4. Avisos a Telegram.
5. Link de referido.
6. Solicitud de planes por días.
