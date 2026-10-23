# FV+ Telegram bridge session repair

## Goal

Restore FV+ consultations after Telegram began rejecting the bridge session with `AUTH_KEY_DUPLICATED`. Keep FV+ on its dedicated bridge so its bot identifiers, credentials, and traffic do not depend on VeriNexo's bridge.

## Current findings

- The FV+ frontend posts consultations to Supabase Edge Function `bridge-proxy`.
- `bridge-proxy` is active and has `FV_BRIDGE_URL` and `FV_BRIDGE_API_KEY` configured.
- The public FV+ catalog uses bot IDs served by the `filtro-bridge` source in this workspace.
- The dedicated app is `filtrovehicular-bridge.fly.dev`; `/health`, `/ready`, and authenticated `/bots` return HTTP 200, and all five configured bot IDs are present.
- Supabase `bridge-proxy` is active and has `FV_BRIDGE_URL` and `FV_BRIDGE_API_KEY` set.
- Production bridge logs show Telegram RPC error `406: AUTH_KEY_DUPLICATED` during `contacts.ResolveUsername`, including a request for `ghostdataxxx`. The process can still report connected while a consultation RPC fails.
- The current Fly deployment has one machine. No local `filtro-bridge` Node process is running.

## Design

Keep the existing `filtrovehicular-bridge` deployment and web-to-Supabase request contract. Create a fresh Telegram login session for the FV+ bridge account and use it exclusively in this dedicated Fly app. Save the session only in the ignored local `filtro-bridge/.env` during provisioning and as the Fly secret `TELEGRAM_SESSION_CUENTA1`; do not print it, commit it, or run a local bridge with it while the Fly machine is using it. Keep the bridge API key and Supabase configuration unchanged.

After the new session is installed, redeploy the dedicated Fly app so the existing machine stops using the duplicated session. Do not revoke the old Telegram session or rotate unrelated API keys. Leave `verinexo-bridge`, Supabase, the frontend, catalog, and billing configuration untouched.

The request path remains:

`FV+ page -> Supabase bridge-proxy (auth and credit reservation) -> dedicated filtro-bridge -> Telegram bot -> bridge-proxy -> FV+ result`

## Failure handling

The existing `bridge-proxy` remains responsible for authentication, paid-query validation, and settlement/refund decisions. Do not expose secret values in logs or client responses. Health and readiness alone do not prove that Telegram will accept a consultation RPC, so completion also requires checking post-deploy logs and a controlled end-to-end query.

## Verification and completion

1. Confirm the new session is present only in ignored local configuration and the Fly secret, with no secret values in output or Git.
2. Confirm the deployed bridge health and readiness endpoints report Telegram connected and `/bots` includes all active FV+ bot IDs.
3. Confirm new logs no longer show `AUTH_KEY_DUPLICATED` after a controlled query.
4. Send one controlled end-to-end FV+ query and confirm the result reaches the page and the credit outcome is correct.
5. Confirm the frontend still uses Supabase `bridge-proxy` and production remains routed to `filtrovehicular-bridge`, not `verinexo-bridge`.

## Scope

Included: provisioning an exclusive Telegram session for the existing dedicated FV+ bridge, replacing only its `TELEGRAM_SESSION_CUENTA1` Fly secret, redeployment, and focused verification.

Excluded: session revocation, rotation of unrelated credentials, Supabase or frontend changes, catalog entries, consultation pricing, credit reservation logic, result rendering, and VeriNexo's bridge.
