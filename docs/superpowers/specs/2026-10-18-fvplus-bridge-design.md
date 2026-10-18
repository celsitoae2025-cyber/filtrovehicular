# FV+ Telegram bridge repair

## Goal

Restore the production path from the FV+ web platform to the Telegram data bots. Keep FV+ on a dedicated bridge so its bot identifiers, credentials, and traffic do not depend on VeriNexo's bridge.

## Current findings

- The FV+ frontend posts consultations to Supabase Edge Function `bridge-proxy`.
- `bridge-proxy` is active and has `FV_BRIDGE_URL` and `FV_BRIDGE_API_KEY` configured.
- The public FV+ catalog uses bot IDs served by the `filtro-bridge` source in this workspace.
- The old `filtro-bridge.fly.dev` host does not return an HTTP response. Fly currently lists `verinexo-bridge`, whose source and protocol are for a separate service.
- `filtro-bridge/secrets.js` is tracked and contains credentials that must be treated as compromised.

## Design

Deploy the existing `filtro-bridge` repository as its own Fly application. The preferred name `filtro-bridge` is reserved, so the dedicated app is named `filtrovehicular-bridge`. Keep the web frontend and `bridge-proxy` request contract unchanged. Reuse the current Telegram API credentials, Telegram session, and bridge API key as requested. Set only `FV_BRIDGE_URL` in Supabase to the dedicated Fly hostname after the new service is healthy.

Remove the tracked secret fallback from the bridge source and load Telegram credentials only from environment variables. Transfer the existing values from the prior local credential source directly into ignored local `.env` and Fly secrets without displaying them. Do not log out, revoke, or rotate any existing key or Telegram credential. Leave `verinexo-bridge` and its configuration untouched.

The request path remains:

`FV+ page -> Supabase bridge-proxy (auth and credit reservation) -> dedicated filtro-bridge -> Telegram bot -> bridge-proxy -> FV+ result`

## Failure handling

The existing bridge-proxy remains responsible for rejecting unauthenticated users, validating a reserved consultation, and refunding a reservation when the bridge is unavailable or returns no result. The bridge should report readiness only when its Telegram account is connected. Do not expose secret values in logs or client responses.

## Verification and completion

1. Confirm the deployed bridge health and readiness endpoints report Telegram connected.
2. Confirm the bridge bot list covers the active bot IDs in the FV+ catalog.
3. Confirm Supabase has both bridge secrets set, without printing their values; update only `FV_BRIDGE_URL`.
4. Send one controlled end-to-end FV+ query and confirm the result reaches the page; verify the credit outcome for both success and a no-result/error response.
5. Confirm neither production requests nor configuration were redirected through `verinexo-bridge`.

## Scope

Included: dedicated bridge deployment, removal of tracked secret fallbacks, reuse of current credentials, Supabase bridge URL update, and focused verification.

Excluded: changes to catalog entries, consultation pricing, credit reservation logic, result rendering, or VeriNexo's bridge.
