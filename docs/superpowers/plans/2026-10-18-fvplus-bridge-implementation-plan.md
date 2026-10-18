# FV+ Telegram bridge repair plan

## Task 1: Remove source-controlled credential fallbacks

- In `filtro-bridge/server.js` and `filtro-bridge/telegram-client.js`, read bridge and Telegram secrets only from environment variables. Fail clearly at startup when required values are missing.
- Remove the tracked `filtro-bridge/secrets.js` file and the unsafe `filtro-bridge/regenerate-session.js` flow that rewrites it.
- Update `filtro-bridge/login.js` to persist a newly generated Telegram session only to the ignored local `.env`, without printing the session.
- Check `git status`, ignored-file behavior, syntax, and that repository searches find no credential literals or secret-module references.

## Task 2: Transfer current Telegram credentials without rotation

- Reuse the current Telegram API ID/hash, `cuenta1` session, and bridge API key, as explicitly requested by the user.
- Transfer the existing values into the ignored local `.env` and Fly secrets without displaying them.
- Do not log out, revoke, or rotate the Telegram session or any existing key.

## Task 3: Create and deploy the dedicated Fly app

- Use the existing `filtro-bridge/fly.toml` and `filtro-bridge` source. The preferred name `filtro-bridge` was reserved, so use the created app `filtrovehicular-bridge` and record its hostname.
- Set `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION_CUENTA1`, and the current `BRIDGE_API_KEY` as Fly secrets. Do not put them in command output or source control.
- Deploy the bridge and confirm `/health`, `/ready`, and authenticated `/bots` results. The bot IDs must cover all active IDs from FV+'s `consultas_catalog`.
- If the process does not become ready, inspect only redacted deployment logs, fix the cause, and do not redirect Supabase yet.

## Task 4: Point Supabase at the FV+ app

- Set only `FV_BRIDGE_URL` in the linked Supabase project. Keep the current `FV_BRIDGE_API_KEY` unchanged.
- Confirm only variable names/status are printed. Confirm unauthenticated requests are still rejected and the deployed function remains active.
- Do not change frontend code, catalog, billing rules, or `verinexo-bridge`.

## Task 5: Verify the production path and close out

- Confirm the deployed frontend uses the existing Supabase `bridge-proxy` route and the edge function forwards to the new bridge.
- Run a controlled end-to-end consultation through the FV+ page after credentials and routing are live. Confirm the bot reply reaches the page and that credit settlement/refund behavior matches the response.
- Compare both repository statuses, commit the scoped source changes, and report Fly machine health, Supabase secret names, endpoint results, and any remaining credential-history cleanup.

## Dependencies and recovery

- Tasks 3 and 4 use the current Telegram session and bridge key from the ignored local `.env`.
- If the new app fails health checks, leave the old Supabase URL in place until the new app is ready.
- If the new app fails before routing is changed, leave Supabase untouched. If routing fails after the change, restore the prior `FV_BRIDGE_URL` while preserving the current key. `verinexo-bridge` remains untouched throughout.
