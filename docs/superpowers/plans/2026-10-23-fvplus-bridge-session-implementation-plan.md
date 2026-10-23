# FV+ bridge session isolation plan

## Goal

Replace the Telegram session used by the dedicated FV+ bridge with a fresh session used only by the Fly app, then verify the live consultation path.

## Tasks

### 1. Generate a fresh Telegram session

- Component: `filtro-bridge/login.js`, ignored local `filtro-bridge/.env`.
- Confirm the local `.env` is ignored and the required Telegram API ID/hash variable names exist without displaying values.
- Run `node login.js cuenta1` in an interactive local terminal. The user enters the account phone and Telegram/SMS code directly in that terminal; never request or log these values in chat or tool output.
- Confirm the script reports a successful login and saves `TELEGRAM_SESSION_CUENTA1` to the ignored `.env`. Do not start a local bridge with this new session.
- If login fails or the session is not saved, stop before changing Fly.

### 2. Install the session in the dedicated Fly app

- Component: Fly app `filtrovehicular-bridge`, secret `TELEGRAM_SESSION_CUENTA1`.
- Read the session from `.env` only inside a process and send it to `flyctl secrets import` over stdin as a single `NAME=VALUE` line. Do not put the value in command arguments, output, logs, or a tracked file.
- Verify the Fly response reports only the secret name and deployment status. Do not change other secrets or Supabase configuration.
- If secret import fails, keep the existing deployment running and stop; do not deploy partial configuration.
- If Fly accepts the staged secret but blocks release creation because of an account billing hold, leave the secret staged and the current machine running; resume with `flyctl secrets deploy` after the account hold is cleared. The staged secret does not affect the running machine.

### 3. Redeploy and verify bridge readiness

- Component: `filtro-bridge` deployment and Fly machine.
- Deploy the existing source to the existing Fly app. Confirm one machine is started and its health check passes.
- Check `/health`, `/ready`, and authenticated `/bots`; confirm the account is connected and all active FV+ bot IDs are returned.
- Read post-deploy logs with sensitive values redacted. Confirm no new `AUTH_KEY_DUPLICATED` error appears during verification.
- If the new deployment fails readiness, restore the prior `TELEGRAM_SESSION_CUENTA1` from a secure backup only if one is safely available; otherwise stop and report the exact recovery need without printing secrets. Do not modify Supabase or VeriNexo.
- If release creation remains blocked by the Fly account billing hold, do not attempt an alternate hosting path or change Supabase; report that payment status must be resolved before retrying the staged secret deployment.

### 4. Verify one real FV+ consultation

- Component: production FV+ page through Supabase `bridge-proxy`.
- Run one controlled query in the existing FV+ flow after bridge readiness is established. Confirm a result reaches the page, inspect the corresponding bridge log for successful Telegram resolution, and verify the credit outcome.
- If an authenticated browser session is unavailable, stop after safe bridge checks and ask the user to run one query; do not synthesize an identity or bypass paid-query validation.
- Confirm the frontend route and Supabase bridge URL still target the dedicated FV+ app and the Git worktrees remain clean.

## Acceptance criteria

- A fresh session is saved only in ignored local configuration and the Fly secret; it never appears in Git or tool output.
- The existing dedicated Fly app has exactly one running machine, `/health` and `/ready` return HTTP 200, and `/bots` contains the active FV+ bot IDs.
- A controlled query no longer produces `AUTH_KEY_DUPLICATED`, reaches the FV+ page, and settles the credit correctly.
- Supabase, the bridge API key, catalog, billing logic, frontend, old Telegram session, and VeriNexo remain unchanged.
