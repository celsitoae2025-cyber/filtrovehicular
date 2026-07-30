# Supabase — Filtro Vehicular+

SQL versionado del proyecto. Cada subcarpeta agrupa archivos por dominio. Los SQL se ejecutan **manualmente** desde **Supabase → SQL Editor**; no hay un sistema de migraciones automático.

Todos los scripts están escritos para ser **idempotentes** (usan `if not exists`, `create or replace`, `on conflict do nothing`, etc.) — se pueden volver a ejecutar sin romper nada.

## Estructura

```
supabase/
├── schema/          Schema base: tablas, RLS core, RPC principales
├── anti_abuse/      Trigger anti-abuso de signup + restricción de welcome
├── admin/           Funciones / RLS / tablas exclusivas del panel admin
├── seeds/           Catálogos y datos iniciales (consultas, planes, fuentes)
├── fixes/           Parches puntuales aplicados a tablas existentes
├── functions/       Edge Functions (TypeScript / Deno) desplegadas
└── email-templates/ Plantillas HTML para correos transaccionales (Brevo)
```

## Orden de ejecución en una BD limpia

```
1. schema/00_schema_inicial.sql
2. schema/01_payments_schema.sql
3. schema/transactions_rls.sql
4. schema/notifications.sql
5. schema/increment_credits.sql
6. schema/gating_consultas_premium.sql
7. schema/free_queries.sql
8. anti_abuse/anti_abuse_signup.sql
9. anti_abuse/welcome_restriction.sql
10. anti_abuse/welcome_restriction_fix.sql
11. anti_abuse/anti_abuse_views_security_fix.sql
12. admin/admin_rls.sql
13. admin/admin_audit.sql
14. admin/admin_team.sql
15. admin/admin_sales_tracking.sql
16. admin/admin_grant_subscription.sql
17. admin/admin_broadcast_notification.sql
18. admin/admin_list_user_transactions.sql
19. admin/admin_list_users_fix.sql
20. admin/admin_delete_user.sql
21. admin/admin_delete_users.sql
22. admin/admin_delete_unconfirmed.sql
23. seeds/consultas_catalog.sql
24. seeds/seed_fuentesdata.sql
25. seeds/seed_filter_v2.sql
26. seeds/seed_lplaca.sql
27. seeds/seed_all_missing.sql
28. seeds/premium_catalog_template.sql
29. seeds/premium_catalog_seed.sql
30. fixes/*  (solo si la BD no tenía estos parches ya aplicados)
```

> Para detalles de qué hace cada archivo, ver el `INDEX.md` dentro de cada subcarpeta.

## Edge Functions

Las funciones en `functions/` se despliegan con:

```bash
supabase functions deploy <nombre>
```

| Función | Propósito |
|---|---|
| `bridge-proxy` | Proxy que valida sesión y llama al bridge de Telegram con la API key del lado servidor (evita exponer la key en el cliente) |
| `consultar-docs` | Endpoint de consulta documental (Reniec, Sunarp, etc.) |
| `crear-preferencia` | Crea preference de Mercado Pago para checkout |
| `webhook-mercadopago` | Webhook que recibe notificaciones de MP y acredita créditos |
| `diagnose-payment` | Diagnóstico de pagos (debug / soporte) |
| `_shared/plans.ts` | Catálogo de planes compartido entre `crear-preferencia` y `webhook-mercadopago`. **Debe coincidir 1:1 con `js/shared/plans-data.js`** |

## Email templates

Las plantillas HTML en `email-templates/` se copian/pegan manualmente en:
**Supabase → Auth → Email Templates**

| Plantilla | Asunto |
|---|---|
| `confirm-signup.html` | Confirmar correo al registrarse |
| `magic-link.html` | Link mágico de inicio de sesión |
| `reset-password.html` | Recuperación de contraseña |
