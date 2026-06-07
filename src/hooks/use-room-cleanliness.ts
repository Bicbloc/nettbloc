import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RoomCleanliness {
  clean: number;
  dirty: number;
  total: number;
}

// Statuts considérés comme "propre"
const CLEAN_STATUSES = ['clean'];
// Statuts ignorés (hors service)
const IGNORED_STATUSES = ['out-of-service'];

/**
 * Compte en direct le nombre de chambres propres et sales pour un hôtel.
 * Se met à jour en temps réel quand une chambre change de statut.
 */
export function useRoomCleanliness(hotelId: string | null | undefined) {
  const [counts, setCounts] = useState<RoomCleanliness>({ clean: 0, dirty: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    const { data } = await supabase
      .from('rooms')
      .select('status')
      .eq('hotel_id', hotelId);
    const rows = (data as { status: string }[]) || [];
    let clean = 0;
    let dirty = 0;
    for (const r of rows) {
      if (IGNORED_STATUSES.includes(r.status)) continue;
      if (CLEAN_STATUSES.includes(r.status)) clean += 1;
      else dirty += 1;
    }
    setCounts({ clean, dirty, total: clean + dirty });
    setLoading(false);
  }, [hotelId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!hotelId) return;
    const channel = supabase
      .channel(`room-clean-${hotelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `hotel_id=eq.${hotelId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hotelId, load]);

  return { ...counts, loading, reload: load };
}
