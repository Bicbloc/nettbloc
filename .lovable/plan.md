# Fix MisterBooking "0 rooms detected" — switch to Mapping + CRM APIs

## Root cause

Our code reads rooms/bookings from `connectedDevices/customers` (Connected Devices API), which these partner credentials are **not** granted. The docs you uploaded confirm the APIs you DO have, and the correct replacements:

- **Mapping API** — `POST /misterbooking/mappingRoomRate` → returns the **full room list** (every room with `id` + `name` = room number), grouped by accommodation service. Request body: `{ "hotelId": 1934 }`.
- **CRM API** — `POST /misterbooking/crm/bookings` → returns current reservations with `roomNumber`, `roomId`, `startDate`, `endDate`, `checkIn`, `checkOut`, `status`, `customerId`. Request body: `{ "hotelId", "startDate", "endDate", "status" }`.
- **Housekeeping API** — `POST /misterbooking/houseKeeping/update` (write-only, already used) → push clean/dirty status. No read endpoint exists, so the room list must come from Mapping.

Auth is unchanged: same WSSE `X-Wsse` header + HMAC `X-Signature` via the existing `mbPost`.

## Credentials

You provided new partner credentials — store/refresh as secrets:
- `MISTERBOOKING_WSSE_LOGIN` = `237`
- `MISTERBOOKING_WSSE_PASSWORD` = `Y2v6Quq9jWME`
- `MISTERBOOKING_HMAC_SECRET` = `542ba9effef8037839a0911e13e9832036bab2620687147126c460e08e383ef4`

## Changes

### 1. `supabase/functions/_shared/misterbooking.ts`
- **Add `mbFetchRoomMapping(hotelId)`** → calls `mappingRoomRate`, flattens `data.rooms[].roomList[]` into `{ roomId, roomNumber }[]` (the complete room inventory).
- **Replace `mbFetchBookings`** to call `crm/bookings` instead of `connectedDevices/customers`:
  - Send `{ hotelId, startDate: today, endDate: today, status }`. The `status` param selects in-house stays (docs list: new / stays / in-house "Séjours en chambre"). Implementation tries the in-house value first, falling back to `stays`, logging the raw response so we can pin the exact accepted string from the Edge logs.
  - Response shape change: `data.bookings` is an **object keyed by bookingId** (not an array) — map `Object.values()` into the existing `MbBooking[]`.
  - Keep E-code error detection (E01/E02/E03) with clear French messages.
- **Add `mbBuildRoomList(mapping, bookings, today)`**: start from the full mapping (every room), then overlay each current booking's status/cleaning type via the existing `mbBookingToRoom`. Rooms with no current booking default to "needs cleaning" per project registry rules. This guarantees a non-zero room list even when there are few active stays.

### 2. `supabase/functions/pms-sync/index.ts`
- `fetchMisterBookingRooms` now: fetch mapping + bookings, merge with `mbBuildRoomList`, return the full room set (so "Test connection" shows every room, with occupancy/cleaning where guests are present).

### 3. `supabase/functions/pms-sync-queue-process/index.ts`
- Its housekeeping push needs `roomId` per room. Resolve room numbers → `roomId` using `mbFetchRoomMapping` (Mapping API) instead of the old booking lookup, then call `houseKeeping/update`.

### 4. `supabase/functions/pms-forecast/index.ts`
- Switch to `crm/bookings` with `status` = stays over the forecast window `[today, today+N]`, mapping `Object.values(data.bookings)`. Gives real 7/14/30-day forecast from the CRM API.

### 5. Memory
- Update **MisterBooking Integration** memory: reads via Mapping (`mappingRoomRate`) for the room list + CRM (`crm/bookings`) for current stays/forecast; Connected Devices is NOT used. Housekeeping API is write-only.

## Validation
1. Update the three secrets.
2. Deploy `pms-sync`, `pms-forecast`, `pms-sync-queue-process`.
3. Call `pms-sync` for hotel 1934 and read Edge logs to confirm the room count and the accepted `crm/bookings` status value; pin it.
4. Confirm the UI "Test connection" lists rooms (and shows occupied/checkout where stays exist).

## Technical notes
- `mappingRoomRate` is the documented source of `roomId` (referenced by the housekeeping update endpoint), so it ties reads and writes together cleanly.
- Date window for current stays is `[today, today]`; we still client-filter to `startDate <= today <= endDate` for safety.
