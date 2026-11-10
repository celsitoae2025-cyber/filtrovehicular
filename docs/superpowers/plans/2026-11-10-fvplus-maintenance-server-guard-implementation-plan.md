# FV+ maintenance server guard implementation plan

## 1. Add database enforcement

- Add an idempotent migration in `supabase/migrations/` that updates `consume_credits` and `bridge_claim_consulta` using their latest definitions.
- Check the shared `app_settings.maintenance` flag before creating or claiming a non-admin consultation. Preserve the admin bypass and existing grants.
- Confirm rejection happens before credit deduction; preserve the server refund path for pending reservations.
- Check: SQL review against the latest function definitions and isolated checks for off/on, admin/non-admin, and the reservation race.

## 2. Guard Edge Function entry points

- In `supabase/functions/bridge-proxy/index.ts`, read user status and admin role, check maintenance for query and callback, refund a pending query reservation on rejection, and return a stable 503 maintenance error.
- Map `MANTENIMIENTO_ACTIVO` from `bridge_claim_consulta` to the same response so an activation racing with a claim cannot reach Telegram.
- In `supabase/functions/consultar-docs/index.ts`, check maintenance before calling the external provider; preserve admin access.
- Check: exercise Edge Function handlers or extracted helpers with on/off, admin/non-admin, missing flag, and provider-not-called-on-rejection cases.

## 3. Align the browser response and verify the admin switch

- In `js/modules/consulta-runner.js`, preserve the server's maintenance message and existing pending-reservation cancellation behavior.
- Add focused maintenance tests using the existing Node test setup for the admin toggle state, user overlay, admin banner, and failure/fallback handling. Do not change production state during tests.
- Check: run the relevant test files and the repository test suite; confirm the live `get_maintenance()` RPC still reports disabled.

## 4. Release in dependency order

- Apply the migration to the FV+ Supabase project.
- Deploy `bridge-proxy` and `consultar-docs`.
- Bump relevant script/cache versions in `app.html`, `admin.html`, and `sw.js`, then publish the frontend through its existing deployment path.
- Check: confirm production maintenance is still disabled, Edge Functions deploy successfully, the frontend is current, and no paid consultation was sent.

## Recovery

- Keep `maintenance.enabled=false` throughout the rollout.
- If an Edge Function deploy fails, restore its prior function version; the false flag keeps the current user flow available.
- If the frontend release fails, restore the prior static release. The server guard remains inactive while the stored maintenance flag is false.
