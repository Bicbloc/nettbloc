ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel members can receive realtime for their hotel" ON realtime.messages;
DROP POLICY IF EXISTS "Hotel members can send realtime for their hotel" ON realtime.messages;

CREATE POLICY "Hotel members can receive realtime for their hotel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^realtime_[0-9a-fA-F-]{36}_'
  AND public.can_access_hotel((split_part(realtime.topic(), '_', 2))::uuid)
);

CREATE POLICY "Hotel members can send realtime for their hotel"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() ~ '^realtime_[0-9a-fA-F-]{36}_'
  AND public.can_access_hotel((split_part(realtime.topic(), '_', 2))::uuid)
);