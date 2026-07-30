# anti_abuse/ — Anti-abuso de signup + restricción de welcome

Bloquea/penaliza cuentas duplicadas y limita dónde pueden gastarse los 5 créditos de bienvenida.

## Orden de ejecución

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `anti_abuse_signup.sql` | Reemplaza el trigger `handle_new_user` con una versión que detecta: **(a)** correo descartable (lista en tabla `disposable_email_domains`), **(b)** `email_normalized` duplicado (gmail+alias/puntos), **(c)** `device_fingerprint` duplicado. Cuando detecta abuso → otorga **0 créditos** en vez de 5 y marca `signup_block_reason`. Crea las vistas admin `admin_v_duplicate_devices` y `admin_v_duplicate_emails`. |
| 2 | `welcome_restriction.sql` | Restringe que los 5 créditos de bienvenida solo se puedan usar en consultas marcadas como "free" (ver `schema/free_queries.sql`). El resto del catálogo se desbloquea con la primera recarga. |
| 3 | `welcome_restriction_fix.sql` | Parche posterior al `welcome_restriction.sql` original (corrige edge cases). |
| 4 | `anti_abuse_views_security_fix.sql` | Refuerza la seguridad de las vistas `admin_v_*` con `security_invoker = true` para evitar leaks. |

## Cómo se enlaza con el cliente

El frontend en `js/shared/auth.js` lee el `device_fingerprint` con FingerprintJS (`js/shared/device-fingerprint.js`) y lo manda como `user_metadata` en el `signUp` → el trigger lo recibe y aplica las reglas.

## Validación en cliente (UX rápida)

`js/shared/email-validator.js` tiene una copia corta de la lista de dominios descartables para dar feedback inmediato antes de mandar el registro. La lista autoritativa está en la tabla `disposable_email_domains`.
