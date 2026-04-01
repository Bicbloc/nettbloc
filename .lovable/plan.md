

## Plan: Fix Client-Side Ticket Issues

### Problem Summary
1. **Realtime notification error** — The `useNotifications` hook throws "Realtime non connecté" on page load because the RealtimeManager hasn't connected yet when the hook first runs. This causes console errors and delays notification updates.
2. **Missing staff props** — In `Index.tsx`, the `ManualTaskManager` only receives `housekeeperNames` but not `governessNames` or `technicianNames`, so the assignee search only works for housekeepers from props (DB queries inside the component partially compensate).
3. **Notification hook resilience** — When realtime fails, the hook should not show error toasts to users; it should silently fall back to polling.

### Changes

**1. Fix `useNotifications.ts` — Don't throw on realtime failure**
- In `setupRealtime`, when `realtimeManager.connect()` returns `false`, start polling immediately instead of throwing and retrying 5 times. Remove the error toast on notification load failure (it's disruptive).
- This eliminates the console error spam and ensures notifications still load via polling.

**2. Pass all staff names to `ManualTaskManager` in `Index.tsx`**
- Pass `governessNames` and `technicianNames` props to the ManualTaskManager component in the tickets tab. These lists should already be available from existing queries or can be derived from the same data source used elsewhere in the dashboard.

**3. Add `manual_tasks` to RealtimeManager subscriptions**
- In `RealtimeManager.ts`, add `'manual_tasks'` to the `tables` array (line 267) so ticket changes trigger real-time UI updates on the client side.

### Technical Details

**File: `src/hooks/use-notifications.ts`**
- Replace `throw new Error('Realtime non connecté')` with a silent fallback to `startPolling()`.
- Remove the destructive toast in the `catch` block of `loadNotifications`.

**File: `src/pages/Index.tsx`**
- Add `governessNames` and `technicianNames` props to the `<ManualTaskManager>` component around line 814-817.

**File: `src/services/RealtimeManager.ts`**
- Add `'manual_tasks'` to the tables array at line 267.

