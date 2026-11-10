# FV+ maintenance server guard

## Goal

Make the administrator's existing maintenance switch stop non-admin consultations in the browser and at every server entry point, while allowing administrators to keep working. Do not activate maintenance in production as part of verification.

## Current behavior

- The public `get_maintenance()` RPC works and currently reports maintenance disabled.
- `admin.html` and `js/admin/maintenance.js` read and write the shared flag in `app_settings` through `get_maintenance()` and `set_maintenance()`.
- `js/modules/maintenance.js` displays a full-screen notice for authenticated non-admin users, displays a banner for admins, and polls every 60 seconds.
- `bridge-proxy` currently authenticates the user and validates a paid consultation but does not check the maintenance flag. `consume_credits` can reserve credits while maintenance is active. The exposed `consultar-docs` Edge Function also calls its external provider without checking maintenance.

## Design

Keep the current administrator controls and client overlay. Enforce the same shared flag in the server paths:

1. Update `consume_credits` so non-admin users cannot create a consultation reservation while maintenance is enabled. Reject before deducting credits or inserting a consultation. Administrators retain the current zero-cost path.
2. Update `bridge_claim_consulta` to recheck maintenance in the same database transaction before changing a reservation to `in_flight`. This closes the race between reserving credits and sending the consultation. Map this condition to an explicit maintenance response in `bridge-proxy`.
3. Update `bridge-proxy` to reject non-admin query and callback requests when maintenance is active. If a query already has a pending reservation, settle it as an unsuccessful consultation so its credits are returned. Do not call the Telegram bridge.
4. Update `consultar-docs` to reject non-admin requests before calling the external provider. Keep the maintenance check shared with the other consultation paths.
5. Make the browser show a clear maintenance message for requests already in progress when the switch changes. Existing polls, visibility refresh, retry control, and admin banner remain.

If the maintenance flag cannot be read, reject non-admin consultation traffic with a temporary-unavailable response rather than silently opening the service. Existing requests that reached the bridge before maintenance was committed may finish; new requests are denied. Administrators continue through the existing `profiles.is_admin` role.

## Failure and billing behavior

- A reservation rejected by `consume_credits` is never charged.
- A pending reservation rejected by `bridge-proxy` is settled through the server refund function before returning the maintenance response.
- A reservation already claimed before the maintenance change follows the existing server settlement path.
- Do not change unrelated payment, catalog, bridge-session, or VeriNexo behavior.

## Verification

- Exercise the admin control and client overlay with isolated mocked states for off/on, admin/non-admin, message updates, and failed RPCs.
- Verify the deployed read RPC remains available and returns the live flag without changing it.
- Verify server guards deny non-admin query, callback, credit-reservation, and free-docs paths while the flag is on, and preserve admin behavior.
- Verify the switch remains off after release. Do not briefly turn it on in production; that would block active users.

## Release order

Apply the SQL migration first, deploy the `bridge-proxy` and `consultar-docs` functions, then publish the frontend cache-version changes. Keep production maintenance disabled throughout.
