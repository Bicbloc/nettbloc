
-- Allow staff with approved access to view task templates
CREATE POLICY "Staff can view task templates for their hotels"
ON public.task_templates
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM housekeeper_access_requests har
    WHERE har.hotel_id = task_templates.hotel_id
    AND har.status = 'approved'
    AND har.housekeeper_profile_id IN (
      SELECT hp.id FROM housekeeper_profiles hp WHERE hp.email = auth.email()
    )
  ))
  OR
  (EXISTS (
    SELECT 1 FROM governess_access_requests gar
    WHERE gar.hotel_id = task_templates.hotel_id
    AND gar.status = 'approved'
    AND gar.governess_profile_id IN (
      SELECT gp.id FROM governess_profiles gp WHERE gp.email = auth.email()
    )
  ))
  OR
  (EXISTS (
    SELECT 1 FROM technician_access_requests tar
    WHERE tar.hotel_id = task_templates.hotel_id
    AND tar.status = 'approved'
    AND tar.technician_profile_id IN (
      SELECT tp.id FROM technician_profiles tp WHERE tp.email = auth.email()
    )
  ))
);
