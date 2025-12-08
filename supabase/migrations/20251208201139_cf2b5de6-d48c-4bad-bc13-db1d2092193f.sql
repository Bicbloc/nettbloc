-- Permettre aux admins de modifier les commentaires
CREATE POLICY "Admins can update incident comments"
ON public.incident_comments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM incidents i
    JOIN hotels h ON h.id = i.hotel_id
    WHERE i.id = incident_comments.incident_id
    AND h.user_id = auth.uid()
  )
);

-- Permettre aux admins de supprimer les commentaires
CREATE POLICY "Admins can delete incident comments"
ON public.incident_comments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM incidents i
    JOIN hotels h ON h.id = i.hotel_id
    WHERE i.id = incident_comments.incident_id
    AND h.user_id = auth.uid()
  )
);