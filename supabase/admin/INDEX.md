# admin/ — Funciones RPC, RLS y tablas del panel admin

Todo lo que el panel `/admin.html` necesita del lado servidor: políticas que permiten a un `profiles.is_admin = true` saltarse el RLS normal, funciones RPC para acciones (eliminar usuarios, regalar créditos, etc.) y tablas de soporte (auditoría, equipos, ventas).

## Archivos

| Archivo | Qué hace |
|---|---|
| `admin_rls.sql` | Políticas RLS adicionales: permite a admins leer/editar profiles, transactions, consultas, etc. de cualquier usuario. **Necesario** para que la mayoría del panel funcione. |
| `admin_audit.sql` | Tabla `admin_audit_log` + trigger que registra cada acción admin (quién, qué, cuándo, sobre quién). |
| `admin_team.sql` | Tabla `admin_team` para gestionar miembros del equipo admin con roles internos. |
| `admin_sales_tracking.sql` | Tabla `admin_sales` para registrar ventas manuales (WhatsApp, Yape) cuando el cobro no pasó por MP. |
| `admin_grant_subscription.sql` | RPC `admin_grant_subscription(user_id, tier, days)` para activar suscripciones manualmente desde el panel. |
| `admin_broadcast_notification.sql` | RPC `admin_broadcast_notification(title, message, target)` para enviar notificaciones masivas a todos / a un segmento de usuarios. |
| `admin_list_user_transactions.sql` | RPC que devuelve el historial completo de transactions de un usuario (puenteando RLS de forma controlada). |
| `admin_list_users_fix.sql` | Vista/RPC para listar usuarios en el panel con joins a `auth.users` (correo, último login). |
| `admin_delete_user.sql` | RPC `admin_delete_user(user_id)` para eliminar un usuario completo (auth + profile + datos asociados). |
| `admin_delete_users.sql` | Versión batch del anterior: elimina varios usuarios en una sola llamada. |
| `admin_delete_unconfirmed.sql` | RPC para purgar masivamente cuentas que nunca verificaron su correo. |

## Orden

`admin_rls.sql` **primero** (las demás dependen de las políticas que define). El resto puede ejecutarse en cualquier orden.

## Referencias desde el cliente

- `js/admin/users.js` usa `admin_rls.sql` (UPDATE de profiles) y `admin_delete_user.sql`
- `js/admin/broadcasts.js` usa `admin_broadcast_notification.sql`
- `js/admin/team.js`, `js/admin/audit.js`, `js/admin/recargas.js`, `js/admin/plans.js` usan el resto
