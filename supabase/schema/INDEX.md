# schema/ — Schema base de Postgres

Tablas, políticas RLS, triggers y funciones RPC fundacionales. Esta carpeta es el núcleo: sin estos archivos la app no levanta.

## Orden de ejecución

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `00_schema_inicial.sql` | Crea `profiles`, `transactions`, `consultas` con RLS. Trigger `handle_new_user` que da **5 créditos de bienvenida** al registrarse. Funciones RPC `admin_adjust_credits` y `consume_credits`. |
| 2 | `01_payments_schema.sql` | Crea `payments_mp` (historial e idempotencia de pagos Mercado Pago) con RLS por user_id. |
| 3 | `transactions_rls.sql` | Refuerzos de RLS sobre la tabla `transactions`. |
| 4 | `notifications.sql` | Tabla `notifications` (campana del topbar) + RLS + trigger automático. |
| 5 | `increment_credits.sql` | RPC `increment_credits(user_id, amount)` usado por la edge function de MP para acreditar pagos atómicamente. |
| 6 | `gating_consultas_premium.sql` | Funciones de gating: limita acceso a consultas premium según el `subscription_tier` del perfil. |
| 7 | `free_queries.sql` | Marca qué consultas son "gratuitas" (consumibles con los 5 créditos de bienvenida) — usado por `welcome_restriction`. |

## Idempotencia

Todos los archivos son seguros de re-ejecutar: usan `if not exists` para tablas, `create or replace` para funciones, y `drop policy if exists` antes de `create policy`.
