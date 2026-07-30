# seeds/ — Catálogos y datos iniciales

Datos que pueblan tablas de configuración (catálogo de consultas disponibles, fuentes de datos, planes premium, etc.). Son `insert ... on conflict do nothing` → seguros de re-ejecutar.

## Archivos

| Archivo | Tabla destino | Qué siembra |
|---|---|---|
| `consultas_catalog.sql` | `consultas_catalog` | Catálogo maestro de cada tipo de consulta disponible (id, nombre, costo en créditos, categoría, fuente, descripción). Es la fuente de verdad para los combos de cada vista. |
| `seed_fuentesdata.sql` | `fuentesdata` | Catálogo de "fuentes" mapeado al bot @Fuentesdata_bot (id de comando, slug, etc.). |
| `seed_filter_v2.sql` | `consultas_catalog` | Seed específico de las consultas que aparecen en la vista **Filtrar** (vista principal). |
| `seed_lplaca.sql` | `consultas_catalog` | Seed para la consulta "lookup por placa". |
| `seed_all_missing.sql` | `consultas_catalog` | Re-inserta cualquier consulta del catálogo que se haya perdido (usado tras refactors). |
| `premium_catalog_template.sql` | `consultas_catalog` | Plantilla base de las consultas premium (las que requieren plan Profesional Plus / Business). |
| `premium_catalog_seed.sql` | `consultas_catalog` | Datos finales del catálogo premium ya curado. |

## Orden recomendado

1. `consultas_catalog.sql` (estructura)
2. `seed_fuentesdata.sql`
3. `seed_filter_v2.sql`, `seed_lplaca.sql`, `seed_all_missing.sql` (consultas base)
4. `premium_catalog_template.sql` → `premium_catalog_seed.sql` (premium)

## Mantenimiento

Si agregas nuevas consultas al sidebar (`app.html` → `nav-category`), también necesitan estar en `consultas_catalog`. El panel admin (`js/admin/consultas.js`) lee y permite editar este catálogo en runtime.
