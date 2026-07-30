# fixes/ — Parches puntuales

Cambios menores aplicados sobre tablas ya existentes: agregar columnas, recategorizar registros, ajustar permisos puntuales. Cada uno resuelve una situación específica que ya ocurrió en producción.

> ⚠️ A diferencia de `schema/`, estos archivos **NO necesitan re-ejecutarse en una BD limpia** si ya están reflejados en los archivos de `schema/`. Pero todos son idempotentes, así que correrlos no rompe nada.

## Archivos

| Archivo | Qué arregla |
|---|---|
| `add_reniec_missing.sql` | Inserta las consultas Reniec que faltaban en el catálogo. |
| `add_subcategoria_column.sql` | `ALTER TABLE consultas_catalog ADD COLUMN subcategoria` — permitió agrupar dentro de cada categoría. |
| `fix_facial_categoria.sql` | Recategoriza las consultas de reconocimiento facial bajo la categoría `facial`. |
| `fix_credits_free_all_categories.sql` | Marca como `is_free = true` todas las consultas básicas para que se puedan usar con los 5 créditos de bienvenida. |
| `fix_increment_credits_grant.sql` | Otorga permisos `GRANT EXECUTE` a la función `increment_credits` para el rol `service_role` (la usa el webhook MP). |
| `fix_profile_trigger_internal_bypass.sql` | Modifica `enforce_profile_update` para permitir que procesos internos (sin JWT) editen campos restringidos — fix para que el webhook MP pueda acreditar créditos. |
| `fixes_2026_04.sql` | Bundle de pequeños fixes aplicados en abril 2026 (ver comentarios dentro del archivo). |

## ¿Y si encuentro otro bug?

Si el fix es chico y puntual → crear un nuevo archivo aquí con prefijo `fix_<dominio>.sql`. Si el fix es estructural (cambia el schema base) → integrarlo al archivo correspondiente de `schema/` para que una BD limpia salga correcta sin tener que aplicar parches.
