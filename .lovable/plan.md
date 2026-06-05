## Goal
Connect the app to the Mews **demo** environment using the public demo tokens Mews shared, and make the Demo vs Production choice a proper, reusable setting (so production works later with real tokens).

## Why a change is needed
The Mews demo tokens only work against `https://api.mews-demo.com`. Today the sync edge function always calls the production host `https://api.mews.com` and ignores the saved `base_url`. So the demo credentials would fail with an auth error until we route requests to the demo host.

## What I'll build

### 1. Mews environment selector in the config panel
`src/components/pms/PmsApiConfigPanel.tsx`
- When PMS type = Mews, show an **Environment** dropdown: `Demo` / `Production`.
- Selecting it sets `base_url`:
  - Demo → `https://api.mews-demo.com/api/connector/v1`
  - Production → `https://api.mews.com/api/connector/v1`
- Add a one-click "Load Mews demo credentials" helper that fills the Client Token + Access Token for the demo enterprise (defaulting to the **Gross / UK** set; I'll note the Net/US option too).

### 2. Route the edge function to the saved host
`supabase/functions/pms-sync/index.ts`
- In `extractRoomsForConfig` / the `test` + `sync` paths, pass the config's `base_url` into the Mews call (e.g. merge `baseUrl: pmsConfig.base_url` into `credentials`).
- `fetchMewsRooms` keeps `credentials.baseUrl || 'https://api.mews.com/api/connector/v1'` as fallback.
- Add 429 handling: respect the `Retry-After` header, fall back to exponential backoff (Mews enforces 200 req / 30s per AccessToken).

### 3. Connect & verify
- Save the config for the current hotel with `pms_type = mews`, the demo tokens, and `base_url` = demo host.
- Run the panel's existing **Test connection** (`action: 'test'`) which calls `spaces/getAll` + `reservations/getAll` and returns the room count — confirming the live demo connection works.

## Things to confirm
- **Which demo enterprise?** Mews gave a **Gross (UK)** and a **Net (US)** demo. I'll default to Gross/UK unless you prefer Net/US.
- These are public demo tokens, so it's fine to keep them in the app for testing. Real **production** tokens (per enterprise) should be entered through the panel by the establishment, never committed to code.

## Technical notes
- No DB migration needed — `hotel_pms_configs` already has `base_url` and `credentials` columns.
- The config is per-hotel (scoped by `hotel_id`), so connecting happens for the currently selected hotel via the panel.
- After the edge function edit I'll redeploy `pms-sync`.
</parameter>
</invoke>
