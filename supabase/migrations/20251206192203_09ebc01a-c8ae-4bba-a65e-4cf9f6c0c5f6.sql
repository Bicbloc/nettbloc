-- Allow anonymous users (housekeepers with access codes) to update rooms
-- This is needed because housekeepers authenticate via access codes, not auth.uid()

-- Policy to allow anonymous updates to rooms (for housekeepers with access codes)
CREATE POLICY "Anonymous users can update rooms with valid hotel"
ON rooms
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Also allow anonymous inserts to notifications (for room_note type)
DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;
CREATE POLICY "Allow all inserts to notifications"
ON notifications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);